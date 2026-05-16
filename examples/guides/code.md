# Code highlighting

Powered by [Shiki](https://shiki.style/) — the same syntax highlighter VS Code uses. Each block has a language label and a copy button.

## TypeScript

```typescript
interface User {
  id: string;
  name: string;
  email?: string;
}

class UserStore {
  private users = new Map<string, User>();

  add(user: User): void {
    if (this.users.has(user.id)) {
      throw new Error(`Duplicate user: ${user.id}`);
    }
    this.users.set(user.id, user);
  }

  find(id: string): User | undefined {
    return this.users.get(id);
  }

  *all(): IterableIterator<User> {
    yield* this.users.values();
  }
}
```

## Python

```python
from dataclasses import dataclass
from typing import Iterator

@dataclass(frozen=True)
class Point:
    x: float
    y: float

    def distance(self, other: "Point") -> float:
        return ((self.x - other.x) ** 2 + (self.y - other.y) ** 2) ** 0.5

def nearest_neighbor(p: Point, candidates: list[Point]) -> Point:
    """Brute-force nearest-neighbor — O(n)."""
    return min(candidates, key=p.distance)
```

## Rust

```rust
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Cache<K, V> {
    map: HashMap<K, V>,
    capacity: usize,
}

impl<K: std::hash::Hash + Eq + Clone, V: Clone> Cache<K, V> {
    pub fn new(capacity: usize) -> Self {
        Self { map: HashMap::with_capacity(capacity), capacity }
    }

    pub fn get_or_insert<F: FnOnce() -> V>(&mut self, key: K, f: F) -> V {
        self.map.entry(key).or_insert_with(f).clone()
    }
}
```

## Go

```go
package main

import (
    "context"
    "fmt"
    "sync"
)

type Result struct {
    Value int
    Err   error
}

func parallel(ctx context.Context, n int) <-chan Result {
    out := make(chan Result, n)
    var wg sync.WaitGroup
    for i := 0; i < n; i++ {
        wg.Add(1)
        go func(i int) {
            defer wg.Done()
            out <- Result{Value: i * i}
        }(i)
    }
    go func() { wg.Wait(); close(out) }()
    return out
}

func main() {
    for r := range parallel(context.Background(), 5) {
        fmt.Println(r.Value)
    }
}
```

## Bash

```bash
#!/usr/bin/env bash
set -euo pipefail

backup_dir="${HOME}/backups/$(date +%Y-%m-%d)"
mkdir -p "$backup_dir"

find "$HOME/notes" -name "*.md" -mtime -7 \
  | xargs -I{} cp --parents {} "$backup_dir/"

echo "Backed up $(find "$backup_dir" -type f | wc -l) files."
```

## SQL

```sql
WITH recent_orders AS (
  SELECT
    customer_id,
    COUNT(*) AS order_count,
    SUM(total_cents) / 100.0 AS total_dollars
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY customer_id
)
SELECT c.name, r.order_count, r.total_dollars
FROM customers c
JOIN recent_orders r ON r.customer_id = c.id
WHERE r.total_dollars > 1000
ORDER BY r.total_dollars DESC
LIMIT 50;
```

## JSON & YAML

```json
{
  "name": "markviz",
  "version": "0.1.0",
  "features": ["themes", "math", "code", "search", "zen"],
  "ports": [7331]
}
```

```yaml
server:
  host: 127.0.0.1
  port: 7331
themes:
  - dark
  - light
  - sepia
  - nord
  - solarized
  - dracula
```

## Inline code

The `useState` hook returns `[value, setValue]`. Pipe with `|`, redirect with `>`, glob with `*`.
