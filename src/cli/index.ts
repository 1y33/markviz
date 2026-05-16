#!/usr/bin/env node
import { Command } from "commander";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { startServer } from "../server/index.js";
import open from "open";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findSkillsDir(): string | null {
  const candidates = [
    path.resolve(__dirname, "..", "skills"),
    path.resolve(__dirname, "..", "..", "dist", "skills"),
    path.resolve(__dirname, "..", "..", ".claude", "skills"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) {
      const entries = fs.readdirSync(c);
      // New format: subfolders containing SKILL.md
      if (entries.some((e) => {
        const sub = path.join(c, e);
        return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, "SKILL.md"));
      })) return c;
    }
  }
  return null;
}

function listSkillDirs(skillsRoot: string): string[] {
  return fs.readdirSync(skillsRoot)
    .filter((e) => {
      const sub = path.join(skillsRoot, e);
      return fs.statSync(sub).isDirectory() && fs.existsSync(path.join(sub, "SKILL.md"));
    });
}

function copyRecursive(src: string, dst: string) {
  if (fs.statSync(src).isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) {
      copyRecursive(path.join(src, f), path.join(dst, f));
    }
  } else {
    fs.copyFileSync(src, dst);
  }
}

function rmrf(p: string) {
  if (!fs.existsSync(p)) return;
  if (fs.statSync(p).isDirectory()) {
    for (const f of fs.readdirSync(p)) rmrf(path.join(p, f));
    fs.rmdirSync(p);
  } else {
    fs.unlinkSync(p);
  }
}

const program = new Command();

async function tryReachExisting(
  port: number,
  host: string,
  expectedRoot: string,
): Promise<{ pid: number; root: string } | null> {
  try {
    const res = await fetch(`http://${host}:${port}/api/info`, {
      signal: AbortSignal.timeout(500),
    });
    if (!res.ok) return null;
    const info = (await res.json()) as { root?: string; pid?: number };
    if (info.root && path.resolve(info.root) === path.resolve(expectedRoot)) {
      return { pid: info.pid ?? 0, root: info.root };
    }
    return null;
  } catch {
    return null;
  }
}

async function findFreePort(start: number, host: string): Promise<number> {
  for (let p = start; p < start + 50; p++) {
    try {
      const res = await fetch(`http://${host}:${p}/api/info`, {
        signal: AbortSignal.timeout(300),
      });
      // Port taken by something — try next.
      if (res) continue;
    } catch {
      return p;
    }
  }
  return start;
}

program
  .name("markviz")
  .description("Beautiful, fast markdown viewer launched from your terminal.")
  .argument("[target]", "file or directory to open (defaults to current directory)")
  .option("-p, --port <port>", "port to run on", "7331")
  .option("--host <host>", "host to bind to", "127.0.0.1")
  .option("--no-open", "do not open the browser automatically")
  .option("--no-reuse", "do not reuse an existing server even if one is running for this root")
  .version("0.1.0")
  .action(async (target: string | undefined, opts: { port: string; host: string; open: boolean; reuse: boolean }) => {
    const cwd = process.cwd();
    const resolved = target ? path.resolve(cwd, target) : cwd;

    if (!fs.existsSync(resolved)) {
      console.error(`markviz: path not found: ${resolved}`);
      process.exit(1);
    }

    const stat = fs.statSync(resolved);
    const isFile = stat.isFile();
    const root = isFile ? path.dirname(resolved) : resolved;
    const initialFile = isFile ? path.relative(root, resolved) : null;

    const startPort = Number(opts.port);
    const host = opts.host;

    // If a markviz server is already running on this port with the same root,
    // just open a new browser tab pointing at it — don't start another server.
    if (opts.reuse) {
      const existing = await tryReachExisting(startPort, host, root);
      if (existing) {
        const url = `http://${host}:${startPort}${
          initialFile ? `/?file=${encodeURIComponent(initialFile)}` : ""
        }`;
        console.log(`\n  markviz  (reusing pid ${existing.pid})`);
        console.log(`  ${"─".repeat(7)}`);
        console.log(`  url:  ${url}\n`);
        if (opts.open) {
          try { await open(url); } catch {}
        }
        return;
      }
    }

    // Otherwise pick a free port and start fresh.
    let port = startPort;
    try {
      const probe = await fetch(`http://${host}:${port}/api/info`, { signal: AbortSignal.timeout(300) });
      if (probe.ok) {
        // Port taken by a *different* markviz root (or something else). Find free port.
        port = await findFreePort(startPort + 1, host);
      }
    } catch {
      // Port free.
    }

    const { url } = await startServer({ root, port, host });

    const target_url = initialFile
      ? `${url}/?file=${encodeURIComponent(initialFile)}`
      : url;

    console.log(`\n  markviz`);
    console.log(`  ${"─".repeat(7)}`);
    console.log(`  root: ${root}`);
    if (initialFile) console.log(`  file: ${initialFile}`);
    console.log(`  url:  ${target_url}`);
    console.log(`  pid:  ${process.pid}`);
    console.log(`\n  Auto-shuts down when no clients are connected.`);
    console.log(`  Press Ctrl+C to stop now.\n`);

    if (opts.open) {
      try {
        await open(target_url);
      } catch {
        // ignore — user can copy URL manually
      }
    }
  });

program
  .command("stop")
  .description("Stop any markviz server running on the given port (default 7331)")
  .option("-p, --port <port>", "port the server is running on", "7331")
  .option("--host <host>", "host to reach", "127.0.0.1")
  .option("--all", "scan ports 7331-7380 and stop every markviz found")
  .action(async (opts: { port: string; host: string; all?: boolean }) => {
    const host = opts.host;
    const ports = opts.all ? Array.from({ length: 50 }, (_, i) => 7331 + i) : [Number(opts.port)];
    let stopped = 0;
    for (const p of ports) {
      try {
        const res = await fetch(`http://${host}:${p}/api/info`, { signal: AbortSignal.timeout(300) });
        if (!res.ok) continue;
        const info = (await res.json()) as { pid?: number; root?: string };
        if (info.pid) {
          try {
            process.kill(info.pid, "SIGTERM");
            console.log(`  stopped pid ${info.pid} on :${p}  (${info.root})`);
            stopped++;
          } catch {}
        }
      } catch {}
    }
    if (stopped === 0) console.log("  no markviz servers found.");
  });

program
  .command("list")
  .description("List markviz servers currently running (scans ports 7331-7380)")
  .option("--host <host>", "host to scan", "127.0.0.1")
  .action(async (opts: { host: string }) => {
    const host = opts.host;
    const found: Array<{ port: number; pid: number; root: string }> = [];
    await Promise.all(
      Array.from({ length: 50 }, (_, i) => 7331 + i).map(async (p) => {
        try {
          const res = await fetch(`http://${host}:${p}/api/info`, { signal: AbortSignal.timeout(300) });
          if (!res.ok) return;
          const info = (await res.json()) as { pid?: number; root?: string };
          if (info.pid && info.root) found.push({ port: p, pid: info.pid, root: info.root });
        } catch {}
      }),
    );
    if (found.length === 0) {
      console.log("  no markviz servers running.");
      return;
    }
    console.log("");
    for (const f of found) {
      console.log(`  pid ${f.pid}  :${f.port}  ${f.root}`);
    }
    console.log("");
  });

const skills = program
  .command("skills")
  .description("Manage Claude Code skills for markviz authoring");

skills
  .command("list")
  .description("List the skills bundled with markviz")
  .action(() => {
    const src = findSkillsDir();
    if (!src) {
      console.error("markviz: skills bundle not found.");
      process.exit(1);
    }
    const dirs = listSkillDirs(src);
    console.log(`\n  markviz skills (${dirs.length}):\n`);
    for (const d of dirs) {
      const content = fs.readFileSync(path.join(src, d, "SKILL.md"), "utf8");
      const fm = /^---\n([\s\S]*?)\n---/.exec(content);
      const name = /^name:\s*(.+)$/m.exec(fm?.[1] ?? "")?.[1] ?? d;
      const desc = /^description:\s*(.+)$/m.exec(fm?.[1] ?? "")?.[1] ?? "";
      const shortDesc = desc.length > 110 ? desc.slice(0, 110) + "…" : desc;
      console.log(`  ${name}`);
      if (shortDesc) console.log(`    ${shortDesc}`);
      console.log("");
    }
  });

skills
  .command("install")
  .description("Install markviz skills for Claude Code")
  .option("--scope <scope>", "where to install: user (~/.claude) or project (./.claude)", "user")
  .option("--target <path>", "explicit target directory (overrides --scope)")
  .option("--force", "overwrite existing files without prompting")
  .action(async (opts: { scope: string; target?: string; force?: boolean }) => {
    const src = findSkillsDir();
    if (!src) {
      console.error("markviz: skills bundle not found.");
      console.error("(Internal: looked next to the CLI binary. Was markviz built with `npm run build:skills`?)");
      process.exit(1);
    }
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    let targetDir: string;
    if (opts.target) {
      targetDir = path.resolve(opts.target);
    } else if (opts.scope === "project") {
      targetDir = path.resolve(process.cwd(), ".claude", "skills");
    } else if (opts.scope === "user") {
      if (!home) {
        console.error("markviz: cannot resolve $HOME for user-scope install.");
        process.exit(1);
      }
      targetDir = path.join(home, ".claude", "skills");
    } else {
      console.error(`markviz: unknown scope "${opts.scope}". Use --scope user or --scope project.`);
      process.exit(1);
    }
    fs.mkdirSync(targetDir, { recursive: true });
    const dirs = listSkillDirs(src);
    let installed = 0;
    let skipped = 0;
    for (const d of dirs) {
      const srcSkill = path.join(src, d, "SKILL.md");
      const dstSkillDir = path.join(targetDir, d);
      const dstSkill = path.join(dstSkillDir, "SKILL.md");
      if (fs.existsSync(dstSkill) && !opts.force) {
        const a = fs.readFileSync(srcSkill, "utf8");
        const b = fs.readFileSync(dstSkill, "utf8");
        if (a === b) { skipped++; continue; }
        console.log(`  exists, skipping: ${d}  (use --force to overwrite)`);
        skipped++;
        continue;
      }
      // Remove old flat-file install if it exists
      const flatOld = path.join(targetDir, `${d}.md`);
      if (fs.existsSync(flatOld)) fs.unlinkSync(flatOld);
      copyRecursive(path.join(src, d), dstSkillDir);
      installed++;
    }
    console.log(`\n  markviz skills installed to: ${targetDir}`);
    console.log(`  ${installed} new · ${skipped} unchanged\n`);
    if (opts.scope === "user") {
      console.log(`  These skills are now available to Claude Code in every project.`);
      console.log(`  Try: launch \`claude\` anywhere and ask "make me flashcards on X".\n`);
    } else {
      console.log(`  These skills are project-local. Add a CLAUDE.md to enforce them.\n`);
    }
  });

skills
  .command("uninstall")
  .description("Remove markviz skills")
  .option("--scope <scope>", "where to remove from: user or project", "user")
  .option("--target <path>", "explicit target directory")
  .action((opts: { scope: string; target?: string }) => {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? "";
    let targetDir: string;
    if (opts.target) {
      targetDir = path.resolve(opts.target);
    } else if (opts.scope === "project") {
      targetDir = path.resolve(process.cwd(), ".claude", "skills");
    } else {
      targetDir = path.join(home, ".claude", "skills");
    }
    if (!fs.existsSync(targetDir)) {
      console.log("  no skills directory at " + targetDir);
      return;
    }
    let removed = 0;
    for (const f of fs.readdirSync(targetDir)) {
      if (!f.startsWith("markviz-")) continue;
      const p = path.join(targetDir, f);
      const stat = fs.statSync(p);
      if (stat.isDirectory() && fs.existsSync(path.join(p, "SKILL.md"))) {
        rmrf(p);
        removed++;
      } else if (stat.isFile() && f.endsWith(".md")) {
        // Old flat-file install
        fs.unlinkSync(p);
        removed++;
      }
    }
    console.log(`  removed ${removed} markviz skill(s) from ${targetDir}`);
  });

program.parseAsync().catch((err) => {
  console.error(err);
  process.exit(1);
});
