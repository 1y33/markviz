---
name: markviz-course-lesson
description: Use when the user gives you university lecture material (slides, lecture notes, PDF transcripts, syllabus excerpts, a recording transcript) and asks you to turn it into learning notes / lesson notes / study material. Triggers on "make notes from this lecture", "turn this lecture into notes", "explain this course material", "help me understand this lecture", "make me a lesson from <file>". Produces a dense, structured `.md` lesson with built-in analogies, mermaid diagrams to clarify concepts, runnable Python (Pyodide) for visualizations, KaTeX math, and flashcards for retention. Different from `markviz-paper-digest` (single research paper) and `markviz-deep-research` (multi-source survey).
---

# markviz — course lesson skill

You are turning **university lecture material** into a learning experience the user can study from inside markviz. The output is one or more dense markdown files designed to **teach**, not just summarize.

The skill is written in English. The **output should be in the language the user explicitly requests, or — if they don't specify — match the language of the source material**. Default to English if nothing is given. The structure / templates below stay the same regardless of output language; only the prose translates.

---

## Mode of use

This skill activates when the user provides lecture material and asks for *learning* notes. Distinguishing signals:

- They reference a course/class/lecture/professor (not a research paper).
- They want to *understand* a concept, not survey a field.
- They want flashcards + visual aids, not a digest with citations.

If the user instead wants a paper digest, use `markviz-paper-digest`. If they want a full multi-source survey, use `markviz-deep-research`.

---

## Phase 0 — Read the material

1. Read the source the user gave you (PDF, slides text, transcript, etc). If it's a PDF, use the `Read` tool. If you need to chunk a long PDF, read 20 pages at a time.
2. Identify: **course name**, **lecture number / topic**, **author / professor**, **prerequisites** (if mentioned), **list of concepts introduced**.
3. Survey the markviz project's existing notes — there may already be related lessons. Wikilink to them where relevant.

---

## Phase 1 — Ask 1-2 calibration questions (only if useful)

Examples of good questions:
- *"What's your current background — are you new to {topic} or have you seen the basics?"* (changes whether to spend time on analogies vs. dive deep)
- *"Do you want one consolidated lesson note, or one note per concept?"* (changes output structure)
- *"Should I produce this in {language X} or English?"* (only if ambiguous)

**Skip the question phase if the source + ask are specific enough.** Don't ask for the sake of asking.

---

## Phase 2 — Produce the lesson note

Use the **lesson template** below. Save to a sensible path:

- If the user mentions a course name: `courses/{course-slug}/{lecture-N}-{topic}.md`
- Otherwise: `lessons/{topic-slug}.md`

If the lecture covers **multiple distinct concepts**, write one file per concept and a parent `index.md` that wikilinks them.

### Lesson template

```markdown
# {Lesson title}

> {One-sentence takeaway. What will the reader know after this?}

**Course:** {course name, if any}
**Source:** {filename / link / "from lecture by X"}
**Prerequisites:** [[prereq-1]], [[prereq-2]] (or "None")

#course #{course-slug} #{topic-tag}

## Why this matters

{2-4 sentences. Real-world or downstream consequence of understanding this concept. Avoid generic motivation.}

## Core idea — in plain language

{2-3 paragraphs. Explain the concept as if to a smart friend who hasn't taken the course. Use ONE strong analogy here.}

**Analogy:** {pick ONE concrete analogy that captures the essence. Examples:
- "Backpropagation is like blaming each cook in a kitchen line for a bad dish — the closer to the end of the line, the more direct the blame."
- "A monad is a wrapper that knows how to chain operations on its contents without forcing you to unwrap."

Avoid corny multi-paragraph analogies. ONE sentence, ONE image.}

## The math (when applicable)

$$
{Central equation}
$$

{Explain each symbol in a bulleted list. Don't paste equations without explanation.}

- $X$ — {what}
- $Y$ — {what}
- {derived quantity} — {what and why this matters}

If a derivation is short and illuminating, include it. If it's tedious, skip it and link to a source.

## Visualization

Pick the *right* visual for the concept. Common choices:

### Mermaid (for relationships, flows, hierarchies)

\`\`\`mermaid
flowchart LR
  A[Input] -->|step 1| B[Transformation]
  B -->|step 2| C[Output]
\`\`\`

### Runnable Python (for plots, simulations, examples)

\`\`\`python-run
import numpy as np
import matplotlib.pyplot as plt

# {one-line comment on what we're showing}
x = np.linspace(-3, 3, 200)
y = 1 / (1 + np.exp(-x))

plt.plot(x, y)
plt.title("Sigmoid")
plt.xlabel("input"); plt.ylabel("output")
plt.grid(True)
plt.show()
\`\`\`

**Use Python sparingly and intentionally.** Each runnable block should:
1. Have one clear pedagogical goal (visualize behavior, show a concrete example, demonstrate a limit case).
2. Run in under 5 seconds on Pyodide.
3. Avoid heavy imports (no PyTorch, no Pandas if NumPy suffices).
4. Show output (a plot, a printed value, a small table).

### KaTeX inline graphics (for distributions, simple curves)
Skip these — Mermaid + Python cover the cases that matter.

## Worked example

{Pick ONE concrete worked example. Walk through it step by step. Show inputs, intermediate quantities, and outputs. The reader should be able to verify each step.}

## Common misconceptions

- **{Misconception 1}.** Why people get this wrong: {1 sentence}. The correct picture: {1-2 sentences}.
- **{Misconception 2}.** ...
- {2-4 entries total — pick the genuinely confusing things, not strawmen.}

## When to use this / when NOT to use this

| Situation | Apply this concept? |
|-----------|---------------------|
| {use case 1} | Yes — because {reason} |
| {use case 2} | No — use {alternative} instead |
| {edge case} | Caveat: {what to watch out for} |

(Skip this section if not applicable.)

## Related lessons

- [[prereq-lesson]] — needed before this
- [[sibling-lesson]] — same topic, different angle
- [[next-lesson]] — what to study after

## Practice questions

(Self-test before the flashcards — open-ended, not just memorization.)

1. {Question that tests understanding, not recall.}
2. {Question that combines this concept with a prereq.}
3. {Question about a limit case or edge.}

## Flashcards (6-12)

\`\`\`flashcards
Q: {Core definition or fact.}
A: {Concise answer — 1-3 sentences max.}

Q: {Why something works the way it does.}
A: ...

Q: {What changes when you change a parameter.}
A: ...

Q: {Common pitfall.}
A: ...
\`\`\`
```

---

## Phase 3 — Refinement rules

Apply these to *every* lesson:

### Dense, not redundant
- Cut every "in this section we will discuss..." sentence.
- Don't restate the heading in the first sentence under it.
- Prefer "the sigmoid squashes any real number to (0, 1)" over "the sigmoid function is a function that takes a real-valued input and produces a value between 0 and 1".

### Concrete over abstract
- Replace "consider the following process" with the actual process.
- Use named entities ("Alice sends Bob a message") not placeholders ("party A sends party B a message"), unless the abstraction is the point.

### Show the work for ONE thing per section
- A derivation, a worked numerical example, a code trace — pick one. Don't drown the reader in three.

### One analogy, not five
- The brain remembers vivid singular analogies. A list of analogies dilutes signal.

### Visual hierarchy
- Use bold sparingly — for the term being defined, for warnings.
- Use callouts (`> note`) only when the reader genuinely needs to pause.
- Tables for comparisons (≥3 properties × ≥2 things). Bullet lists otherwise.

### Math you can verify
- If you include a number, the reader should be able to recompute it from the formulas above.
- If you cite a result from elsewhere, mark it `[from {source}]` so it's not a free-floating claim.

---

## Phase 4 — Verify Python blocks

Before declaring done, **mentally trace each `python-run` block**:

1. Are all imports available in Pyodide? (`numpy`, `matplotlib`, `pandas`, `scipy`, `sympy` — yes. `torch`, `tensorflow`, `transformers` — no.)
2. Does it produce visible output? (`plt.show()`, `print()`, a final expression — yes. Just defining functions — no.)
3. Are there any infinite loops or huge data structures?
4. Are random seeds set for reproducibility (`np.random.seed(0)`)?

If anything fails the checks, replace it with a static description or a Mermaid diagram. **Don't ship Python that won't run.**

---

## Phase 5 — Wrap up

Tell the user, in chat (NOT in a file):

- Which file(s) you created
- A 1-sentence summary of each
- A pointer: *"Open `{path}` in markviz to start studying. Press `s` for flashcards mode."*

Don't pad. The user already saw the file appear.

---

## Multi-lecture mode

If the user supplies a whole course (`Lecture 1.pdf`, `Lecture 2.pdf`, ...):

1. Create `courses/{course-slug}/index.md` first — table of contents + prerequisites graph.
2. Process lectures one at a time. After each, link it from `index.md`.
3. Build the prereq graph in mermaid:
   ```mermaid
   flowchart TD
     L1[Lecture 1: Foundations] --> L2[Lecture 2: Calculus]
     L2 --> L3[Lecture 3: Optimization]
     L1 --> L4[Lecture 4: Probability]
     L3 & L4 --> L5[Lecture 5: ML Basics]
   ```
4. End-of-course test bank: a `courses/{slug}/exam-prep.md` with flashcards drawn from every lecture, organized by topic.

---

## Output language

Default rule: **match the source's language**, unless the user requested otherwise.

If the user said "make notes in Romanian on this English lecture", produce the prose in Romanian, but:
- Keep math notation universal (LaTeX is language-agnostic).
- Keep code identifiers in English (variable names, function names) — that's conventional.
- Keep technical terms in their original form on first mention with a translation: `gradient descent (coborârea de gradient)`.

---

## What to AVOID

- Walls of text without examples
- Multiple analogies competing for attention
- Python blocks that don't visibly do anything
- Generic motivation ("this is an important topic that has many applications…")
- Padding to look comprehensive
- Translating math notation to a different convention than the source
- Inventing facts the source didn't contain (verify against the material; if unsure, mark `[unverified]`)
- Skipping the flashcards section
