import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cardKey, defaultState, grade as srsGrade, isDue, loadDb, saveDb, getDbSync, type SrsState } from "./srs";

export interface Card {
  q: string;
  a: string;
  tags?: string[];
}

/**
 * Format for Claude to generate flashcards
 * ----------------------------------------
 *
 * Option 1 — fenced block (recommended for Claude):
 *
 * ```flashcards
 * Q: What is the attention formula?
 * A: $\text{softmax}(QK^T/\sqrt{d_k})V$
 *
 * Q: Why divide by sqrt(d_k)?
 * A: To keep softmax in a regime where gradients don't vanish.
 *
 * Q: What does multi-head attention add?
 * A: Parallel heads with learned projections — each can specialize.
 * #tag: ml
 * ```
 *
 * Option 2 — single-card inline syntax (shortcut):
 *
 * ?? What is the chain rule?
 * :: d/dx [f(g(x))] = f'(g(x)) · g'(x)
 *
 * Both forms are extracted automatically.
 */

const FENCE_RE = /```flashcards\s*\n([\s\S]*?)```/g;
const INLINE_RE = /^[ \t]*\?\?\s+(.+?)\n[ \t]*::\s+([\s\S]*?)(?=\n\s*\n|\n[ \t]*\?\?|\n#{1,6}\s|\Z)/gm;

export function extractCards(md: string): Card[] {
  const cards: Card[] = [];

  // Fenced blocks
  for (const m of md.matchAll(FENCE_RE)) {
    const body = m[1];
    const sectionTags: string[] = [];
    let q: string | null = null;
    let aLines: string[] = [];
    const lines = body.split("\n");
    const flush = () => {
      if (q !== null) {
        const a = aLines.join("\n").trim();
        if (a) cards.push({ q: q.trim(), a, tags: sectionTags.length ? [...sectionTags] : undefined });
      }
      q = null;
      aLines = [];
    };
    for (const line of lines) {
      const qm = /^\s*Q:\s*(.*)$/.exec(line);
      const am = /^\s*A:\s*(.*)$/.exec(line);
      const tm = /^\s*#tag:\s*(.*)$/.exec(line);
      if (qm) {
        flush();
        q = qm[1];
      } else if (am && q !== null) {
        aLines = [am[1]];
      } else if (tm) {
        sectionTags.push(...tm[1].split(",").map((s) => s.trim()).filter(Boolean));
      } else if (q !== null && aLines.length > 0) {
        aLines.push(line);
      }
    }
    flush();
  }

  // Inline ??/:: pairs (outside fenced blocks)
  // Strip fenced blocks first so we don't double-count.
  const stripped = md.replace(/```[\s\S]*?```/g, "");
  for (const m of stripped.matchAll(INLINE_RE)) {
    cards.push({ q: m[1].trim(), a: m[2].trim() });
  }

  return cards;
}

interface PaneProps {
  content: string;
  theme: "dark" | "light";
  filePath: string;
}

type StudyMode = "all" | "due";

// Inline pane that appears in the markdown view when cards are present.
export function FlashcardsBadge({ content, onStudy }: { content: string; onStudy: () => void }) {
  const cards = useMemo(() => extractCards(content), [content]);
  if (cards.length === 0) return null;
  return (
    <button className="flashcards-badge" onClick={onStudy}>
      <span className="badge-dot" />
      {cards.length} flashcard{cards.length === 1 ? "" : "s"} — Study
    </button>
  );
}

// Study modal — with spaced repetition.
export function FlashcardsStudy({ content, theme, filePath, onClose }: PaneProps & { onClose: () => void }) {
  const cards = useMemo(() => extractCards(content), [content]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [order, setOrder] = useState<number[]>([]);
  const [stats, setStats] = useState({ correct: 0, wrong: 0, done: 0 });
  const [mode, setMode] = useState<StudyMode>("due");
  const [srsReady, setSrsReady] = useState(false);
  const [srsTick, setSrsTick] = useState(0);

  // Load SRS DB once
  useEffect(() => {
    loadDb().then(() => setSrsReady(true));
  }, []);

  // Compute due cards based on SRS state
  const dueIndices = useMemo(() => {
    if (!srsReady) return [];
    const db = getDbSync();
    const now = Date.now();
    return cards
      .map((c, i) => ({ i, key: cardKey(filePath, c.q) }))
      .filter(({ key }) => {
        const st = db.cards[key];
        return !st || isDue(st, now);
      })
      .map(({ i }) => i);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, filePath, srsReady, srsTick]);

  useEffect(() => {
    const indices = mode === "due" ? dueIndices : cards.map((_, i) => i);
    setOrder(shuffle(indices));
    setIdx(0);
    setShowAnswer(false);
    setStats({ correct: 0, wrong: 0, done: 0 });
  }, [cards.length, mode, dueIndices]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); setShowAnswer((v) => !v); }
      else if (e.key === "ArrowRight" || e.key === "j") next(true);
      else if (e.key === "ArrowLeft" || e.key === "k") prev();
      else if (e.key === "y" || e.key === "Y" || e.key === "1") grade(true);
      else if (e.key === "n" || e.key === "N" || e.key === "0") grade(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, showAnswer, order.length]);

  if (cards.length === 0) return null;
  const current = cards[order[idx] ?? 0];
  const done = idx >= order.length;

  const next = (skip = false) => {
    if (skip && !showAnswer) {
      setShowAnswer(true);
      return;
    }
    setShowAnswer(false);
    setIdx((i) => i + 1);
  };
  const prev = () => {
    setShowAnswer(false);
    setIdx((i) => Math.max(0, i - 1));
  };
  const grade = (correct: boolean) => {
    setStats((s) => ({
      correct: s.correct + (correct ? 1 : 0),
      wrong: s.wrong + (correct ? 0 : 1),
      done: s.done + 1,
    }));
    // Apply SM-2 to current card
    if (current) {
      const key = cardKey(filePath, current.q);
      const db = getDbSync();
      const prev = db.cards[key] ?? defaultState(Date.now());
      const next: SrsState = srsGrade(prev, correct ? 5 : 2, Date.now());
      saveDb({ ...db, cards: { ...db.cards, [key]: next } });
      setSrsTick((n) => n + 1);
    }
    next();
  };
  const restart = () => {
    setOrder(shuffle(cards.map((_, i) => i)));
    setIdx(0);
    setShowAnswer(false);
    setStats({ correct: 0, wrong: 0, done: 0 });
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card flashcards-modal" onClick={(e) => e.stopPropagation()}>
        <div className="flashcards-header">
          <h2>Flashcards</h2>
          <div className="flashcards-mode-tabs">
            <button
              className={`mode-tab ${mode === "due" ? "is-active" : ""}`}
              onClick={() => setMode("due")}
              title="Cards scheduled by SRS for today"
            >
              Due ({dueIndices.length})
            </button>
            <button
              className={`mode-tab ${mode === "all" ? "is-active" : ""}`}
              onClick={() => setMode("all")}
              title="All cards in this note"
            >
              All ({cards.length})
            </button>
          </div>
          <div className="flashcards-progress">
            {Math.min(idx + 1, order.length)} / {order.length}
            {stats.done > 0 && (
              <span className="score">
                · <span className="ok">{stats.correct}</span> /
                <span className="bad"> {stats.wrong}</span>
              </span>
            )}
          </div>
          <button className="iconbtn ghost" onClick={onClose}>Close</button>
        </div>

        {done ? (
          <div className="flashcards-done">
            <h3>Session complete</h3>
            <p>
              You answered <strong className="ok">{stats.correct}</strong> correctly,{" "}
              <strong className="bad">{stats.wrong}</strong> wrong out of {order.length}.
            </p>
            <div className="flashcards-actions">
              <button className="iconbtn primary" onClick={restart}>Restart</button>
              <button className="iconbtn" onClick={onClose}>Done</button>
            </div>
          </div>
        ) : (
          <>
            <div className={`flashcard ${showAnswer ? "is-flipped" : ""}`} onClick={() => setShowAnswer((v) => !v)}>
              <div className="flashcard-side flashcard-q">
                <div className="flashcard-label">Question</div>
                <div className="flashcard-body">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {current.q}
                  </ReactMarkdown>
                </div>
                {!showAnswer && <div className="flashcard-tap">Click or press Space to flip</div>}
              </div>
              {showAnswer && (
                <div className="flashcard-side flashcard-a">
                  <div className="flashcard-label">Answer</div>
                  <div className="flashcard-body">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {current.a}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>

            <div className="flashcards-actions">
              <button className="iconbtn" onClick={prev} disabled={idx === 0}>‹ Previous</button>
              {!showAnswer ? (
                <button className="iconbtn primary" onClick={() => setShowAnswer(true)}>
                  Show answer (Space)
                </button>
              ) : (
                <>
                  <button className="iconbtn grade-bad" onClick={() => grade(false)}>
                    ✗ Wrong (N)
                  </button>
                  <button className="iconbtn grade-ok" onClick={() => grade(true)}>
                    ✓ Got it (Y)
                  </button>
                </>
              )}
              <button className="iconbtn ghost" onClick={() => next()}>Skip ›</button>
            </div>

            <div className="flashcards-hint">
              <kbd>Space</kbd> flip · <kbd>Y</kbd>/<kbd>N</kbd> grade · <kbd>←</kbd>/<kbd>→</kbd> nav · <kbd>Esc</kbd> close
            </div>
          </>
        )}
      </div>
    </div>
  );
  void theme; // theme prop reserved for future per-side theming
}

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
