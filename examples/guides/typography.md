# Typography

This page demonstrates the typographic primitives markviz handles.

## Headings, six deep

# Heading level 1
## Heading level 2
### Heading level 3
#### Heading level 4
##### Heading level 5
###### Heading level 6

## Paragraph styling

This is a regular paragraph with **bold**, *italic*, ***bold italic***, ~~strikethrough~~, and `inline code`. Links look like [this](https://example.com), and *nested **emphasis** stays readable*.

Long paragraphs get an optimized measure — roughly 65–75 characters per line — so your eyes don't have to swing across a wide screen to find the start of the next line. This matters when you read 2000 words at a time.

## Lists

### Unordered

- First item
- Second item, with **bold inside**
  - Nested item
  - Another nested item
    - Going deeper still
- Third item

### Ordered

1. Wake up
2. Make coffee
3. Read markdown
4. Repeat

### Task list

- [x] Build the viewer
- [x] Render math
- [x] Highlight code
- [ ] Make coffee
- [ ] Take over the world

## Blockquote

> "The best way to predict the future is to invent it."
> — Alan Kay

> Nested blockquotes also work.
>
> > Like this.
> >
> > > And this.

## Horizontal rule

Text above.

---

Text below.

## Links

- External: [Anthropic](https://anthropic.com)
- Internal markdown: [the math guide](math.md)
- Anchor: [back to top](#typography)
- Email: [hi@example.com](mailto:hi@example.com)

## Emphasis runs

You can combine *italic*, **bold**, and `code` inline like this: the **`useState`** hook returns a *tuple of `[value, setter]`*.
