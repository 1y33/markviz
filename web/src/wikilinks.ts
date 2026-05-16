// Wikilink helpers — convert [[target]] / [[target|alias]] / [[target#heading]]
// into standard markdown links the renderer already understands. We use a
// pseudo-protocol so the link component can intercept them.

const WIKILINK_RE = /\[\[([^\]|#]+)(?:#([^\]|]+))?(?:\|([^\]]+))?\]\]/g;

const FENCE_OPEN = /^(?:```|~~~)/;

export function transformWikilinks(md: string): string {
  // Don't transform inside fenced code blocks. Split-and-rejoin approach.
  const lines = md.split("\n");
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (FENCE_OPEN.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    lines[i] = lines[i].replace(WIKILINK_RE, (_full, target, heading, alias) => {
      const t = target.trim();
      const h = heading ? `#${heading.trim()}` : "";
      const label = (alias ?? target).trim();
      const href = `markviz://wiki/${encodeURIComponent(t)}${h}`;
      return `[${label}](${href})`;
    });
    // Also turn bare #tags (not headings) into clickable tags.
    // Heuristic: skip if line starts with # (heading) or inside an `inline code` segment.
    if (!/^\s*#{1,6}\s/.test(lines[i])) {
      lines[i] = lines[i].replace(
        /(^|[^&\w])#([a-zA-Z][\w/-]+)/g,
        (full, prefix: string, tag: string) => `${prefix}[#${tag}](markviz://tag/${encodeURIComponent(tag)})`,
      );
    }
  }
  return lines.join("\n");
}

export function isWikiHref(href: string): boolean {
  return href.startsWith("markviz://wiki/");
}
export function isTagHref(href: string): boolean {
  return href.startsWith("markviz://tag/");
}
export function parseWikiHref(href: string): { target: string; heading?: string } | null {
  if (!isWikiHref(href)) return null;
  const rest = href.slice("markviz://wiki/".length);
  const [encTarget, heading] = rest.split("#", 2);
  return { target: decodeURIComponent(encTarget), heading };
}
export function parseTagHref(href: string): string | null {
  if (!isTagHref(href)) return null;
  return decodeURIComponent(href.slice("markviz://tag/".length));
}
