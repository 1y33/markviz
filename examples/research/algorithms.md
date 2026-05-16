# Algorithms grab-bag

Reference notes — the things you forget every time you implement them.

## Binary search

The textbook version everyone gets wrong:

```python
def binary_search(arr, target):
    lo, hi = 0, len(arr) - 1   # inclusive on both ends
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1
```

Time complexity: $O(\log n)$. Invariant: if `target` is in `arr`, it's in `arr[lo..hi]` (inclusive).

The half-open version with `lo < hi` is easier to reason about for "find leftmost insertion point":

```python
def lower_bound(arr, target):
    lo, hi = 0, len(arr)        # hi is exclusive
    while lo < hi:
        mid = (lo + hi) // 2
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid
    return lo
```

## Master theorem (one-line version)

For $T(n) = a T(n/b) + f(n)$:

- If $f(n) = O(n^{\log_b a - \epsilon})$, then $T(n) = \Theta(n^{\log_b a})$
- If $f(n) = \Theta(n^{\log_b a})$, then $T(n) = \Theta(n^{\log_b a} \log n)$
- If $f(n) = \Omega(n^{\log_b a + \epsilon})$ and regular, then $T(n) = \Theta(f(n))$

Examples:

| Recurrence | $a$ | $b$ | $f(n)$ | Solution |
|:-----------|:---:|:---:|:-------|:---------|
| Merge sort: $T(n) = 2T(n/2) + n$ | 2 | 2 | $n$ | $\Theta(n \log n)$ |
| Binary search: $T(n) = T(n/2) + 1$ | 1 | 2 | $1$ | $\Theta(\log n)$ |
| Strassen: $T(n) = 7T(n/2) + n^2$ | 7 | 2 | $n^2$ | $\Theta(n^{\log_2 7})$ |

## Union-find (DSU)

The path-compression + union-by-rank version. Near-constant amortized.

```python
class DSU:
    def __init__(self, n):
        self.parent = list(range(n))
        self.rank = [0] * n

    def find(self, x):
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]  # path compression
            x = self.parent[x]
        return x

    def union(self, a, b):
        ra, rb = self.find(a), self.find(b)
        if ra == rb:
            return False
        if self.rank[ra] < self.rank[rb]:
            ra, rb = rb, ra
        self.parent[rb] = ra
        if self.rank[ra] == self.rank[rb]:
            self.rank[ra] += 1
        return True
```

Amortized cost per operation: $O(\alpha(n))$ where $\alpha$ is the inverse Ackermann function — effectively constant for any $n$ that fits in the universe.

## Dynamic programming — the recipe

1. **State**: what's the smallest amount of information you need to know to make the next decision?
2. **Transition**: given the state, what choices do you have, and what state do they leave you in?
3. **Base case**: the smallest state(s) with a trivially known answer.
4. **Order**: in what order do you fill states such that each depends only on already-filled ones?

Example: longest common subsequence.

$$
\text{LCS}(i, j) = \begin{cases}
0 & \text{if } i = 0 \text{ or } j = 0 \\
\text{LCS}(i-1, j-1) + 1 & \text{if } a_i = b_j \\
\max(\text{LCS}(i-1, j), \text{LCS}(i, j-1)) & \text{otherwise}
\end{cases}
$$

## Heaps in a sentence

A heap is "the array $a$ where $a[i] \le a[2i+1]$ and $a[i] \le a[2i+2]$" (for min-heap). That's the whole data structure — everything else is bookkeeping.
