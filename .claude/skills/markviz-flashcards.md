---
name: markviz-flashcards
description: Use when the user wants to generate flashcards for studying a topic. Use whenever the user says "make flashcards", "quiz me on X", "give me cards for X". Outputs a single .md file (or appends to one) with cards in markviz's flashcard format, ready to study with the `s` keyboard shortcut in markviz.
---

# Flashcard generation for markviz

When the user asks for flashcards, generate them in markviz's flashcard format so they can be studied directly.

## Output format

Default to a standalone `.md` file with this structure:

```markdown
# Flashcards: {topic}

Brief 1-2 sentence intro of what this set covers.

#tag1 #tag2

## Cards

```flashcards
Q: ...
A: ...

Q: ...
A: ...
```

## Related notes
- [[adjacent-topic-1]]
- [[adjacent-topic-2]]
```

If the user is adding cards to an existing note, just append the fenced ```flashcards block at the end.

## Card-writing rules

### 1. One concept per card

❌ Bad:
```
Q: What are the four steps of gradient descent?
A: 1) compute loss 2) backprop 3) update params 4) repeat
```

✓ Good — four cards:
```
Q: What's the first step of gradient descent?
A: Compute the loss on a batch — the forward pass.

Q: What does backpropagation compute?
A: The gradient of the loss with respect to each parameter, via chain rule.

Q: How are parameters updated in gradient descent?
A: $\theta \leftarrow \theta - \eta \nabla_\theta L$ where $\eta$ is the learning rate.

Q: Why is gradient descent iterative?
A: Each step only reduces loss locally; many steps are needed to reach a minimum.
```

### 2. Questions test understanding, not recall

❌ Bad: "What is the formula for X?" (pure memorization)
✓ Good: "What problem does the $\sqrt{d_k}$ factor in scaled dot-product attention solve?" (tests understanding *of* the formula)

Mix both: 30% pure formulas, 70% understanding.

### 3. Answers are full thoughts

❌ Bad:
```
Q: Big-O of binary search?
A: O(log n)
```

✓ Good:
```
Q: Big-O of binary search and why?
A: $O(\log n)$ — each step halves the search space, so for $n$ items it takes $\log_2 n$ steps.
```

### 4. Use math, code, lists in answers

Answers can be rich markdown. Use it.

```
Q: What does this Python list comprehension do?
A:
```python
[x**2 for x in range(10) if x % 2 == 0]
```
Produces `[0, 4, 16, 36, 64]` — the squares of even numbers below 10.
```

### 5. Front-load fundamentals

Order matters. Put core definitions/formulas first; subtleties and edge cases last. The user studies in order until they're tired — make the first 5 the most important.

### 6. Cap at 12 per set

Past 12 cards, study fatigue kicks in and recall drops. If the topic has more than 12 cards' worth of material, split into multiple files:
- `topic-fundamentals.md` (cards 1-12)
- `topic-deep-dive.md` (cards 13-24)
- Link them as `[[topic-deep-dive]]` from the fundamentals note.

### 7. Tags

Add `#tag:` lines inside the block:
```
```flashcards
Q: ...
A: ...
#tag: ml, optimization
```
```

Tags will be used for filtering and cross-vault search.

## Reference example — a great flashcard set

```markdown
# Flashcards: Eigenvalues & eigenvectors

The core of linear algebra at the heart of PCA, spectral graph theory, and quantum mechanics.

#linear-algebra #math-foundations

## Cards

```flashcards
Q: What defines an eigenvector?
A: A non-zero vector $v$ such that $Av = \lambda v$ for some scalar $\lambda$ (the eigenvalue). $A$ acts on $v$ by *scaling only* — no rotation, no shear.

Q: What does the eigenvalue tell you geometrically?
A: How much the eigenvector gets stretched ($|\lambda| > 1$) or shrunk ($|\lambda| < 1$). Negative $\lambda$ also flips direction.

Q: Why are eigenvectors of symmetric matrices special?
A: They are **orthogonal** (you can find an orthonormal eigenbasis) and the eigenvalues are **real**. This is the spectral theorem.

Q: How do you find eigenvalues?
A: Solve $\det(A - \lambda I) = 0$ — the characteristic polynomial. Roots are the eigenvalues.

Q: What is an eigendecomposition?
A: $A = Q \Lambda Q^{-1}$ where $Q$ has eigenvectors as columns and $\Lambda$ is diagonal of eigenvalues. For symmetric $A$, $Q^{-1} = Q^\top$.

Q: Why does PCA use eigenvectors of the covariance matrix?
A: The eigenvectors of $\Sigma$ are the directions of maximum variance. The eigenvalue tells you how much variance is along that direction. PCA = sort by eigenvalue descending, keep top-k.

Q: What's a matrix's spectral radius?
A: $\rho(A) = \max_i |\lambda_i|$ — the largest eigenvalue's magnitude. Controls things like convergence of $A^n$.

Q: When does $A^n \to 0$ as $n \to \infty$?
A: Exactly when $\rho(A) < 1$ — all eigenvalues are inside the unit circle.

Q: What's the relationship between determinant and eigenvalues?
A: $\det(A) = \prod_i \lambda_i$. A zero eigenvalue means the matrix is singular.

Q: What's the trace in terms of eigenvalues?
A: $\text{tr}(A) = \sum_i \lambda_i$. Useful sanity-check when computing eigenvalues.
```

## Related
- [[linear-algebra-foundations]]
- [[pca]]
- [[spectral-graph-theory]]
```
