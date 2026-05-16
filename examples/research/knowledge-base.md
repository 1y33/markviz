# Knowledge base — wikilinks demo

This page is the entry point of a small interconnected knowledge base. It uses **wikilinks** in `[[double-brackets]]` syntax to reference other notes.

Press <kbd>g</kbd> at any time to see the **knowledge graph** view.

## Core ideas

The fundamentals you'll encounter often:

- [[transformers]] — the architecture that ate ML
- [[algorithms]] — classical CS reference
- [[showcase-diagrams|Diagrams and artifacts]] — Mermaid + HTML embeds
- [[showcase-flashcards]] — turn notes into quizzes

You can also write `[[target|alias]]` to use a different label, like [[transformers|Attention is all you need]].

## Tags

Tags use `#hashtag` syntax and become clickable: this note is tagged #ml and #reference. Try clicking one.

## Heading anchors in wikilinks

You can deep-link to a section: [[transformers#Multi-head attention]].

## Unresolved links

If you write a wikilink to a note that doesn't exist, like [[future-note-about-rlhf]], it appears with a dashed border — a placeholder to remind you to write that note next.

## Cross-reference graph

The graph view (<kbd>g</kbd>) shows:

- **Solid lines** for `[file.md](relative.md)` links
- **Accent lines** for `[[wikilinks]]`
- **Node size** scales with degree (how many other notes reference this one)
- Click any node to jump there
- Drag nodes to rearrange; wheel to zoom; click empty space to pan

## How Claude should use this

Conventions for generating linked notes:

```flashcards
Q: What wikilink syntax does markviz support?
A: `[[name]]`, `[[name|alias]]`, `[[name#heading]]`, and they can combine.

Q: When should Claude use a wikilink vs a relative .md link?
A: Wikilink for *conceptual* references ("this depends on [[attention]]"), relative link for *navigational* references ("see [the full guide](./full-guide.md)").

Q: How do unresolved wikilinks render?
A: With a dashed border and muted color — they signal future notes to write.

Q: What does pressing `g` do?
A: Opens the knowledge graph view showing all notes and their cross-references.
```
