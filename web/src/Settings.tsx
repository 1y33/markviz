import { useEffect, useState } from "react";
import { IconClose } from "./icons";
import { fetchDailyTemplate, saveDailyTemplate } from "./api";
import type { ReadingOverlay } from "./types";

interface Props {
  // Current state — passed down from App.
  zoom: number;
  onSetZoom: (z: number) => void;
  overlay: ReadingOverlay;
  onSetOverlay: (o: ReadingOverlay) => void;
  minimapOpen: boolean;
  onSetMinimapOpen: (v: boolean) => void;
  sidebarOpen: boolean;
  onSetSidebarOpen: (v: boolean) => void;
  splitOpen: boolean;
  onSetSplitOpen: (v: boolean) => void;
  // Studio + theme handles.
  onOpenThemeStudio: () => void;
  themeName: string;
  // Lifecycle.
  onClose: () => void;
}

type Section = "appearance" | "reading" | "editor" | "daily" | "files" | "shortcuts" | "about";

const SECTIONS: { id: Section; label: string }[] = [
  { id: "appearance", label: "Appearance" },
  { id: "reading", label: "Reading" },
  { id: "editor", label: "Editor" },
  { id: "daily", label: "Daily notes" },
  { id: "files", label: "Files" },
  { id: "shortcuts", label: "Shortcuts" },
  { id: "about", label: "About" },
];

const OVERLAYS: { value: ReadingOverlay; label: string; description: string }[] = [
  { value: "off", label: "Off", description: "No filter — themes as designed." },
  { value: "night", label: "Night (warm)", description: "Warm + slightly dim, easy late-evening reading." },
  { value: "sepia", label: "Sepia", description: "Aged-paper tint over the whole interface." },
  { value: "dim", label: "Dim", description: "Lower brightness without any color shift." },
  { value: "high-contrast", label: "High contrast", description: "Punchier saturation + contrast — bright sunlight reads." },
];

export function Settings(props: Props) {
  const [section, setSection] = useState<Section>("appearance");
  const [dailyTemplate, setDailyTemplate] = useState("");
  const [dailyLoaded, setDailyLoaded] = useState(false);
  const [dailySaveMsg, setDailySaveMsg] = useState<string | null>(null);

  useEffect(() => {
    if (section === "daily" && !dailyLoaded) {
      fetchDailyTemplate()
        .then((r) => setDailyTemplate(r.template ?? ""))
        .finally(() => setDailyLoaded(true));
    }
  }, [section, dailyLoaded]);

  const saveDaily = async () => {
    setDailySaveMsg(null);
    try {
      await saveDailyTemplate(dailyTemplate);
      setDailySaveMsg("Saved.");
      setTimeout(() => setDailySaveMsg(null), 1200);
    } catch (e: unknown) {
      setDailySaveMsg((e as Error).message);
    }
  };

  return (
    <div className="modal" onClick={props.onClose}>
      <div className="modal-card settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="iconbtn ghost" onClick={props.onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>

        <div className="settings-layout">
          <nav className="settings-nav">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                className={`settings-nav-item ${section === s.id ? "is-active" : ""}`}
                onClick={() => setSection(s.id)}
              >
                {s.label}
              </button>
            ))}
          </nav>

          <div className="settings-body">
            {section === "appearance" && (
              <div className="settings-section">
                <h3>Appearance</h3>
                <p className="settings-hint">
                  Theme and typography are controlled via the Theme dropdown
                  in the topbar. Open the studio to tweak colors, fonts, and
                  spacing for the active theme.
                </p>
                <div className="settings-row">
                  <label>Current theme</label>
                  <div className="settings-value">
                    <code>{props.themeName}</code>
                    <button className="settings-btn" onClick={props.onOpenThemeStudio}>Open theme studio…</button>
                  </div>
                </div>
                <div className="settings-row">
                  <label>UI zoom</label>
                  <div className="settings-value">
                    <input
                      type="range"
                      min={0.6}
                      max={2.5}
                      step={0.05}
                      value={props.zoom}
                      onChange={(e) => props.onSetZoom(Number(e.target.value))}
                    />
                    <span className="settings-num">{Math.round(props.zoom * 100)}%</span>
                  </div>
                </div>
                <div className="settings-row">
                  <label>Sidebar visible by default</label>
                  <Toggle value={props.sidebarOpen} onChange={props.onSetSidebarOpen} />
                </div>
                <div className="settings-row">
                  <label>Minimap visible</label>
                  <Toggle value={props.minimapOpen} onChange={props.onSetMinimapOpen} />
                </div>
              </div>
            )}

            {section === "reading" && (
              <div className="settings-section">
                <h3>Reading</h3>
                <p className="settings-hint">
                  Overlays adjust the entire window — both markdown view and PDF canvases — without touching your theme.
                </p>
                <div className="settings-overlays">
                  {OVERLAYS.map((o) => (
                    <button
                      key={o.value}
                      className={`settings-overlay ${props.overlay === o.value ? "is-active" : ""}`}
                      onClick={() => props.onSetOverlay(o.value)}
                    >
                      <span className={`overlay-swatch overlay-swatch-${o.value}`} />
                      <div>
                        <div className="settings-overlay-name">{o.label}</div>
                        <div className="settings-overlay-desc">{o.description}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {section === "editor" && (
              <div className="settings-section">
                <h3>Editor</h3>
                <p className="settings-hint">
                  Editor split mode and editor zoom persist automatically as
                  you use them. Press <kbd>Ctrl</kbd>+<kbd>/</kbd> while
                  editing to cycle between source / split / preview.
                </p>
                <div className="settings-row">
                  <label>Open split view on demand</label>
                  <Toggle value={props.splitOpen} onChange={props.onSetSplitOpen} />
                </div>
                <p className="settings-hint" style={{ marginTop: 18 }}>
                  Tip: type <code>[[</code> in the editor to autocomplete a
                  wikilink against any note or PDF in the index. Arrow keys
                  to navigate, Enter to insert.
                </p>
              </div>
            )}

            {section === "daily" && (
              <div className="settings-section">
                <h3>Daily notes</h3>
                <p className="settings-hint">
                  <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd> opens
                  today's note at <code>daily/YYYY-MM-DD.md</code>. The
                  template below seeds new notes. Placeholders:{" "}
                  <code>{"{{date}}"}</code> · <code>{"{{long-date}}"}</code> ·{" "}
                  <code>{"{{weekday}}"}</code> · <code>{"{{year}}"}</code>{" "}
                  · <code>{"{{month}}"}</code> · <code>{"{{day}}"}</code>.
                </p>
                <textarea
                  className="daily-template-editor"
                  style={{ minHeight: 240 }}
                  value={dailyTemplate}
                  onChange={(e) => setDailyTemplate(e.target.value)}
                  spellCheck={false}
                  disabled={!dailyLoaded}
                  placeholder={dailyLoaded ? "" : "Loading template…"}
                />
                <div className="theme-studio-actions" style={{ marginTop: 12 }}>
                  {dailySaveMsg && <span className="daily-template-msg">{dailySaveMsg}</span>}
                  <div style={{ flex: 1 }} />
                  <button className="primary" onClick={saveDaily} disabled={!dailyLoaded}>
                    Save template
                  </button>
                </div>
              </div>
            )}

            {section === "files" && (
              <div className="settings-section">
                <h3>Files</h3>
                <p className="settings-hint">
                  markviz only serves files inside the root folder you opened.
                  Right-click a file in the sidebar to rename, duplicate,
                  move, or delete it. Folders also support "new file here" and
                  "new folder".
                </p>
                <ul className="settings-bullets">
                  <li><kbd>n</kbd> — create a new note (asks for filename)</li>
                  <li><kbd>a</kbd> — import an arXiv paper (single or bulk)</li>
                  <li>alt-click — open file in the right pane</li>
                  <li>Live reload — saved files update in markviz automatically</li>
                </ul>
              </div>
            )}

            {section === "shortcuts" && (
              <div className="settings-section">
                <h3>Keyboard shortcuts</h3>
                <table className="kbd-table">
                  <tbody>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>P</kbd></td><td>Quick file open</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></td><td>Full-text search</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd></td><td>Toggle sidebar</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>M</kbd></td><td>Toggle minimap</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>\</kbd></td><td>Toggle split view</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>E</kbd></td><td>Edit / view current file</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Save in editor</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>D</kbd></td><td>Today's daily note</td></tr>
                    <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd></td><td>Print / save as PDF</td></tr>
                    <tr><td><kbd>n</kbd></td><td>New note</td></tr>
                    <tr><td><kbd>a</kbd></td><td>Import arXiv paper</td></tr>
                    <tr><td><kbd>f</kbd></td><td>Cycle focus mode</td></tr>
                    <tr><td><kbd>j</kbd> / <kbd>k</kbd></td><td>Next / previous file</td></tr>
                    <tr><td><kbd>g</kbd></td><td>Knowledge graph</td></tr>
                    <tr><td><kbd>s</kbd></td><td>Study flashcards</td></tr>
                    <tr><td><kbd>m</kbd></td><td>Mark as read</td></tr>
                    <tr><td><kbd>o</kbd></td><td>Open another folder</td></tr>
                  </tbody>
                </table>
              </div>
            )}

            {section === "about" && (
              <div className="settings-section">
                <h3>About markviz</h3>
                <p className="settings-hint">
                  A local-first markdown viewer + light note-taking tool
                  built for AI-generated research notes. Everything lives in
                  plain files on your disk.
                </p>
                <ul className="settings-bullets">
                  <li>Markdown + KaTeX + Mermaid + Plotly + Vega-Lite + Pyodide-runnable Python</li>
                  <li>PDF rendering with text selection, chapter outline, page deep-links</li>
                  <li>arXiv single + bulk import</li>
                  <li>Split view, wikilink autocomplete, sessions/bookmarks</li>
                  <li>Configurable themes + reading overlays + daily notes</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      className={`settings-toggle ${value ? "is-on" : ""}`}
      onClick={() => onChange(!value)}
      aria-pressed={value}
    >
      <span className="settings-toggle-knob" />
    </button>
  );
}
