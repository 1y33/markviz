---
name: markviz-deep-research
description: Use when the user asks for "deep research" / "research notes on X" / "deep dive on Y" / "research and summarize Z" / "investigate <topic>" and the project looks like a markviz notes folder (presence of `.markviz/`, `examples/research/`, or .md files with wikilinks). Orchestrates a careful multi-phase research workflow that produces 5-10 dense, verifiable markdown notes plus relevant PDFs imported into the project. NOT for one-off summaries of a single paper — that's `markviz-paper-digest`. NOT for quick flashcards — that's `markviz-flashcards`. This is the "spend 30-60 minutes producing a small library of notes on a topic" workflow.
---

# markviz — deep research skill

You are running a **deep research session** for the user. The output is a small, dense set of markdown notes in a markviz project, optionally accompanied by PDFs. The user reads these later. **Verifiability is the highest priority** — every non-trivial claim must be traceable to a source the user can audit.

This skill defines the protocol. Follow each phase in order.

---

## Phase 0 — Topic clarification (max 3 questions)

Before doing anything else: **read the project state** and **ask the user at most 3 short clarifying questions**.

**Read project state:**
1. Glob `**/*.md` in the project root (especially `research/`, `notes/`, `papers/`). Read titles + first 10 lines of any file whose name is related to the topic. This tells you what they already have.
2. Check for `papers/` or any folder with `.pdf` files. Knowing whether they have papers on disk shapes what "research" means.
3. Check for `CLAUDE.md` in the working dir and the root — there may be project-specific conventions.
4. If there's a `idea.txt`, `TODO.md`, or `roadmap.md`, read it. This shapes what's relevant.

**Then ask clarifying questions, but ONLY if the answer would change the output.** Examples of good questions:
- *"Do you want me to focus on theory (math, derivations) or practice (implementations, benchmarks)?"*
- *"Is this for understanding a paper you already have (X.pdf), or for finding new directions?"*
- *"How deep — survey-level (broad, shallow) or focused (one sub-topic, deep)?"*
- *"Are there papers, blog posts, or code repos you've already read that I should treat as 'known'?"*

**Do NOT ask:**
- Anything you can derive from reading the project
- Questions where any answer leads to the same output
- More than 3 questions total

If the user provides the topic with enough specificity (e.g. "deep dive on TVM scheduling primitives"), you can skip the clarifying step entirely. Use judgment.

---

## Phase 1 — Plan

Write the plan to `research/{topic-slug}/plan.md`. Format:

```markdown
# Research plan: {topic}

> Started {YYYY-MM-DD}. Scope: {one sentence}.

## What I'll deliver

- `index.md` — nomenclature + cross-refs to every digest
- 5-10 `{author-year}.md` digests, one per source
- `questions.md` — open questions, contradictions, things I couldn't verify
- PDFs in this folder for anything I import from arXiv

## Method

1. {one line on search strategy}
2. {one line on triage criteria}
3. {one line on what makes a "good" digest here}

## Known unknowns

- {what could go wrong}
- {what I might miss}
```

Keep the plan to ~150 words. The user reads it to decide if you're on the right track. **Don't pad.**

After writing the plan, **stop and confirm** with the user only if the topic is ambiguous. Otherwise proceed.

---

## Phase 2 — Discovery

Find candidate sources. Strategies, in priority order:

1. **arXiv via WebSearch** — for ML/CS/math/physics, search `site:arxiv.org "{topic keywords}"`. Pull out arxiv IDs.
2. **Semantic Scholar via WebFetch** — `https://api.semanticscholar.org/graph/v1/paper/search?query={topic}&limit=20&fields=title,authors,year,abstract,externalIds,openAccessPdf`. Better than arXiv for breadth (covers conference proceedings, journals).
3. **General web search** — when the topic is engineering-flavored (a library, a system, a framework), search blog posts, GitHub READMEs, conference talks.
4. **Local context** — re-read the project's existing `research/` notes for terms you don't recognize; sometimes the user has already curated half of what you need.

Aim for **15-30 candidates** at this phase. Don't filter yet.

Write candidates to `research/{topic-slug}/_candidates.md` as a working scratch file (you can delete it at the end):
```markdown
- [arXiv:2305.12345] "Title" — Author1, Author2 (year). Why interesting: {one phrase}.
- [SS:abc123]        "Title" — Author. {phrase}.
- [blog]             "Title" — https://… {phrase}.
```

---

## Phase 3 — Triage

Cut the candidates down to **8-12 keepers**. Criteria:

- **Diversity**: avoid 5 follow-ups of the same paper. Want a mix: foundational + concurrent + recent.
- **Pertinence**: prefer the ones whose abstracts directly answer the user's question.
- **Acquirability**: if a paper is paywalled and has no open PDF, you can still digest the abstract — but mark it clearly as "abstract-only".

Update `_candidates.md` to keep only the keepers (with a `✓` mark) and a note for each on why it stayed.

---

## Phase 4 — Acquire PDFs (when relevant)

For each arXiv-keeper, **use markviz's bulk import endpoint**:

```
POST /api/arxiv/import
{ "id": "{arxiv-id}", "subdir": "research/{topic-slug}", "filename": "{author-year}.pdf" }
```

Use `curl` (the user's markviz server runs at `http://127.0.0.1:7331` by default — check `markviz list` if unsure). Server sanitizes paths and prevents traversal.

For non-arXiv sources (blog posts, repos), just keep the URL — you won't import them, you'll cite them in the digest.

---

## Phase 5 — Digest each source

For each keeper, write `research/{topic-slug}/{author-year}.md` using the **paper digest template** from `markviz-paper-digest` if you have it, or this minimal version:

```markdown
# {Short title or main idea}

> {One-sentence takeaway.}

**Authors:** {names}
**Year:** {year}
**Link:** [arXiv:{id}](https://arxiv.org/abs/{id}) · also [`./{author-year}.pdf`](./{author-year}.pdf)

#paper #{topic-tag}

## The problem
{2-3 sentences. What was broken before this work?}

## The key idea
{2-4 sentences. The novel contribution in plain language. Include the central equation if there is one.}

## How it works
{The mechanism. 1-2 paragraphs. Math here if needed.}

## Quotes
> {literal quote from the paper}
> — p. {N}

{2-4 quotes that anchor your claims above. These are gold for verifiability.}

## Why this matters for {topic}
{1 paragraph connecting this work to the user's research question.}

## Connections

- [[other-keeper]] — relation
- [[topic-index]] — back to the nomenclature

## Flashcards (3-5)

\`\`\`flashcards
Q: ...
A: ...
\`\`\`
```

**Verifiability rules:**
1. **Every numerical claim or technical assertion must either quote the source or be marked `[unverified]`**. No exceptions.
2. If the abstract is all you have (paywalled), put `**Abstract-only digest**` at the top of the file and only assert what's in the abstract.
3. Quotes go in a `## Quotes` section with page references. Use real page numbers from the PDF, not made-up ones. If unsure, write `p. ?` and move on.

Each digest should be **300-700 words**. Dense. Concrete. No filler.

---

## Phase 6 — Synthesize

Write `research/{topic-slug}/index.md`:

```markdown
# {Topic}

> {One-paragraph executive summary. The takeaway someone could read in 30 seconds.}

#research #{topic-tag}

## Nomenclature

| Term | Means | Source |
|------|-------|--------|
| {term} | {2-line definition} | [[author-year]] |
| ...  | ...   | ...    |

## Map of the landscape

{2-3 paragraphs. The shape of the field. What threads exist. Where the boundaries are. Use wikilinks: [[author-year]], [[other]].}

## Key claims (with citations)

- {Claim 1.} [[author-year]] p. {N}.
- {Claim 2.} [[other]] p. {M}.
- {Claim 3.} {website} [unverified].
- ...

(Aim for 8-15 claims. Each is one sentence. Each has a citation or `[unverified]`.)

## Practical recommendations

1. {Action item the user could take next.}
2. {Another.}
3. {Another.}

## All digests

- [[vaswani-2017]] — Attention Is All You Need
- [[devlin-2018]] — BERT
- ...
```

**This is the file the user will spend the most time on.** Optimize for scanning. Bullet points beat paragraphs. Tables beat lists when comparing.

---

## Phase 7 — Open questions

Write `research/{topic-slug}/questions.md`:

```markdown
# Open questions on {topic}

> Things I couldn't resolve, contradictions between sources, follow-up directions.

## Unresolved

- {Question}. Source: {what made me ask}.
- ...

## Contradictions

- [[paper-A]] claims X. [[paper-B]] claims not-X. {1 sentence on the disagreement}.

## Worth reading next

- {Paper or topic} — because {reason}.
```

This file is what makes the research **verifiable**. The user sees exactly where the limits of your investigation are.

---

## Phase 8 — Cleanup + report

1. Delete `_candidates.md`.
2. Write a final user-facing summary (in the chat, NOT a file): one paragraph + a bullet list of what got produced. End with: *"Open `research/{topic-slug}/index.md` in markviz to read."*

---

## Universal rules

- **Concrete over redundant.** Don't write "this paper introduces an important concept" — name the concept and explain it.
- **Wikilinks for concepts, not URLs.** Use `[[transformer]]` for the concept. Use `[arXiv:1706.03762](https://arxiv.org/abs/1706.03762)` for the source.
- **No invented page numbers.** Either you have the PDF and can verify, or write `p. ?` and move on.
- **No claims about future work.** "This paper inspired X" is a claim that needs a source. Skip it if you can't cite.
- **Follow markviz markdown conventions** from `.claude/skills/markviz/SKILL.md` (KaTeX math, fenced code blocks, mermaid diagrams, flashcards format, etc).
- **Don't pad word counts.** A 300-word digest that's dense is better than a 700-word one that's diluted.

## When NOT to use this skill

- The user asked a quick factual question — answer directly, don't spin up a research session.
- The user wants a single paper digested — use `markviz-paper-digest`.
- The user is asking you to write code — use a coding skill.
- The user wants flashcards only — use `markviz-flashcards`.
- You don't have the tools to search the web (no WebSearch/WebFetch) — say so and offer to digest only what they explicitly hand you.
