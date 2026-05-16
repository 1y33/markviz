---
name: markviz-paper-digest
description: Use when the user gives you a paper, a paper title, or asks for related-work research on a topic. Search the web for the canonical paper + closely-related work, then output a markviz-formatted note that combines (1) the core idea, (2) the key math, (3) working code that illustrates the idea, (4) connections to adjacent work via wikilinks, and (5) flashcards. Code-oriented and concept-oriented, not literature-review style. Trigger when the user says "explain this paper", "make notes on X paper", "what papers should I read about Y", or drops a PDF/arXiv link.
---

# Paper digest skill for markviz

The user uses this skill to feed papers in bulk and get back **operational understanding** — markviz notes that mix concepts with runnable code, not literature-review summaries.

## What to produce

**One markviz note per paper** (or per closely-related cluster of papers). Each note should let the user:

1. Understand the core idea in 60 seconds (the elevator pitch)
2. See the key math (the formula(s) the paper is really about)
3. Read working code that captures the idea — preferably runnable with the `python-run` block
4. Navigate to related work via `[[wikilinks]]`
5. Quiz themselves on what they read

## Process

### 1. Find the paper

If the user gives you a title, search for the canonical version (arXiv preferred). Verify:
- Authors
- Year
- arXiv ID or DOI
- Abstract (so you ground the digest in the actual paper, not your prior)

### 2. Find related work

Before writing, identify 3-7 related papers using web search:
- Earlier papers the target builds on (prerequisites)
- Concurrent work attacking the same problem
- Follow-up papers that extended or contradicted it
- Survey papers that contextualize the topic

These become wikilinks. **Use `WebSearch` and `WebFetch` tools liberally** — accuracy matters more than speed.

### 3. Extract the core math

What is the *one equation* the paper is really about? Write it in KaTeX. Derive or motivate it in 2-3 sentences.

If the paper has multiple key equations (e.g. forward + backward pass), include each as a block math.

### 4. Write working code

For ML papers, write a minimal PyTorch or JAX (or numpy) implementation of the key operation. Use a `python-run` block when feasible so the user can hit Run.

For systems papers, write a small simulation or trace.

For theory papers, write code that demonstrates the bound/invariant numerically.

**Code rules:**
- < 40 lines per block — minimal, not production
- Self-contained — no external dependencies the user has to install
- Show the *operation*, not the wrapper class hierarchy
- Use real numbers in the example, not abstract names

### 5. Cross-reference

Every concept that has its own paper or note gets a `[[wikilink]]`. Don't worry if the target doesn't exist yet — unresolved links signal future notes to write. The user *wants* unresolved links.

### 6. Flashcards

5-10 cards covering:
- The problem the paper solves
- The key insight / mechanism
- The math (one card per equation)
- Failure modes / where it doesn't work
- How it relates to predecessors / successors

## Output template

```markdown
# {Paper short name or main idea}

> {One-sentence: what's the takeaway?}

**Authors:** {names}
**Year:** {year}
**Link:** [arXiv:XXXX.XXXXX](https://arxiv.org/abs/XXXX.XXXXX)

#paper #{primary-topic}

## The problem

{What was broken before this paper? 2-3 sentences.}

## The idea

{The core insight in plain language. 2-4 sentences. Optionally with a quick block math equation.}

## Math

$$
{key equation}
$$

{Brief derivation or motivation — 2-4 sentences. Explain each symbol.}

## Code — the idea in {N} lines

```python-run
import torch
import torch.nn.functional as F

# minimal implementation
def operation(x, ...):
    # ...
    return result

# concrete demo
x = torch.randn(3, 4)
print(operation(x, ...))
```

## Why it works

{The non-obvious thing — 1-2 paragraphs on the trick or insight. Reference specific places in the math if helpful.}

## Failure modes

- {When it doesn't work — concrete}
- {What it can't do}
- {Trade-offs vs alternatives}

## Related

- [[prerequisite-paper-1]] — what this builds on
- [[prerequisite-paper-2]]
- [[concurrent-work]] — different approach to the same problem
- [[follow-up]] — what came next
- [[survey-or-tutorial]] — context

## Flashcards

```flashcards
Q: What problem does {paper} solve?
A: ...

Q: What's the key equation?
A: ...

Q: Why does the {sqrt scaling / residual / etc.} matter?
A: ...

Q: How does {paper} differ from {prior work}?
A: ...

(more cards...)
```
```

## Example — what a real digest looks like

Brief skeleton of what you'd produce for "Attention is All You Need":

```markdown
# Attention is all you need

> Replace recurrence with attention — get faster training, better long-range dependencies, and the foundation of modern NLP.

**Authors:** Vaswani et al.
**Year:** 2017
**Link:** [arXiv:1706.03762](https://arxiv.org/abs/1706.03762)

#paper #ml #transformers #foundational

## The problem

RNNs (LSTM, GRU) processed sequences serially — position $t$ had to wait for $t-1$. This made long sequences slow to train and hard to learn dependencies in (vanishing gradients, even with gating). Convolutions parallelize but have bounded receptive field per layer.

## The idea

Replace recurrence entirely with **scaled dot-product attention**. Every position attends to every other position in one matmul — fully parallel, constant path length between any two tokens. Stack this with residuals and feed-forwards.

## Math

$$
\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V
$$

Queries $Q \in \mathbb{R}^{n \times d_k}$ compare against keys $K \in \mathbb{R}^{m \times d_k}$ → similarity scores → softmax weights over values $V \in \mathbb{R}^{m \times d_v}$. The $\sqrt{d_k}$ scaling keeps softmax in a non-saturated regime.

## Code — attention in 6 lines

```python-run
import torch
import torch.nn.functional as F

def attention(q, k, v):
    scores = q @ k.transpose(-2, -1) / (q.size(-1) ** 0.5)
    weights = F.softmax(scores, dim=-1)
    return weights @ v

q = torch.randn(2, 4, 8)
k = torch.randn(2, 6, 8)
v = torch.randn(2, 6, 16)
out = attention(q, k, v)
print(out.shape)  # (2, 4, 16)
```

## Why it works

[... details ...]

## Failure modes

- $O(n^2)$ in sequence length — fine for 4k tokens, painful at 100k. Inspired all the sub-quadratic variants.
- No inherent position info — needs explicit positional encoding or rotary/ALiBi.
- Softmax saturation when $d_k$ is large without scaling.

## Related

- [[neural-machine-translation-rnn]] — what this replaced
- [[seq2seq-with-attention]] — Bahdanau attention, the precursor
- [[scaled-dot-product-derivation]] — why the $\sqrt{d_k}$
- [[mamba]] — sub-quadratic alternative
- [[flash-attention]] — efficient implementation
- [[positional-encoding]] — sinusoidal, learned, RoPE, ALiBi
- [[multi-head-attention]] — the variant actually used

## Flashcards

```flashcards
Q: What is the attention formula?
A: $\text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$

Q: Why divide by sqrt(d_k)?
A: Without scaling, dot products grow with $d_k$. Softmax saturates → gradients vanish. Dividing by $\sqrt{d_k}$ keeps variance at unit scale.

Q: What's the time complexity of attention in sequence length n?
A: $O(n^2 d)$ for both memory and compute. This is the main scaling limit.

Q: How does attention's path length compare to RNNs?
A: Attention: $O(1)$ — every position is one matmul away. RNN: $O(n)$ — must traverse the recurrence.

(more cards)
```
```

## What to AVOID

- **Don't summarize the abstract.** The user has read it. Add value beyond restating.
- **Don't list every section of the paper.** Pick the 1-2 ideas that matter.
- **Don't quote without commentary.** If you cite, explain why it matters.
- **Don't say "the authors propose..."** — just state the idea.
- **Don't include experimental tables.** The user doesn't need MNIST accuracies. They need the *mechanism*.
- **Don't write "Future work" sections.** Move that to `[[wikilinks]]` to unresolved notes.

## When the user dumps multiple papers

If the user gives you 5 papers at once:
1. Make one note per paper using the template above
2. Make one **hub note** named `{topic}-survey.md` that links to all of them
3. In the hub, write a 1-2 sentence positioning of each paper relative to the others
4. Use wikilinks heavily — these papers form a cluster in the user's graph view

## Search hygiene

When using `WebSearch` / `WebFetch`:
- Cite arXiv IDs when available
- For very famous papers, also check Wikipedia for context
- When confident, write `[arXiv:XXXX.XXXXX](https://arxiv.org/abs/XXXX.XXXXX)` even without re-verifying — but flag low-confidence claims
- If the user gives a PDF URL, fetch it and ground the digest in the actual content, not your prior
