# markviz skills bundle

One Claude Code skill that teaches Claude how to write markdown for markviz.

## What's in here

- **`markviz/SKILL.md`** — the canonical authoring skill. Covers general syntax, the research-note template, the flashcards-only template, and the paper-digest workflow. Activates whenever the user asks you to write markdown, generate flashcards, or digest a paper.

## Install

Project-local — these files are already in `.claude/skills/`. Claude Code picks them up when launched anywhere in this project.

Or, install user-global so they're available from any project:

```bash
markviz skills install
```

This copies the `markviz/` directory into `~/.claude/skills/`.

## How it activates

Claude reads the `description` field in `SKILL.md`'s frontmatter. When your request semantically matches that description, Claude pulls the skill content in as context for the response. You don't invoke it manually.

When you say:

- "make me flashcards on eigenvalues" → activates
- "write notes on diffusion models" → activates
- "explain arXiv:1706.03762" → activates
- "add a mermaid diagram showing the data pipeline to my notes" → activates

## Verify it's loaded

In a `claude` session:

```
/skills
```

You should see `markviz` listed under user skills.

## Update after I change SKILL.md

```bash
markviz skills install --force
```
