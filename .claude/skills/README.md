# markviz skills bundle

Skills for Claude Code that teach Claude how to write markdown for markviz.

## What's in here

- **`markviz-author.md`** — the canonical reference. Triggers whenever Claude writes markdown intended for markviz: syntax, conventions, what to avoid.
- **`markviz-flashcards.md`** — specifically for generating flashcard sets. Triggers on "make flashcards", "quiz me".
- **`markviz-research-note.md`** — specifically for research/study notes. Triggers when the user is learning a topic and wants a complete note.

## How to install (project-local)

These files are already in `.claude/skills/` of this project. When you launch `claude` inside this directory (or anything under it), Claude Code picks them up automatically.

## How to install (user-global)

To use these skills from any directory:

```bash
mkdir -p ~/.claude/skills
cp .claude/skills/markviz-*.md ~/.claude/skills/
```

Now any `claude` session — anywhere — can use them.

## How to install (per-project)

For each project where you want markviz-formatted notes:

```bash
mkdir -p .claude/skills
cp /path/to/markviz/.claude/skills/markviz-*.md .claude/skills/
```

## How they activate

Claude reads the `description` field in each skill's frontmatter. When the user's request matches the description (semantically), Claude pulls in the full skill content as context for that turn. You don't invoke them manually.

So when you say:

> "make me a flashcard set for eigenvalues"

→ Claude sees `markviz-flashcards` matches and uses its rules to format the output.

> "write me notes on diffusion models"

→ `markviz-research-note` activates.

> "add a mermaid diagram showing the data pipeline to my notes"

→ `markviz-author` activates (general authoring).

## Tip

If you want **all** Claude conversations in a project to default to markviz-style markdown, add a `CLAUDE.md` in the project root with one line:

```markdown
When writing markdown files, follow the markviz conventions (see .claude/skills/markviz-author.md).
```

This makes Claude consult the skill even for tangentially-related requests.
