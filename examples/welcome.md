# Welcome to markviz

> A fast, beautiful markdown viewer that runs in your browser, launched from your terminal.

This showcase demonstrates everything markviz can do. Browse the left sidebar to explore — each file highlights a different capability.

## Why markviz?

When you ask Claude (or any LLM) to research something, you get back markdown. Lots of it. Reading those notes in a plain editor wastes the rich formatting; reading them on GitHub means committing to a repo first.

markviz is for the in-between: **a local-first reader for the markdown on your disk**.

## Quick tour

| File | What it shows |
|------|---------------|
| [`guides/typography.md`](guides/typography.md) | Headings, lists, blockquotes, links |
| [`guides/code.md`](guides/code.md) | Syntax highlighting across 30+ languages |
| [`guides/math.md`](guides/math.md) | KaTeX math rendering — inline and block |
| [`guides/tables.md`](guides/tables.md) | GFM tables, task lists, footnotes |
| [`research/transformers.md`](research/transformers.md) | A realistic research note |
| [`research/algorithms.md`](research/algorithms.md) | Algorithms with proofs and code |
| [`code-samples/example.ts`](code-samples/example.ts) | TypeScript source — line numbers + copy |
| [`code-samples/saxpy.cu`](code-samples/saxpy.cu) | CUDA / C++ — GPU kernels with `__global__` |
| [`code-samples/shader.glsl`](code-samples/shader.glsl) | GLSL fragment shader |
| [`code-samples/data.json`](code-samples/data.json) | JSON config |
| [[knowledge-base]] | **Wikilinks + knowledge graph** — press <kbd>g</kbd> |
| [[showcase-flashcards]] | **Flashcards** — auto-extracted, study with <kbd>s</kbd> |
| [[showcase-diagrams]] | **Mermaid + HTML artifacts + runnable Python** |

## Try this

1. Press <kbd>?</kbd> to see all keyboard shortcuts
2. **Click the theme button** (with the palette icon) to pick from 6 themes — your choice is remembered
3. Press <kbd>f</kbd> to cycle focus modes — Normal → Focus → **Zen**. In zen, hover the left edge to peek the sidebar
4. Press <kbd>o</kbd> to **open another folder** without restarting markviz
5. Press <kbd>j</kbd> / <kbd>k</kbd> to jump between files
6. Press <kbd>m</kbd> to mark this file as read — the sidebar tracks your progress
7. Press <kbd>Ctrl+B</kbd> to hide the sidebar; <kbd>Ctrl+M</kbd> for the minimap
8. Press <kbd>Ctrl+E</kbd> to edit — opens a **split source/preview** with live updates

## Pro tips

- **Drag the sidebar edge** to resize it; drag the minimap edge too
- **Click anywhere on the minimap** to jump there — it's a real text preview, not just blocks
- **Hold +/- zoom buttons** to keep zooming. <kbd>Ctrl+=</kbd> / <kbd>Ctrl+-</kbd> / <kbd>Ctrl+0</kbd> also work
- **Browser tab title** updates to the current file's H1 — find your tab fast
- **Relative links between .md files just work** — try clicking the links above
- **Run `markviz list`** in your terminal to see active servers; **`markviz stop --all`** to clean up
- **No server zombies**: the server auto-shuts down 30 seconds after the last tab closes

## Server lifecycle

```bash
markviz                  # open current dir; reuses an existing server if one is already serving this folder
markviz /path/to/notes   # open a specific folder
markviz some-file.md     # open a single file (its parent dir becomes the root)
markviz list             # see what's running
markviz stop --all       # stop them all
```

---

Built for reading. Optimized for research. Designed to disappear in **Zen mode**.
