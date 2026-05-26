import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  root: string;
  port: number;
  host: string;
}

const MD_EXTENSIONS = new Set([".md", ".markdown", ".mdx"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".bmp", ".ico"]);
const PDF_EXTENSIONS = new Set([".pdf"]);
const TEXT_LIKE_EXTENSIONS = new Set([
  ".txt", ".log", ".csv", ".tsv", ".json", ".yaml", ".yml", ".toml", ".ini",
  ".conf", ".cfg",
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".py", ".pyi", ".rb", ".go", ".rs",
  ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".hh", ".cs", ".php", ".swift",
  ".kt", ".scala", ".lua", ".sh", ".bash", ".zsh", ".fish", ".ps1",
  ".html", ".htm", ".css", ".scss", ".sass", ".less", ".sql", ".graphql",
  ".vue", ".svelte", ".env", ".gitignore", ".dockerfile",
  ".cu", ".cuh", ".glsl", ".hlsl", ".wgsl", ".metal", ".vert", ".frag", ".geom", ".comp",
  ".asm", ".s", ".S", ".wat", ".wast", ".v", ".sv",
  ".r", ".jl", ".m", ".dart", ".ex", ".exs", ".erl", ".clj", ".cljs", ".hs",
  ".tex", ".bib",
  ".makefile", ".cmake", ".gradle",
  ".vimrc", ".vim", ".lock",
]);
const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".svn",
  ".hg",
  "dist",
  "build",
  ".next",
  ".cache",
  ".idea",
  ".vscode",
  "__pycache__",
  ".venv",
  "venv",
  ".markviz",
  ".turbo",
  "target",
]);

type FileKind = "markdown" | "image" | "text" | "pdf" | "binary";

interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  kind?: FileKind;
  size?: number;
  children?: TreeNode[];
}

function classify(name: string): FileKind {
  const ext = path.extname(name).toLowerCase();
  const base = path.basename(name).toLowerCase();
  if (MD_EXTENSIONS.has(ext)) return "markdown";
  if (IMAGE_EXTENSIONS.has(ext)) return "image";
  if (PDF_EXTENSIONS.has(ext)) return "pdf";
  if (TEXT_LIKE_EXTENSIONS.has(ext)) return "text";
  if (!ext && /^(readme|license|dockerfile|makefile|changelog|notice|authors|contributing)$/i.test(base)) return "text";
  return "binary";
}

async function buildTree(root: string, current: string): Promise<TreeNode[]> {
  let entries;
  try {
    entries = await fs.readdir(current, { withFileTypes: true });
  } catch {
    return [];
  }
  const nodes: TreeNode[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const childPath = path.join(current, entry.name);
      const children = await buildTree(root, childPath);
      if (children.length > 0) {
        nodes.push({
          name: entry.name,
          path: path.relative(root, childPath),
          type: "dir",
          children,
        });
      }
    } else if (entry.isFile()) {
      const kind = classify(entry.name);
      if (kind === "binary") continue;
      const filePath = path.join(current, entry.name);
      let size: number | undefined;
      try {
        const st = await fs.stat(filePath);
        size = st.size;
      } catch {}
      nodes.push({
        name: entry.name,
        path: path.relative(root, filePath),
        type: "file",
        kind,
        size,
      });
    }
  }
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return nodes;
}

function safeResolve(root: string, relPath: string): string | null {
  const normalized = path.normalize(relPath).replace(/^(\.\.[\\/])+/, "");
  const resolved = path.resolve(root, normalized);
  const rootResolved = path.resolve(root);
  if (resolved !== rootResolved && !resolved.startsWith(rootResolved + path.sep)) {
    return null;
  }
  return resolved;
}

export async function startServer(opts: ServerOptions): Promise<{ url: string; close: () => Promise<void> }> {
  const app = Fastify({ logger: false });
  let root = path.resolve(opts.root);

  // Locate static frontend files. In production they live next to dist/ at ../web/dist.
  const webDistCandidates = [
    path.resolve(__dirname, "..", "web", "dist"),
    path.resolve(__dirname, "..", "..", "web", "dist"),
  ];
  const webDist = webDistCandidates.find((p) => fssync.existsSync(p));

  if (webDist) {
    await app.register(fastifyStatic, {
      root: webDist,
      prefix: "/",
      wildcard: false,
    });
  }

  app.get("/api/info", async () => ({
    root,
    rootName: path.basename(root),
    pid: process.pid,
    home: process.env.HOME ?? process.env.USERPROFILE ?? "/",
  }));

  // Re-root: change the directory this server serves. Lets the user "cd" inside
  // the browser without restarting markviz.
  app.post<{ Body: { path?: string } }>("/api/reroot", async (req, reply) => {
    const newRoot = req.body?.path;
    if (!newRoot) {
      reply.code(400);
      return { error: "missing path" };
    }
    const resolved = path.resolve(newRoot);
    try {
      const stat = await fs.stat(resolved);
      if (!stat.isDirectory()) {
        reply.code(400);
        return { error: "not a directory" };
      }
      root = resolved;
      setupWatcher();
      broadcast({ type: "root-change", path: root });
      return { ok: true, root, rootName: path.basename(root) };
    } catch (err: unknown) {
      reply.code(404);
      return { error: (err as Error).message };
    }
  });

  // Filesystem browse — list ANY directory on disk (read-only) so the user can
  // pick a new root from the UI. Server returns parent + children with a
  // markdown-count hint per directory.
  app.get<{ Querystring: { path?: string } }>("/api/browse", async (req, reply) => {
    const target = req.query.path
      ? path.resolve(req.query.path)
      : (process.env.HOME ?? "/");
    try {
      const stat = await fs.stat(target);
      if (!stat.isDirectory()) {
        reply.code(400);
        return { error: "not a directory" };
      }
      const entries = await fs.readdir(target, { withFileTypes: true });
      const items: Array<{ name: string; path: string; type: "dir"; mdCount: number }> = [];
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        if (e.name.startsWith(".")) continue;
        if (IGNORED_DIRS.has(e.name)) continue;
        const childPath = path.join(target, e.name);
        let mdCount = 0;
        try {
          const inner = await fs.readdir(childPath, { withFileTypes: true });
          for (const ie of inner) {
            if (ie.isFile() && classify(ie.name) === "markdown") mdCount++;
          }
        } catch {}
        items.push({ name: e.name, path: childPath, type: "dir", mdCount });
      }
      items.sort((a, b) => a.name.localeCompare(b.name));
      const parent = path.dirname(target);
      let ownMdCount = 0;
      try {
        const own = await fs.readdir(target, { withFileTypes: true });
        for (const e of own) {
          if (e.isFile() && classify(e.name) === "markdown") ownMdCount++;
        }
      } catch {}
      return {
        path: target,
        parent: parent === target ? null : parent,
        items,
        mdCount: ownMdCount,
      };
    } catch (err: unknown) {
      reply.code(404);
      return { error: (err as Error).message };
    }
  });

  // Heartbeat: clients ping this every 5s.
  // If no heartbeat for 30s AND no active clients, shut down.
  let lastHeartbeat = Date.now();
  let activeClients = 0;

  app.post("/api/heartbeat", async () => {
    lastHeartbeat = Date.now();
    return { ok: true };
  });

  app.post("/api/connect", async () => {
    activeClients++;
    lastHeartbeat = Date.now();
    return { ok: true, clients: activeClients };
  });

  app.post("/api/disconnect", async () => {
    activeClients = Math.max(0, activeClients - 1);
    return { ok: true, clients: activeClients };
  });

  // Add a session endpoint so an existing server can be told to open a new file/root.
  app.post<{ Body: { root?: string; file?: string } }>("/api/session", async (req) => {
    // Allow a markviz CLI invocation in another dir to redirect this server's clients.
    // We don't actually re-root (security), but we let CLI know if it matches.
    const reqRoot = req.body?.root;
    if (reqRoot && path.resolve(reqRoot) === root) {
      return { ok: true, matched: true, root, file: req.body?.file ?? null };
    }
    return { ok: false, matched: false, root };
  });

  // Auto-shutdown loop
  const idleCheck = setInterval(() => {
    const idleMs = Date.now() - lastHeartbeat;
    if (activeClients === 0 && idleMs > 30_000) {
      clearInterval(idleCheck);
      app.close().catch(() => {});
      setTimeout(() => process.exit(0), 100);
    }
  }, 5_000);

  // === Live reload via SSE ===
  // Watch the root for filesystem changes and stream events to clients.
  type SSEClient = { id: number; write: (data: string) => void };
  const sseClients = new Map<number, SSEClient>();
  let nextSseId = 1;

  function broadcast(event: { type: string; path?: string }) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const c of sseClients.values()) {
      try { c.write(payload); } catch {}
    }
  }

  // Debounce filesystem events so saving a file doesn't fire 5 times.
  let watcher: fssync.FSWatcher | null = null;
  let watchedRoot = "";
  const pendingChanges = new Map<string, ReturnType<typeof setTimeout>>();
  function setupWatcher() {
    if (watcher && watchedRoot === root) return;
    if (watcher) { try { watcher.close(); } catch {} }
    watchedRoot = root;
    try {
      watcher = fssync.watch(root, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const name = String(filename);
        // Filter noise
        if (name.startsWith(".") || name.includes("/.") || name.includes("/node_modules/")) return;
        // Debounce per-file
        if (pendingChanges.has(name)) clearTimeout(pendingChanges.get(name)!);
        pendingChanges.set(name, setTimeout(() => {
          pendingChanges.delete(name);
          const ext = path.extname(name).toLowerCase();
          const kind = classify(name);
          // Tell clients which file changed; let them decide whether to reload.
          broadcast({ type: "fs-change", path: name });
          // If structure may have changed (new/removed file), also signal a tree reload.
          if (MD_EXTENSIONS.has(ext) || kind === "text" || kind === "image") {
            broadcast({ type: "tree-change" });
          }
        }, 120));
      });
    } catch {
      // some filesystems don't support recursive watch — fail soft
      watcher = null;
    }
  }
  setupWatcher();

  app.get("/api/events", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("X-Accel-Buffering", "no");
    reply.raw.write(": connected\n\n");

    const id = nextSseId++;
    const client: SSEClient = {
      id,
      write: (data: string) => reply.raw.write(data),
    };
    sseClients.set(id, client);
    activeClients++;
    lastHeartbeat = Date.now();

    // Keep-alive comments every 25s to prevent proxy timeouts.
    const ka = setInterval(() => {
      try { reply.raw.write(": ping\n\n"); } catch {}
    }, 25_000);

    req.raw.on("close", () => {
      clearInterval(ka);
      sseClients.delete(id);
      activeClients = Math.max(0, activeClients - 1);
    });
  });

  app.get("/api/tree", async () => {
    const tree = await buildTree(root, root);
    return { tree };
  });

  // Flat index of markdown files keyed by basename (without extension) for
  // wikilink resolution. If two files share a basename, we expose both so the
  // client can disambiguate. Also include heading anchors so [[file#section]]
  // can resolve.
  async function listMarkdown(): Promise<string[]> {
    const out: string[] = [];
    async function walk(dir: string) {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (IGNORED_DIRS.has(e.name)) continue;
          await walk(p);
        } else if (e.isFile() && MD_EXTENSIONS.has(path.extname(e.name).toLowerCase())) {
          out.push(path.relative(root, p));
        }
      }
    }
    await walk(root);
    return out;
  }

  async function listLinkable(): Promise<{ md: string[]; pdf: string[] }> {
    const md: string[] = [];
    const pdf: string[] = [];
    async function walk(dir: string) {
      let entries;
      try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name.startsWith(".")) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (IGNORED_DIRS.has(e.name)) continue;
          await walk(p);
        } else if (e.isFile()) {
          const ext = path.extname(e.name).toLowerCase();
          if (MD_EXTENSIONS.has(ext)) md.push(path.relative(root, p));
          else if (PDF_EXTENSIONS.has(ext)) pdf.push(path.relative(root, p));
        }
      }
    }
    await walk(root);
    return { md, pdf };
  }

  app.get("/api/index", async () => {
    const { md, pdf } = await listLinkable();
    // Markdown wins on basename collision so notes shadow same-named PDFs.
    const files = [...md, ...pdf];
    const byBasename: Record<string, string[]> = {};
    const add = (f: string) => {
      const base = path.basename(f, path.extname(f));
      (byBasename[base] ||= []).push(f);
      const slug = base.toLowerCase().replace(/\s+/g, "-");
      if (slug !== base.toLowerCase()) {
        (byBasename[slug] ||= []).push(f);
      }
    };
    for (const f of md) add(f);
    for (const f of pdf) add(f);
    return { files, byBasename };
  });

  // SRS persistence — store progress in .markviz/srs.json under the root.
  const srsPath = () => path.join(root, ".markviz", "srs.json");
  app.get("/api/srs", async () => {
    try {
      const raw = await fs.readFile(srsPath(), "utf8");
      return JSON.parse(raw);
    } catch {
      return { cards: {} };
    }
  });
  app.put<{ Body: unknown }>("/api/srs", async (req) => {
    try {
      await fs.mkdir(path.join(root, ".markviz"), { recursive: true });
      await fs.writeFile(srsPath(), JSON.stringify(req.body ?? {}, null, 2), "utf8");
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Sessions — saved workspaces (open file + split layout) keyed by name.
  const sessionsPath = () => path.join(root, ".markviz", "sessions.json");
  app.get("/api/sessions", async () => {
    try {
      const raw = await fs.readFile(sessionsPath(), "utf8");
      return JSON.parse(raw);
    } catch {
      return { sessions: {} };
    }
  });
  app.put<{ Body: unknown }>("/api/sessions", async (req) => {
    try {
      await fs.mkdir(path.join(root, ".markviz"), { recursive: true });
      await fs.writeFile(sessionsPath(), JSON.stringify(req.body ?? {}, null, 2), "utf8");
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Daily-note template. If `.markviz/daily-template.md` exists the client
  // uses its contents when creating a new daily note; otherwise the client
  // falls back to a built-in default.
  const dailyTemplatePath = () => path.join(root, ".markviz", "daily-template.md");
  app.get("/api/daily-template", async () => {
    try {
      const raw = await fs.readFile(dailyTemplatePath(), "utf8");
      return { template: raw };
    } catch {
      return { template: null };
    }
  });
  app.put<{ Body: { template?: string } }>("/api/daily-template", async (req) => {
    try {
      await fs.mkdir(path.join(root, ".markviz"), { recursive: true });
      await fs.writeFile(dailyTemplatePath(), String(req.body?.template ?? ""), "utf8");
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: (err as Error).message };
    }
  });

  // Full-text search across all markdown.
  app.get<{ Querystring: { q?: string; limit?: string } }>("/api/search", async (req) => {
    const q = (req.query.q ?? "").trim();
    const limit = Math.min(50, Math.max(5, Number(req.query.limit ?? 20)));
    if (q.length < 2) return { query: q, results: [] };
    const files = await listMarkdown();
    const needle = q.toLowerCase();
    interface Hit {
      path: string;
      title: string;
      score: number;
      snippet: string;
      line: number;
    }
    const hits: Hit[] = [];
    for (const f of files) {
      let content = "";
      try { content = await fs.readFile(path.join(root, f), "utf8"); } catch { continue; }
      const lower = content.toLowerCase();
      let occurrences = 0;
      let firstIdx = -1;
      let pos = 0;
      while ((pos = lower.indexOf(needle, pos)) !== -1) {
        occurrences++;
        if (firstIdx === -1) firstIdx = pos;
        pos += needle.length;
      }
      if (occurrences === 0) continue;
      const titleMatch = /^\s*#\s+(.+?)\s*$/m.exec(content);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(f, path.extname(f));
      // Score: occurrences + bonuses for matches in title/filename
      let score = occurrences;
      if (title.toLowerCase().includes(needle)) score += 10;
      if (f.toLowerCase().includes(needle)) score += 5;
      // Find line + snippet of the first hit
      const before = content.slice(0, firstIdx);
      const line = before.split("\n").length;
      // 80 chars of context around the hit
      const start = Math.max(0, firstIdx - 60);
      const end = Math.min(content.length, firstIdx + needle.length + 60);
      let snippet = content.slice(start, end).replace(/\n/g, " ").trim();
      if (start > 0) snippet = "… " + snippet;
      if (end < content.length) snippet = snippet + " …";
      hits.push({ path: f, title, score, snippet, line });
    }
    hits.sort((a, b) => b.score - a.score);
    return { query: q, results: hits.slice(0, limit) };
  });

  // Backlinks: parse all markdown for [[wikilink]] and [text](relative.md) and
  // return who links to whom. Recomputed each call; for small repos this is
  // fine. Wikilink matcher mirrors the client's parser.
  app.get("/api/graph", async () => {
    const files = await listMarkdown();
    const out: { nodes: Array<{ path: string; title: string }>; edges: Array<{ from: string; to: string; kind: "wiki" | "md" }> } = {
      nodes: [],
      edges: [],
    };

    // Build basename index for wikilink resolution.
    const byBasename: Record<string, string> = {};
    for (const f of files) {
      const base = path.basename(f, path.extname(f));
      byBasename[base.toLowerCase()] = f;
    }

    for (const f of files) {
      let content = "";
      try { content = await fs.readFile(path.join(root, f), "utf8"); } catch { continue; }
      const titleMatch = /^\s*#\s+(.+?)\s*$/m.exec(content);
      const title = titleMatch ? titleMatch[1].trim() : path.basename(f, path.extname(f));
      out.nodes.push({ path: f, title });

      // [[wikilink]] (skip code blocks)
      const stripped = content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`[^`\n]*`/g, "");

      for (const m of stripped.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|[^\]]+)?\]\]/g)) {
        const target = m[1].trim().toLowerCase();
        const resolved = byBasename[target];
        if (resolved && resolved !== f) {
          out.edges.push({ from: f, to: resolved, kind: "wiki" });
        }
      }

      // Relative markdown links: [text](path.md) or (./path.md) etc.
      for (const m of stripped.matchAll(/\[(?:[^\]]+)\]\(([^)]+\.(?:md|markdown|mdx))(?:#[^)]+)?\)/g)) {
        const href = m[1].trim();
        if (/^https?:\/\//.test(href)) continue;
        const dir = path.dirname(f);
        const resolved = path.normalize(path.join(dir, href)).replace(/^[\\/]+/, "");
        // ensure it points to a known file
        if (files.includes(resolved) && resolved !== f) {
          out.edges.push({ from: f, to: resolved, kind: "md" });
        }
      }
    }

    // De-duplicate edges
    const seen = new Set<string>();
    out.edges = out.edges.filter((e) => {
      const k = `${e.from}|${e.to}|${e.kind}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    return out;
  });

  app.get<{ Querystring: { path?: string } }>("/api/file", async (req, reply) => {
    const rel = req.query.path;
    if (!rel) {
      reply.code(400);
      return { error: "missing path" };
    }
    const abs = safeResolve(root, rel);
    if (!abs) {
      reply.code(403);
      return { error: "path outside root" };
    }
    try {
      const stat = await fs.stat(abs);
      const kind = classify(abs);
      if (kind === "image" || kind === "pdf" || kind === "binary") {
        return {
          path: rel,
          kind,
          content: null,
          mtime: stat.mtimeMs,
          size: stat.size,
          url: `/raw/${encodeURI(rel)}`,
        };
      }
      const content = await fs.readFile(abs, "utf8");
      return {
        path: rel,
        kind,
        content,
        mtime: stat.mtimeMs,
        size: stat.size,
      };
    } catch (err: unknown) {
      reply.code(404);
      return { error: (err as Error).message };
    }
  });

  app.put<{ Body: { path: string; content: string } }>("/api/file", async (req, reply) => {
    const { path: rel, content } = req.body ?? {};
    if (!rel || typeof content !== "string") {
      reply.code(400);
      return { error: "missing path or content" };
    }
    const abs = safeResolve(root, rel);
    if (!abs) {
      reply.code(403);
      return { error: "path outside root" };
    }
    const kind = classify(abs);
    if (kind !== "markdown" && kind !== "text") {
      reply.code(400);
      return { error: "only markdown and text files can be edited" };
    }
    try {
      await fs.writeFile(abs, content, "utf8");
      const stat = await fs.stat(abs);
      return { ok: true, mtime: stat.mtimeMs, size: stat.size };
    } catch (err: unknown) {
      reply.code(500);
      return { error: (err as Error).message };
    }
  });

  // === arXiv integration ===
  // Accepts an arxiv id (e.g. "2305.12345", "2305.12345v2", or a full URL) and
  // returns a normalized id without the version suffix and the version (if any).
  function parseArxivId(input: string): { id: string; version: string | null } | null {
    const s = input.trim();
    // Full URLs: arxiv.org/abs/<id>, arxiv.org/pdf/<id>(.pdf)?, export.arxiv.org/...
    const urlMatch = /arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:\.pdf)?(?:[?#].*)?$/i.exec(s);
    const raw = urlMatch ? urlMatch[1] : s;
    // New-style: 2305.12345 (4 digits . 4-5 digits) optional v\d+
    const newStyle = /^(\d{4}\.\d{4,5})(v\d+)?$/i.exec(raw);
    if (newStyle) return { id: newStyle[1], version: newStyle[2] ?? null };
    // Old-style: math/0211159, hep-th/9901001 etc.
    const oldStyle = /^([a-z-]+(?:\.[A-Z]{2})?\/\d{7})(v\d+)?$/i.exec(raw);
    if (oldStyle) return { id: oldStyle[1], version: oldStyle[2] ?? null };
    return null;
  }

  // Stream a PDF from arxiv.org through the server so the browser sidesteps CORS.
  app.get<{ Querystring: { id?: string } }>("/api/arxiv/proxy", async (req, reply) => {
    const parsed = req.query.id ? parseArxivId(req.query.id) : null;
    if (!parsed) {
      reply.code(400);
      return { error: "missing or invalid arxiv id" };
    }
    const versioned = parsed.version ? `${parsed.id}${parsed.version}` : parsed.id;
    const url = `https://arxiv.org/pdf/${versioned}.pdf`;
    try {
      const upstream = await fetch(url, { redirect: "follow" });
      if (!upstream.ok || !upstream.body) {
        reply.code(upstream.status || 502);
        return { error: `arxiv returned ${upstream.status}` };
      }
      reply.header("Content-Type", "application/pdf");
      reply.header("Cache-Control", "public, max-age=3600");
      reply.header("Content-Disposition", `inline; filename="arxiv-${versioned}.pdf"`);
      return reply.send(upstream.body);
    } catch (err: unknown) {
      reply.code(502);
      return { error: (err as Error).message };
    }
  });

  // Fetch arxiv metadata (title, authors, summary) via the public API.
  app.get<{ Querystring: { id?: string } }>("/api/arxiv/meta", async (req, reply) => {
    const parsed = req.query.id ? parseArxivId(req.query.id) : null;
    if (!parsed) {
      reply.code(400);
      return { error: "missing or invalid arxiv id" };
    }
    try {
      const res = await fetch(`https://export.arxiv.org/api/query?id_list=${parsed.id}`);
      const xml = await res.text();
      // Lightweight extraction — we don't need a real XML parser for these fields.
      const titleMatch = /<entry[\s\S]*?<title>([\s\S]*?)<\/title>/.exec(xml);
      const summaryMatch = /<entry[\s\S]*?<summary>([\s\S]*?)<\/summary>/.exec(xml);
      const authors = Array.from(xml.matchAll(/<author>\s*<name>([\s\S]*?)<\/name>/g)).map((m) => m[1].trim());
      const publishedMatch = /<entry[\s\S]*?<published>([\s\S]*?)<\/published>/.exec(xml);
      return {
        id: parsed.id,
        version: parsed.version,
        title: titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : null,
        summary: summaryMatch ? summaryMatch[1].trim().replace(/\s+/g, " ") : null,
        authors,
        published: publishedMatch ? publishedMatch[1].trim() : null,
        pdfUrl: `https://arxiv.org/pdf/${parsed.version ? parsed.id + parsed.version : parsed.id}.pdf`,
        absUrl: `https://arxiv.org/abs/${parsed.version ? parsed.id + parsed.version : parsed.id}`,
      };
    } catch (err: unknown) {
      reply.code(502);
      return { error: (err as Error).message };
    }
  });

  // Download the arxiv PDF and save it into the root so it shows up in the tree.
  app.post<{ Body: { id?: string; subdir?: string; filename?: string } }>("/api/arxiv/import", async (req, reply) => {
    const parsed = req.body?.id ? parseArxivId(req.body.id) : null;
    if (!parsed) {
      reply.code(400);
      return { error: "missing or invalid arxiv id" };
    }
    const versioned = parsed.version ? `${parsed.id}${parsed.version}` : parsed.id;
    // Sanitize subdir/filename — only allow safe characters and forbid traversal.
    const subdirRaw = (req.body?.subdir ?? "papers").replace(/[^a-zA-Z0-9._/-]/g, "").replace(/^\/+|\/+$/g, "");
    const fnameSafe = (req.body?.filename ?? `arxiv-${versioned.replace(/\//g, "_")}.pdf`)
      .replace(/[^a-zA-Z0-9._-]/g, "_");
    const finalName = fnameSafe.endsWith(".pdf") ? fnameSafe : `${fnameSafe}.pdf`;
    const relPath = path.posix.join(subdirRaw || ".", finalName);
    const abs = safeResolve(root, relPath);
    if (!abs) {
      reply.code(403);
      return { error: "path outside root" };
    }
    try {
      await fs.mkdir(path.dirname(abs), { recursive: true });
      const url = `https://arxiv.org/pdf/${versioned}.pdf`;
      const upstream = await fetch(url, { redirect: "follow" });
      if (!upstream.ok || !upstream.body) {
        reply.code(upstream.status || 502);
        return { error: `arxiv returned ${upstream.status}` };
      }
      const buf = Buffer.from(await upstream.arrayBuffer());
      await fs.writeFile(abs, buf);
      return {
        ok: true,
        path: path.relative(root, abs),
        size: buf.length,
        id: parsed.id,
        version: parsed.version,
      };
    } catch (err: unknown) {
      reply.code(502);
      return { error: (err as Error).message };
    }
  });

  // Serve static assets referenced by markdown (images, etc.) from the root.
  app.get<{ Params: { "*": string } }>("/raw/*", async (req, reply) => {
    const rel = (req.params as { "*": string })["*"];
    const abs = safeResolve(root, rel);
    if (!abs) {
      reply.code(403);
      return reply.send({ error: "path outside root" });
    }
    if (!fssync.existsSync(abs)) {
      reply.code(404);
      return reply.send({ error: "not found" });
    }
    return reply.sendFile(path.relative(root, abs), root);
  });

  // SPA fallback - serve index.html for any unknown GET so client routing works.
  app.setNotFoundHandler((req, reply) => {
    if (req.method === "GET" && webDist && !req.url.startsWith("/api/") && !req.url.startsWith("/raw/")) {
      return reply.sendFile("index.html", webDist);
    }
    reply.code(404).send({ error: "not found" });
  });

  await app.listen({ port: opts.port, host: opts.host });

  const url = `http://${opts.host}:${opts.port}`;
  return {
    url,
    close: async () => {
      await app.close();
    },
  };
}
