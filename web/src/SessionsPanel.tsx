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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSessions()
      .then((r) => setSessions(r.sessions ?? {}))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const persist = async (next: Record<string, SavedSession>) => {
    setSessions(next);
    try { await saveSessions({ sessions: next }); }
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
      savedAt: Date.now(),
    };
    await persist({ ...sessions, [n]: newOne });
    setSaving(false);
    setSaveName("");
  };

  const doDelete = async (name: string) => {
    const next = { ...sessions };
    delete next[name];
    await persist(next);
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
                  className="sessions-load"
                  onClick={() => onLoad(s)}
                  title={`Load: ${s.leftPath ?? "—"}${s.splitOpen ? `  ↔  ${s.rightPath ?? "—"}` : ""}`}
                >
                  <div className="sessions-name">{s.name}</div>
                  <div className="sessions-meta">
                    <span className="pane-side-tag">L</span>
                    <span className="pane-filename">{s.leftPath ?? "—"}</span>
                    {s.splitOpen && (
                      <>
                        <span className="pane-side-tag" style={{ marginLeft: 8 }}>R</span>
                        <span className="pane-filename">{s.rightPath ?? "—"}</span>
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
