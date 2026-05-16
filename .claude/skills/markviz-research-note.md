---
name: markviz-research-note
description: Use when the user asks for research notes, study notes, or "help me understand X" written as markdown. Outputs a single markviz-formatted .md file using the full feature set (wikilinks, math, diagrams, code, flashcards). Use specifically when the user is in research/learning mode — not for product specs, design docs, or casual writing.
---

# Writing research notes for markviz

When the user wants to learn or research a topic, output a complete markviz-formatted note. This skill specifies the **shape** of that output.

## Output shape

```markdown
# {Topic — clear, specific, no fluff}

> {One-sentence elevator pitch — what the reader takes away after 10 minutes.}

#{primary-tag} #{secondary-tag}

## The core idea

{The single most important insight. 2-4 sentences. Math or diagram if natural.}

## {Mechanics / Derivation / How it works}

{The detailed explanation. Use math, code, diagrams. Length: ~200-400 words.}

## {Examples / Intuition / Concrete cases}

{1-3 worked examples. This is where the user *feels* the idea. Don't skip this section.}

## {Variations / Open questions / What's next}

{Brief — what generalizations exist, what's still unsolved, what to read after this.}

## Related

- [[adjacent-concept-1]]  — what this depends on
- [[adjacent-concept-2]]  — what builds on this
- [[unresolved-future-note]]  — what you might write next

## Flashcards

```flashcards
Q: ...
A: ...
(6-10 cards covering the core ideas)
```
```

## Length target

**400-700 words of prose**, plus math/code/diagrams as needed. If the topic is bigger, split into multiple notes linked with `[[wikilinks]]` and create a hub note.

## Mandatory features when applicable

| Topic involves... | Use this |
|-------------------|----------|
| A formula | Block math `$$...$$` with derivation |
| An algorithm | A working code block in the most natural language |
| A process / pipeline | Mermaid flowchart |
| A state machine | Mermaid state diagram |
| Comparison of N things | Markdown table |
| A worked example | Step-by-step with intermediate values shown |
| Anything quiz-worthy | Flashcards block at the end |

## Tone

- **Direct.** "X is Y." Not "X can be thought of as a kind of Y." 
- **First principles, not authority.** Don't say "experts agree" — show *why*.
- **Active voice.** "Gradient descent updates parameters" not "Parameters are updated by gradient descent."
- **No hedging.** "This is hard" beats "This can be somewhat challenging in certain cases."
- **Show your work in math.** Don't just state the formula; derive or motivate it.

## What to avoid

- Don't start with "In this note we will..." — just start.
- Don't end with "I hope this helps!" or "Let me know if..." — finish with content.
- Don't write motivational fluff about why the topic matters — get to it.
- Don't restate the question. The user knows what they asked.
- Don't add a TL;DR — that's what the elevator-pitch blockquote at the top is for.

## Example output for "explain attention"

```markdown
# Attention mechanism

> Attention is a soft, differentiable lookup — given a query, score it against keys, and use those scores as weights over values.

#ml #transformers #foundations

## The core idea

Given a *query* vector $q$, you compare it against a set of *key* vectors $k_i$ to get similarity scores. The scores become weights over corresponding *value* vectors $v_i$. The output is a weighted sum:

$$
\text{attn}(q, K, V) = \sum_i \text{softmax}(q \cdot k_i / \sqrt{d_k}) \, v_i
$$

This replaces a hard lookup ("retrieve the value at index i") with a smooth one — every value contributes, weighted by relevance.

## Why this works

[... continues with derivation, intuition, code, examples ...]

## Variations

- **Multi-head attention** — run the operation in parallel with different projections of $Q$, $K$, $V$. Each head can specialize.
- **Cross-attention** vs **self-attention** — queries can come from a different sequence than keys/values.
- **Causal attention** — mask out future positions to enforce autoregressive generation.

## Related

- [[transformers]]
- [[scaled-dot-product]]
- [[positional-encoding]]
- [[linear-attention]] — sub-quadratic alternatives

## Flashcards

```flashcards
Q: What is the attention formula?
A: $\text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$

Q: Why divide by $\sqrt{d_k}$?
A: ...

... etc
```
```

## When the user gives a vague topic

If the user asks for "notes on transformers" without specifying scope, ask **once** whether they want a hub note (overview + links to sub-notes) or a focused single-note treatment. Don't assume. Don't write a giant note that should be 5.
