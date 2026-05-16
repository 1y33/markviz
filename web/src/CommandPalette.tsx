import { useEffect, useMemo, useRef, useState } from "react";
import { IconSearch, IconFileText, IconClose, IconHash } from "./icons";

interface SearchHit {
  path: string;
  title: string;
  score: number;
  snippet: string;
  line: number;
}

interface Props {
  files: string[];
  recentFiles: string[];
  currentPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

type Mode = "files" | "content";

export function CommandPalette({ files, recentFiles, currentPath, onSelect, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("files");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Content search (debounced)
  useEffect(() => {
    if (mode !== "content" || query.trim().length < 2) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=20`);
        const data = await res.json();
        setHits(data.results ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 180);
    return () => window.clearTimeout(handle);
  }, [query, mode]);

  // Files mode: fuzzy filter
  const fileMatches = useMemo(() => {
    if (mode !== "files") return [];
    const q = query.trim().toLowerCase();
    if (!q) {
      // Empty query — show recent files, then everything else
      const recent = recentFiles.filter((p) => files.includes(p));
      const rest = files.filter((p) => !recent.includes(p) && p !== currentPath);
      return [...recent, ...rest].slice(0, 30);
    }
    // Fuzzy: every char of q must appear in path in order
    const scored: Array<{ path: string; score: number }> = [];
    for (const f of files) {
      const lower = f.toLowerCase();
      // exact substring boost
      const idx = lower.indexOf(q);
      if (idx >= 0) {
        scored.push({ path: f, score: 100 - idx });
        continue;
      }
      // fuzzy
      let qi = 0;
      let matched = 0;
      let consecutive = 0;
      let maxConsecutive = 0;
      for (let i = 0; i < lower.length && qi < q.length; i++) {
        if (lower[i] === q[qi]) {
          matched++;
          qi++;
          consecutive++;
          maxConsecutive = Math.max(maxConsecutive, consecutive);
        } else {
          consecutive = 0;
        }
      }
      if (qi === q.length) {
        scored.push({ path: f, score: matched + maxConsecutive * 2 });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30).map((s) => s.path);
  }, [files, recentFiles, query, mode, currentPath]);

  const items = mode === "files" ? fileMatches : hits.map((h) => h.path);

  useEffect(() => {
    setSelected(0);
  }, [query, mode]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${selected}"]`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(items.length - 1, s + 1));
      }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(0, s - 1));
      }
      else if (e.key === "Enter") {
        e.preventDefault();
        const target = items[selected];
        if (target) {
          onSelect(target);
        }
      }
      else if (e.key === "Tab") {
        e.preventDefault();
        setMode((m) => (m === "files" ? "content" : "files"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [items, selected, onSelect, onClose]);

  return (
    <div className="modal palette-modal" onClick={onClose}>
      <div className="palette-card" onClick={(e) => e.stopPropagation()}>
        <div className="palette-header">
          <span className="palette-icon"><IconSearch size={15} /></span>
          <input
            ref={inputRef}
            type="text"
            placeholder={mode === "files" ? "Find file by name…" : "Search file contents…"}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="palette-modes">
            <button
              className={`mode-tab ${mode === "files" ? "is-active" : ""}`}
              onClick={() => setMode("files")}
              title="Files (Tab)"
            >
              <IconFileText size={12} /> Files
            </button>
            <button
              className={`mode-tab ${mode === "content" ? "is-active" : ""}`}
              onClick={() => setMode("content")}
              title="Content (Tab)"
            >
              <IconHash size={12} /> Content
            </button>
          </div>
          <button className="iconbtn ghost" onClick={onClose} title="Close (Esc)">
            <IconClose size={14} />
          </button>
        </div>

        <div className="palette-list" ref={listRef}>
          {mode === "files" && fileMatches.length === 0 && (
            <div className="palette-empty">No files match.</div>
          )}
          {mode === "content" && query.length < 2 && (
            <div className="palette-empty">Type at least 2 characters to search content.</div>
          )}
          {mode === "content" && query.length >= 2 && hits.length === 0 && !searching && (
            <div className="palette-empty">No matches.</div>
          )}
          {mode === "content" && searching && <div className="palette-empty">Searching…</div>}

          {mode === "files" && fileMatches.map((path, i) => {
            const isRecent = recentFiles.includes(path) && !query;
            const name = path.split("/").pop() ?? path;
            const dir = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
            return (
              <button
                key={path}
                data-idx={i}
                className={`palette-item ${selected === i ? "is-selected" : ""}`}
                onMouseEnter={() => setSelected(i)}
                onClick={() => onSelect(path)}
                title={path}
              >
                <IconFileText size={13} />
                <span className="palette-name">{name}</span>
                {dir && <span className="palette-dim">{dir}</span>}
                {isRecent && <span className="palette-badge">recent</span>}
              </button>
            );
          })}

          {mode === "content" && hits.map((hit, i) => (
            <button
              key={hit.path + hit.line}
              data-idx={i}
              className={`palette-item palette-hit ${selected === i ? "is-selected" : ""}`}
              onMouseEnter={() => setSelected(i)}
              onClick={() => onSelect(hit.path)}
              title={hit.path}
            >
              <IconFileText size={13} />
              <div className="palette-hit-body">
                <div className="palette-hit-top">
                  <span className="palette-name">{hit.title}</span>
                  <span className="palette-dim">{hit.path}:{hit.line}</span>
                </div>
                <div className="palette-snippet">
                  {highlightSnippet(hit.snippet, query)}
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="palette-footer">
          <span><kbd>↑</kbd>/<kbd>↓</kbd> navigate</span>
          <span><kbd>Enter</kbd> open</span>
          <span><kbd>Tab</kbd> switch mode</span>
          <span><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

function highlightSnippet(snippet: string, query: string): React.ReactNode {
  const q = query.trim().toLowerCase();
  if (!q) return snippet;
  const out: React.ReactNode[] = [];
  const lower = snippet.toLowerCase();
  let last = 0;
  let idx = lower.indexOf(q);
  while (idx !== -1) {
    if (idx > last) out.push(snippet.slice(last, idx));
    out.push(
      <mark key={idx}>{snippet.slice(idx, idx + q.length)}</mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(q, last);
  }
  if (last < snippet.length) out.push(snippet.slice(last));
  return out;
}
