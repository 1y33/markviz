import { useEffect, useState, useCallback, useRef } from "react";
import { browse, reroot, type BrowseEntry } from "./api";
import {
  IconFolder,
  IconFolderOpen,
  IconChevronLeft,
  IconClose,
  IconCheck,
  IconBookOpen,
} from "./icons";

interface Props {
  currentRoot: string;
  home: string;
  recent: string[];
  onClose: () => void;
  onOpened: (root: string) => void;
  onAddRecent: (path: string) => void;
}

export function FolderPicker(props: Props) {
  const { currentRoot, home, recent, onClose, onOpened, onAddRecent } = props;
  const [cwd, setCwd] = useState<string>(currentRoot);
  const [pathInput, setPathInput] = useState<string>(currentRoot);
  const [items, setItems] = useState<BrowseEntry[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [mdCount, setMdCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionIdx, setSuggestionIdx] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const navigate = useCallback(async (p?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await browse(p);
      setCwd(data.path);
      setPathInput(data.path);
      setItems(data.items);
      setParent(data.parent);
      setMdCount(data.mdCount);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Autocomplete: when typing in the path box, suggest matching subdirs of the
  // current path's parent. Browse the deepest existing directory of the input
  // and filter its children by the remaining text.
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [resolvedPrefix, setResolvedPrefix] = useState<string>("");
  const acTimer = useRef<number | null>(null);
  useEffect(() => {
    if (acTimer.current) window.clearTimeout(acTimer.current);
    if (!showSuggestions) return;
    acTimer.current = window.setTimeout(async () => {
      // Find the deepest existing dir in pathInput
      let input = pathInput.trim();
      if (!input) input = home;
      // Replace ~ with home
      if (input.startsWith("~")) input = home + input.slice(1);
      // Get parent dir + filter prefix
      let dir = input;
      let prefix = "";
      if (!input.endsWith("/")) {
        const lastSlash = input.lastIndexOf("/");
        if (lastSlash > 0) {
          dir = input.slice(0, lastSlash);
          prefix = input.slice(lastSlash + 1).toLowerCase();
        }
      } else {
        dir = input.replace(/\/+$/, "") || "/";
      }
      try {
        const data = await browse(dir);
        const matches = data.items
          .filter((i) => i.name.toLowerCase().startsWith(prefix))
          .map((i) => i.path)
          .slice(0, 10);
        setSuggestions(matches);
        setResolvedPrefix(dir);
      } catch {
        setSuggestions([]);
      }
    }, 120);
    return () => {
      if (acTimer.current) window.clearTimeout(acTimer.current);
    };
  }, [pathInput, showSuggestions, home]);

  useEffect(() => {
    navigate(currentRoot);
  }, [navigate, currentRoot]);

  const open = useCallback(async (target: string) => {
    setOpening(true);
    setError(null);
    try {
      await reroot(target);
      onAddRecent(target);
      onOpened(target);
    } catch (e: unknown) {
      setError((e as Error).message);
      setOpening(false);
    }
  }, [onAddRecent, onOpened]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIdx(0);
  }, [items]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-folder-idx="${selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Reset suggestion index when suggestions change
  useEffect(() => {
    setSuggestionIdx(0);
  }, [suggestions]);

  // Scroll active suggestion into view
  useEffect(() => {
    const el = suggestionsRef.current?.querySelector(`[data-sugg-idx="${suggestionIdx}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [suggestionIdx]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target?.matches?.("input, textarea") ?? false;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Backspace" && parent && !inInput) {
        e.preventDefault();
        navigate(parent);
        return;
      }
      // Arrow navigation through folder list — only when NOT typing in input
      if (e.key === "ArrowDown" && !inInput) {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp" && !inInput) {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter" && !inInput) {
        e.preventDefault();
        // Ctrl+Enter or Cmd+Enter = open the highlighted folder as new root.
        // Plain Enter = drill INTO it (browse).
        const target = items[selectedIdx];
        if (!target) {
          // Empty list — open current cwd
          if (e.ctrlKey || e.metaKey) open(cwd);
          return;
        }
        if (e.ctrlKey || e.metaKey) {
          open(target.path);
        } else {
          navigate(target.path);
        }
        return;
      }
      if (e.key === "ArrowRight" && !inInput) {
        e.preventDefault();
        const target = items[selectedIdx];
        if (target) navigate(target.path);
        return;
      }
      if (e.key === "ArrowLeft" && !inInput) {
        e.preventDefault();
        if (parent) navigate(parent);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cwd, parent, items, selectedIdx, navigate, open, onClose]);

  const submitPath = useCallback(() => {
    let p = pathInput.trim();
    if (p.startsWith("~")) p = home + p.slice(1);
    if (!p) return;
    navigate(p);
    setShowSuggestions(false);
  }, [pathInput, home, navigate]);

  const onPathKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.min(suggestions.length - 1, i + 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggestionIdx((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const target = suggestions[suggestionIdx];
        if (e.ctrlKey || e.metaKey) {
          open(target);
        } else {
          navigate(target);
        }
        return;
      }
      if (e.key === "Tab") {
        e.preventDefault();
        setPathInput(suggestions[suggestionIdx] ?? suggestions[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setShowSuggestions(false);
        return;
      }
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        open(pathInput.trim().replace(/^~/, home));
      } else {
        submitPath();
      }
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card folder-picker" onClick={(e) => e.stopPropagation()}>
        <div className="folder-picker-header">
          <h2>Open folder</h2>
          <button className="iconbtn ghost" onClick={onClose} title="Close (Esc)">
            <IconClose size={14} />
          </button>
        </div>

        <div className="folder-picker-toolbar">
          <button
            className="iconbtn"
            disabled={!parent}
            onClick={() => parent && navigate(parent)}
            title="Up (Backspace)"
          >
            <IconChevronLeft size={14} /> Up
          </button>
          <button className="iconbtn" onClick={() => navigate(home)} title="Home">
            <IconFolderOpen size={14} /> Home
          </button>
          <button className="iconbtn" onClick={() => navigate("/")} title="Root">
            /
          </button>
          <button className="iconbtn" onClick={() => navigate(currentRoot)} title="Current root">
            Current
          </button>
        </div>

        <div className="folder-picker-path">
          <div className="path-input-wrap">
            <input
              type="text"
              className="path-input"
              value={pathInput}
              onChange={(e) => { setPathInput(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={onPathKey}
              placeholder="Type a path…"
              spellCheck={false}
            />
            {mdCount > 0 && (
              <span className="path-stats">{mdCount} md here</span>
            )}
            {showSuggestions && suggestions.length > 0 && (
              <div className="path-suggestions" ref={suggestionsRef}>
                {suggestions.map((s, i) => (
                  <button
                    key={s}
                    data-sugg-idx={i}
                    className={`path-suggestion ${suggestionIdx === i ? "is-active" : ""}`}
                    onMouseEnter={() => setSuggestionIdx(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      navigate(s);
                    }}
                  >
                    {s.startsWith(resolvedPrefix + "/")
                      ? <><span className="dim">{resolvedPrefix}/</span>{s.slice(resolvedPrefix.length + 1)}</>
                      : s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        <div className="folder-picker-body">
          <div className="folder-list" ref={listRef}>
            {loading ? (
              <div className="empty">Loading…</div>
            ) : items.length === 0 ? (
              <div className="empty">No subfolders</div>
            ) : (
              items.map((it, i) => (
                <button
                  key={it.path}
                  data-folder-idx={i}
                  className={`folder-item ${it.mdCount > 0 ? "has-md" : ""} ${selectedIdx === i ? "is-selected" : ""}`}
                  onMouseEnter={() => setSelectedIdx(i)}
                  onClick={() => navigate(it.path)}
                  onDoubleClick={() => open(it.path)}
                  title={it.path}
                >
                  <IconFolder size={14} />
                  <span className="name">{it.name}</span>
                  {it.mdCount > 0 && (
                    <span className="md-badge" title={`${it.mdCount} markdown file${it.mdCount === 1 ? "" : "s"}`}>
                      {it.mdCount}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>

          {recent.length > 0 && (
            <aside className="folder-recent">
              <div className="recent-title">RECENT</div>
              {recent.map((r) => (
                <button
                  key={r}
                  className={`recent-item ${r === currentRoot ? "is-current" : ""}`}
                  onClick={() => navigate(r)}
                  onDoubleClick={() => open(r)}
                  title={r}
                >
                  <IconBookOpen size={13} />
                  <span className="name">{basename(r)}</span>
                  <span className="dim">{dirname(r)}</span>
                </button>
              ))}
            </aside>
          )}
        </div>

        <div className="folder-picker-footer">
          <div className="footer-hint">
            <kbd>↑</kbd>/<kbd>↓</kbd> select · <kbd>→</kbd>/<kbd>Enter</kbd> enter ·
            <kbd>←</kbd>/<kbd>⌫</kbd> up · <kbd>Ctrl+Enter</kbd> open as root ·
            <kbd>Esc</kbd> cancel
          </div>
          <div className="footer-actions">
            <button className="iconbtn" onClick={onClose}>Cancel</button>
            <button
              className="iconbtn primary"
              disabled={opening || cwd === currentRoot}
              onClick={() => open(cwd)}
            >
              <IconCheck size={14} /> Open this folder
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function basename(p: string): string {
  const parts = p.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "/";
}
function dirname(p: string): string {
  const parts = p.split("/").filter(Boolean);
  return "/" + parts.slice(0, -1).join("/");
}
