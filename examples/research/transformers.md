# Transformers: a self-contained note

A working-memory file. The kind of thing you'd ask Claude to draft and then read in markviz.

## The core idea

Attention is a soft, differentiable lookup. Given a *query* $q$, you compare it to a set of *keys* $k_i$, get a similarity score, and use those scores as weights over corresponding *values* $v_i$.

In matrix form, for $Q \in \mathbb{R}^{n \times d_k}$, $K \in \mathbb{R}^{m \times d_k}$, $V \in \mathbb{R}^{m \times d_v}$:

$$
\text{Attention}(Q, K, V) = \text{softmax}\!\left(\frac{Q K^\top}{\sqrt{d_k}}\right) V
$$

The $\sqrt{d_k}$ scaling keeps the softmax in a regime where gradients aren't vanishing.

## Multi-head attention

Run $h$ attention operations in parallel with different learned projections, then concatenate.

$$
\text{MultiHead}(Q, K, V) = \text{Concat}(\text{head}_1, \ldots, \text{head}_h) \, W^O
$$

where each $\text{head}_i = \text{Attention}(Q W^Q_i, K W^K_i, V W^V_i)$.

The point: each head can specialize. One might track syntactic agreement; another, long-range coreference.

## A minimal implementation

```python
import torch
import torch.nn.functional as F

def attention(q, k, v, mask=None):
    """
    q, k: (B, H, T, d_k)
    v:    (B, H, T, d_v)
    """
    scores = q @ k.transpose(-2, -1) / (q.size(-1) ** 0.5)
    if mask is not None:
        scores = scores.masked_fill(mask == 0, float("-inf"))
    weights = F.softmax(scores, dim=-1)
    return weights @ v, weights
```

That's it. Five lines for the operation that re-shaped NLP.

## Why it scaled

Three properties, all useful for accelerators:

1. **Parallelism**: unlike RNNs, the operation over a sequence has no sequential dependency — every position attends to every other position in one matmul.
2. **Constant path length**: information flows from position $i$ to position $j$ in one layer. RNNs need $|i - j|$ steps.
3. **Hardware-friendly**: dominated by dense matmuls, which is exactly what GPUs and TPUs are built for.

## Open questions worth chasing

- **Sub-quadratic alternatives** (Mamba, RWKV, linear attention) — can they match Transformers at frontier scale?
- **Tokenization-free** models — BLT, byte-latent. What does grokking look like at byte level?
- **Implicit reasoning** — chain-of-thought is explicit; can latent reasoning emerge from architecture alone?

## See also

- [`algorithms.md`](algorithms.md) — for the classical algorithms transformers replaced
- [`../guides/math.md`](../guides/math.md) — for KaTeX syntax reference
