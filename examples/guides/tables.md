# Tables & GFM extensions

GitHub-flavored markdown features.

## Basic table

| Language   | Year | Designed by              |
|------------|------|--------------------------|
| Python     | 1991 | Guido van Rossum         |
| JavaScript | 1995 | Brendan Eich             |
| Rust       | 2010 | Graydon Hoare            |
| Go         | 2009 | Griesemer, Pike, Thompson |
| TypeScript | 2012 | Anders Hejlsberg         |

## Aligned columns

| Left | Center | Right |
|:-----|:------:|------:|
| 1    |   2    |     3 |
| ten  | twenty | thirty |
| a    |   b    |     c |

## Long table

| Feature           | Status    | Notes                              |
|-------------------|-----------|------------------------------------|
| Markdown          | ready     | CommonMark + GFM                   |
| Math              | ready     | KaTeX, inline and block            |
| Code highlighting | ready     | Shiki, 30+ languages               |
| Themes            | ready     | 6 themes                           |
| Focus modes       | ready     | Normal / Focus / Zen               |
| Mark-as-read      | ready     | Persisted per-folder               |
| Minimap           | ready     | Live, draggable                    |
| Zoom              | ready     | Ctrl+= / Ctrl+- / Ctrl+0           |
| Search            | ready     | Fuzzy filtering across the tree    |
| Edit              | ready     | Built-in textarea editor           |
| Sync scroll       | future    | Editor preview side-by-side        |
| Folders pinning   | future    | Pin frequent dirs to a quick bar   |

## Footnotes

Here is a sentence with a footnote.[^1] And another.[^longer]

[^1]: Footnotes use this `[^id]` syntax.
[^longer]: They render at the bottom of the page, and you can have multiple paragraphs in them too.

## Task lists inline

Things to do:

- [x] Buy milk
- [x] Walk the dog
- [ ] Conquer the world
- [ ] Write a poem

## Strikethrough

Old: ~~we should rewrite this in Java~~
New: we should rewrite this in Rust.
