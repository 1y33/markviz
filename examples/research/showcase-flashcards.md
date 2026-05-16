# Flashcards in markviz

This page demonstrates the **flashcards** feature. Look in the top-right corner of this page — there's a "Study" badge. Click it (or press <kbd>s</kbd>) to enter flashcard mode.

Topics covered: attention, gradients, optimization. Related: [[transformers]], [[algorithms]].

## Format for Claude

There are two ways to write flashcards. **Prefer the fenced block** for new cards — it's the format Claude should generate.

### Option 1 — fenced block (recommended)

````markdown
```flashcards
Q: What is the attention formula?
A: $\text{softmax}(QK^T/\sqrt{d_k})V$

Q: Why divide by sqrt(d_k)?
A: To keep softmax in a regime where gradients don't vanish.

Q: What does multi-head attention add?
A: Parallel heads with learned projections — each head can specialize on different patterns.
#tag: ml, transformers
```
````

### Option 2 — inline shortcut

```
?? What is the chain rule?
:: $\frac{d}{dx} f(g(x)) = f'(g(x)) \cdot g'(x)$
```

Both produce the same cards. Use inline for one-off cards mid-paragraph; use the fenced block for a quiz set at the end of a note.

---

## Live cards

```flashcards
Q: What is the attention formula?
A: $\text{softmax}\!\left(\frac{QK^\top}{\sqrt{d_k}}\right) V$

Q: Why divide by $\sqrt{d_k}$ in scaled dot-product attention?
A: To keep the softmax in a regime where gradients don't vanish. Without it, dot products grow with $d_k$, pushing softmax into saturated regions where derivatives are nearly zero.

Q: What does multi-head attention add over single-head?
A: Parallel heads with different learned projections of Q, K, V. Each head can specialize — one might track syntactic agreement, another long-range coreference — and the concat preserves all signals.

Q: Why are transformers easier to parallelize than RNNs?
A: No sequential dependency. Every position attends to every other position in **one** matmul, instead of $T$ recurrent steps.

Q: What is the path length between two positions in a single transformer layer?
A: $O(1)$ — constant. Any position can directly attend to any other.

Q: Name two sub-quadratic alternatives to standard attention.
A: Mamba (state-space models), Linear attention, RWKV, Performer, RetNet.

Q: What does a residual connection do mathematically?
A: $h_{l+1} = h_l + f(h_l)$. It lets gradients flow through the identity path, mitigating vanishing gradients in deep nets.
```

---

## Inline cards mixed with prose

You can also drop quick cards into the flow of text.

?? What is the time complexity of binary search?
:: $O(\log n)$

?? When does gradient descent converge to a local minimum vs global?
:: For convex functions, gradient descent converges to the global minimum. For non-convex (most deep nets), only a local minimum is guaranteed.

?? What's the softmax temperature parameter for?
:: Scaling logits before softmax: $\text{softmax}(x / T)$. Lower $T$ → peakier distribution; higher $T$ → more uniform. Used for sampling diversity.

---

## How Claude should use this

Claude — when you generate flashcards for a topic, follow these conventions:

1. **One concept per card.** Don't ask "what are the 7 properties of X" — make 7 cards.
2. **Answer should be a complete thought**, not a fragment. "$\sqrt{d_k}$" is bad; "the scaling factor that keeps softmax gradients alive" is good.
3. **Use LaTeX** for math (`$inline$` or `$$block$$`). KaTeX renders both sides.
4. **Use markdown** for code, bold, lists in answers.
5. **Add `#tag:`** lines inside the block for filtering (planned).
6. **Front-load the hard cards** — put fundamentals first, edge cases later.
