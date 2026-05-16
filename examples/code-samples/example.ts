// markviz also opens non-markdown files.
// This TypeScript source is rendered with full syntax highlighting.

import { readFile } from "node:fs/promises";

interface NoteIndex {
  path: string;
  title: string;
  tags: string[];
}

export async function indexNotes(root: string, paths: string[]): Promise<NoteIndex[]> {
  const out: NoteIndex[] = [];
  for (const p of paths) {
    const content = await readFile(`${root}/${p}`, "utf8");
    const title = extractTitle(content) ?? p;
    const tags = extractTags(content);
    out.push({ path: p, title, tags });
  }
  return out;
}

function extractTitle(md: string): string | null {
  const match = /^#\s+(.+?)\s*$/m.exec(md);
  return match?.[1] ?? null;
}

function extractTags(md: string): string[] {
  return Array.from(md.matchAll(/#([\w-]+)/g))
    .map((m) => m[1])
    .filter((t) => !/^\d+$/.test(t)); // skip pure numbers
}
