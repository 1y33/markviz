import { useEffect, useState } from "react";
import { fetchSessions, saveSessions, type SavedSession } from "./api";
import { IconClose } from "./icons";

interface Props {
  current: {
    leftPath: string | null;
    rightPath: string | null;
    splitOpen: boolean;
    splitRatio: number;
    activePane: "left" | "right";
    leftPdfPage?: number | null;
    rightPdfPage?: number | null;
    leftTabs?: string[];
    rightTabs?: string[];
  };
  onLoad: (s: SavedSession) => void;
  onClose: () => void;
}

function formatAge(ts: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function SessionsPanel({ current, onLoad, onClose }: Props) {
  const [sessions, setSessions] = useState<Record<string, SavedSession>>({});
  const [lastUsed, setLastUsed] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions()
      .then((r) => {
        setSessions(r.sessions ?? {});
        setLastUsed(r.lastUsed ?? null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: Record<string, SavedSession>, lu?: string | null) => {
    setSessions(next);
    if (lu !== undefined) setLastUsed(lu);
    try { await saveSessions({ sessions: next, lastUsed: lu !== undefined ? lu : lastUsed }); }
    catch (e: unknown) { setError((e as Error).message); }
  };

  const doSave = async () => {
    setError(null);
    const n = saveName.trim();
    if (!n) { setError("Give the session a name."); return; }
    if (n.length > 60) { setError("Names must be ≤ 60 chars."); return; }
    const newOne: SavedSession = {
      name: n,
      leftPath: current.leftPath,
      rightPath: current.rightPath,
      splitOpen: current.splitOpen,
      splitRatio: current.splitRatio,
      activePane: current.activePane,
      leftPdfPage: current.leftPdfPage ?? null,
      rightPdfPage: current.rightPdfPage ?? null,
      leftTabs: current.leftTabs ?? [],
      rightTabs: current.rightTabs ?? [],
      savedAt: Date.now(),
    };
    // Saving a session also marks it as last-used, so the next boot restores it.
    await persist({ ...sessions, [n]: newOne }, n);
    setSaving(false);
    setSaveName("");
  };

  const doDelete = async (name: string) => {
    const next = { ...sessions };
    delete next[name];
    // If the deleted one was last-used, clear lastUsed too.
    await persist(next, lastUsed === name ? null : undefined);
  };

  const doLoad = (s: SavedSession) => {
    // Persist the last-used marker so a reboot picks it up.
    persist(sessions, s.name);
    onLoad(s);
  };

  const list = Object.values(sessions).sort((a, b) => b.savedAt - a.savedAt);

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card sessions-panel" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>Sessions</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
        <p className="theme-studio-hint">
          A session captures the file in each pane + the split layout. Save
          one when you're deep in a topic; load it to pick up where you left
          off. Stored in <code>.markviz/sessions.json</code> under the root.
        </p>

        {error && <div className="arxiv-error">{error}</div>}

        {saving ? (
          <div className="theme-studio-save-row">
            <input
              type="text"
              className="arxiv-input"
              placeholder='Session name (e.g. "Transformer research")'
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doSave();
                if (e.key === "Escape") setSaving(false);
              }}
              autoFocus
            />
            <button onClick={() => setSaving(false)}>Cancel</button>
            <button className="primary" onClick={doSave}>Save</button>
          </div>
        ) : (
          <div className="sessions-current">
            <div className="sessions-current-summary">
              <span className="sessions-current-label">Current:</span>
              <span className="pane-side-tag">L</span>
              <span className="pane-filename">{current.leftPath ?? "—"}</span>
              {current.splitOpen && (
                <>
                  <span className="pane-side-tag" style={{ marginLeft: 8 }}>R</span>
                  <span className="pane-filename">{current.rightPath ?? "—"}</span>
                </>
              )}
            </div>
            <button className="primary" onClick={() => setSaving(true)}>Save current as…</button>
          </div>
        )}

        <div className="sessions-list-title">Saved sessions</div>
        {loading && <div className="loading">Loading…</div>}
        {!loading && list.length === 0 && (
          <div className="sessions-empty">
            No sessions yet. Set up a layout, then click <strong>Save current as…</strong>.
          </div>
        )}
        {list.length > 0 && (
          <ul className="sessions-list">
            {list.map((s) => (
              <li key={s.name} className="sessions-item">
                <button
                  className={`sessions-load ${s.name === lastUsed ? "is-last-used" : ""}`}
                  onClick={() => doLoad(s)}
                  title={`Load: ${s.leftPath ?? "—"}${s.splitOpen ? `  ↔  ${s.rightPath ?? "—"}` : ""}`}
                >
                  <div className="sessions-name">
                    {s.name}
                    {s.name === lastUsed && <span className="sessions-pill">last used</span>}
                  </div>
                  <div className="sessions-meta">
                    <span className="pane-side-tag">L</span>
                    <span className="pane-filename">{s.leftPath ?? "—"}</span>
                    {(s.leftTabs?.length ?? 0) > 1 && (
                      <span className="sessions-tabcount">+{(s.leftTabs?.length ?? 0) - 1} tabs</span>
                    )}
                    {s.splitOpen && (
                      <>
                        <span className="pane-side-tag" style={{ marginLeft: 8 }}>R</span>
                        <span className="pane-filename">{s.rightPath ?? "—"}</span>
                        {(s.rightTabs?.length ?? 0) > 1 && (
                          <span className="sessions-tabcount">+{(s.rightTabs?.length ?? 0) - 1} tabs</span>
                        )}
                      </>
                    )}
                    <span className="sessions-age">· {formatAge(s.savedAt)}</span>
                  </div>
                </button>
                <button
                  className="sessions-delete"
                  onClick={() => doDelete(s.name)}
                  title="Delete this session"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
