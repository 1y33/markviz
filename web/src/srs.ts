// Spaced Repetition System — SM-2 algorithm.
// Per-card state is keyed by a deterministic hash of (filePath + question).

export interface SrsState {
  // ease factor, starts at 2.5, decreases with bad recall
  ef: number;
  // interval in days
  interval: number;
  // consecutive correct answers (resets on wrong)
  reps: number;
  // unix ms of next due review
  due: number;
  // unix ms of last review
  last: number;
}

export interface SrsDb {
  cards: Record<string, SrsState>;
}

export function cardKey(filePath: string, question: string): string {
  // Simple stable hash — djb2
  const s = `${filePath}::${question.trim()}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `c_${(h >>> 0).toString(36)}`;
}

export function defaultState(now: number): SrsState {
  return {
    ef: 2.5,
    interval: 0,
    reps: 0,
    due: now,
    last: 0,
  };
}

// SM-2 grading. `quality` is 0-5:
//   0 = total blackout
//   3 = correct with serious difficulty
//   4 = correct with hesitation
//   5 = perfect recall
// We map our two-button UI (got it / wrong) to qualities 5 / 2.
export function grade(state: SrsState, quality: number, now: number): SrsState {
  let { ef, interval, reps } = state;
  if (quality < 3) {
    reps = 0;
    interval = 1; // re-do tomorrow
  } else {
    if (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else interval = Math.round(interval * ef);
    reps += 1;
  }
  // Update ease factor
  ef = ef + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (ef < 1.3) ef = 1.3;
  const dueMs = now + interval * 24 * 60 * 60 * 1000;
  return { ef, interval, reps, due: dueMs, last: now };
}

export function isDue(state: SrsState, now: number): boolean {
  return state.due <= now;
}

let dbCache: SrsDb | null = null;
let pendingWrite: ReturnType<typeof setTimeout> | null = null;

export async function loadDb(): Promise<SrsDb> {
  if (dbCache) return dbCache;
  try {
    const res = await fetch("/api/srs");
    const data = await res.json();
    dbCache = data && typeof data === "object" && data.cards ? data as SrsDb : { cards: {} };
  } catch {
    dbCache = { cards: {} };
  }
  return dbCache;
}

export function getDbSync(): SrsDb {
  return dbCache ?? { cards: {} };
}

export async function saveDb(db: SrsDb): Promise<void> {
  dbCache = db;
  if (pendingWrite) clearTimeout(pendingWrite);
  pendingWrite = setTimeout(() => {
    fetch("/api/srs", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(db),
    }).catch(() => {});
  }, 400);
}
