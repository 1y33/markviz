# markviz

A fast, beautiful markdown viewer that runs in your browser, launched from your terminal.

Built for reading notes — the kind Claude writes for you when you ask it to research something.

## Install

From source:

```bash
git clone https://github.com/1y33/markviz
cd markviz
npm install
npm run build
npm link
```

Then install the Claude Code skills (optional but recommended):

```bash
markviz skills install
```

## Usage

```bash
markviz                    # open current directory
markviz notes/             # open a directory
markviz README.md          # open a single file
markviz --port 8080        # custom port
markviz --no-open          # don't auto-open the browser
markviz list               # show running markviz servers
markviz stop --all         # stop all running servers
markviz skills install     # install Claude Code skills (user-global)
markviz skills list        # list bundled skills
```

## Features

### Reading
- **Sidebar file tree** with fuzzy search and progress tracking
- **Mark-as-read** per directory (persisted)
- **6 themes**: dark, light, sepia, nord, solarized, dracula
- **3 focus modes**: normal, focus, **zen** (hover left edge in zen to peek sidebar)
- **Resizable** sidebar and minimap
- **Real text minimap** like VS Code — drag to scrub
- **Zoom** with hold-to-repeat buttons or Ctrl + / − / 0
- **TOC** auto-generated from headings
- **Tab title** shows the H1 of the current file

### Rendering
- **KaTeX math** — inline `$x$` and block `$$x$$`
- **Shiki syntax highlighting** — 30+ languages with line numbers and copy button
- **CUDA / GLSL / HLSL / WGSL** support
- **Mermaid diagrams** — flowchart, sequence, state, class, gantt
- **HTML artifacts** — sandboxed iframe for interactive demos
- **Runnable Python** via Pyodide — `python-run` blocks with stdout capture
- **Plotly and Vega-Lite charts** — interactive
- **GFM**: tables, task lists, footnotes, strikethrough

### Knowledge management
- **Wikilinks** — `[[concept]]`, `[[name|alias]]`, `[[name#heading]]`
- **Tags** — `#hashtag` becomes clickable
- **Unresolved links** — dashed border for notes that don't exist yet
- **Backlinks pane** — see who links to the current note
- **Knowledge graph** (press `g`) — force-directed visualization
- **Flashcards** — ` ```flashcards ` blocks or `?? Q :: A` inline
- **Spaced repetition** — SM-2 algorithm, due-today queue, stored in `.markviz/srs.json`

### Editing
- **Split editor** — source + live preview side-by-side
- **Synced scrolling** between panes
- **Save on Ctrl+S**
- **Edit mode banner** with pulsing indicator — impossible to confuse with view mode

### Search & navigation
- **Ctrl+P** — quick file open (fuzzy) + recent files
- **Ctrl+Shift+F** — full-text content search with snippet preview
- **Tab** to switch between modes
- **Linear nav** with `j` / `k`

### Lifecycle
- **Auto-shutdown** 30 seconds after the last browser tab closes
- **Reuse** — `markviz` in 5 terminals = 1 server, not 5
- **Live reload** — server watches the disk, browser updates when files change
- **markviz list / stop** for explicit control

### Folders
- **Folder picker** with editable path + tab-completion
- **Recent folders** + recent files
- **Arrow nav** through folders and autocomplete suggestions
- **Re-root** without restarting the server

### Output
- **PDF export** — Ctrl+Shift+P or the print button (clean print stylesheet)

## Claude Code skills

`markviz` ships with skills that teach Claude how to write markdown for it:

| Skill | When it triggers |
|-------|------------------|
| `markviz-author` | Any markdown destined for markviz |
| `markviz-flashcards` | "make flashcards", "quiz me on X" |
| `markviz-research-note` | "explain X", "research notes on Y" |
| `markviz-paper-digest` | Paper titles, arXiv links, "what should I read about Y" |

Install user-global (works from any project):

```bash
markviz skills install
```

Or project-local:

```bash
markviz skills install --scope project
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Ctrl+P` | Quick file open |
| `Ctrl+Shift+F` | Search file contents |
| `/` | Focus sidebar search |
| `j` / `k` | Next / previous file |
| `t` | (removed — use the theme dropdown) |
| `f` | Cycle focus mode (Normal → Focus → Zen) |
| `m` | Toggle mark-as-read |
| `o` | Open another folder |
| `g` | Knowledge graph |
| `s` | Study flashcards |
| `Ctrl+B` | Toggle sidebar |
| `Ctrl+M` | Toggle minimap |
| `Ctrl+E` | Edit current file |
| `Ctrl+S` | Save (in editor) |
| `Ctrl+Shift+P` | Print / save as PDF |
| `Ctrl+=` / `Ctrl+-` / `Ctrl+0` | Zoom in / out / reset |
| `?` | Show help |

## How it works

`markviz` is a small Node CLI that boots a local Fastify server on `127.0.0.1` and opens your browser to a React single-page app. The server only serves files inside the directory you point it at — path traversal is rejected.

State (theme, focus, read files, sidebar visibility, recent files, zoom) is persisted to `localStorage` namespaced per-root, so two different folders don't bleed state. SRS progress lives in `.markviz/srs.json` inside the root.

## License

MIT
