import { useEffect, useMemo, useRef, useState } from "react";

export interface Suggestion {
  basename: string;
  path: string;
  isPdf: boolean;
}

interface Props {
  // Anchor element — used to position the popover.
  anchor: HTMLElement;
  // Full set of files (paths relative to root). Matches search both basenames
  // and full paths.
  files: string[];
  // The current query text after "[[" (without the brackets).
  query: string;
  // Position of the caret in window coordinates — used to anchor the popover
  // to the cursor, not to the textarea.
  caret: { x: number; y: number };
  onPick: (s: Suggestion) => void;
  onClose: () => void;
}

function fuzzyScore(needle: string, hay: string): number {
  const n = needle.toLowerCase();
  const h = hay.toLowerCase();
  if (!n) return 1;
  if (h === n) return 1000;
  if (h.startsWith(n)) return 500 + (n.length / h.length) * 100;
  const idx = h.indexOf(n);
  if (idx >= 0) return 200 - idx + (n.length / h.length) * 60;
  // Subsequence match: each char of needle appears in order in hay.
  let i = 0;
  let lastIdx = -1;
  let gaps = 0;
  for (const ch of n) {
    const f = h.indexOf(ch, i);
    if (f < 0) return -1;
    if (lastIdx >= 0) gaps += f - lastIdx - 1;
    lastIdx = f;
    i = f + 1;
  }
  return Math.max(1, 100 - gaps);
}

function basenameOf(p: string): string {
  const ix = p.lastIndexOf("/");
  const name = ix >= 0 ? p.slice(ix + 1) : p;
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

export function WikilinkAutocomplete({
  anchor: _anchor,
  files,
  query,
  caret,
  onPick,
  onClose,
}: Props) {
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Rank candidates: prefer basename match, then full-path match.
  const ranked = useMemo<Suggestion[]>(() => {
    const out: Array<{ s: Suggestion; score: number }> = [];
    for (const f of files) {
      const base = basenameOf(f);
      const isPdf = f.toLowerCase().endsWith(".pdf");
      const sb = fuzzyScore(query, base);
      const sp = fuzzyScore(query, f);
      const score = Math.max(sb, sp * 0.7);
      if (score <= 0 && query) continue;
      out.push({ s: { basename: base, path: f, isPdf }, score });
    }
    out.sort((a, b) => b.score - a.score);
    return out.slice(0, 12).map((x) => x.s);
  }, [files, query]);

  // Reset selection when the candidate list shrinks.
  useEffect(() => {
    setActive((a) => Math.min(a, Math.max(0, ranked.length - 1)));
  }, [ranked]);

  // Keyboard nav is bound at the window level so it works regardless of focus.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(ranked.length - 1, a + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(0, a - 1));
      } else if (e.key === "Enter" || e.key === "Tab") {
        if (ranked[active]) {
          e.preventDefault();
          onPick(ranked[active]);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    // Capture phase so we beat the textarea's own keydown.
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [ranked, active, onPick, onClose]);

  // Clamp the popover horizontally so it doesn't overflow the viewport.
  const left = Math.min(caret.x, window.innerWidth - 320);
  const top = caret.y + 22;

  if (ranked.length === 0) {
    return (
      <div
        ref={containerRef}
        className="wiki-autocomplete is-empty"
        style={{ left, top }}
      >
        <div className="wiki-ac-empty">
          No notes match "<strong>{query}</strong>". Press Enter to insert
          anyway, Esc to cancel.
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="wiki-autocomplete" style={{ left, top }}>
      {ranked.map((s, i) => (
        <button
          key={s.path}
          className={`wiki-ac-row ${i === active ? "is-active" : ""}`}
          onMouseEnter={() => setActive(i)}
          onMouseDown={(e) => {
            // Use mousedown so we beat the textarea's onBlur that would close us.
            e.preventDefault();
            onPick(s);
          }}
        >
          <span className={`wiki-ac-kind ${s.isPdf ? "is-pdf" : "is-md"}`}>
            {s.isPdf ? "PDF" : "MD"}
          </span>
          <span className="wiki-ac-name">{s.basename}</span>
          <span className="wiki-ac-path">{s.path}</span>
        </button>
      ))}
    </div>
  );
}
