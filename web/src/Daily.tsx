import { useEffect, useState } from "react";
import { fetchDailyTemplate, fetchIndex, saveDailyTemplate, saveFile } from "./api";
import { IconClose } from "./icons";

// Helpers — also used directly by App.tsx for the Ctrl+Shift+D shortcut.

export function todayDailyPath(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `daily/${yyyy}-${mm}-${dd}.md`;
}

function defaultTemplate(): string {
  return `# {{date}}

> Daily note — {{weekday}}.

## Focus

-

## Notes

-

## Read / watched

-

## Tomorrow

-
`;
}

function fillTemplate(template: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const iso = `${yyyy}-${mm}-${dd}`;
  const weekday = d.toLocaleDateString(undefined, { weekday: "long" });
  const long = d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  return template
    .replace(/\{\{date\}\}/g, iso)
    .replace(/\{\{long-date\}\}/g, long)
    .replace(/\{\{weekday\}\}/g, weekday)
    .replace(/\{\{year\}\}/g, String(yyyy))
    .replace(/\{\{month\}\}/g, mm)
    .replace(/\{\{day\}\}/g, dd);
}

// Create the daily note for today if it doesn't already exist. Returns the
// path (relative to root) that the caller should open.
export async function ensureDailyNote(): Promise<string> {
  const path = todayDailyPath();
  // Check the file index — if it's already there, just open it.
  try {
    const idx = await fetchIndex();
    if (idx.files.includes(path)) return path;
  } catch {
    // ignore; we'll try to create regardless.
  }
  const t = await fetchDailyTemplate();
  const body = fillTemplate(t.template ?? defaultTemplate());
  await saveFile(path, body);
  return path;
}

interface PromptProps {
  onClose: () => void;
}

// A small modal that lets the user edit the daily-note template stored
// server-side. Opened from a "Configure template" link.
export function DailyTemplateEditor({ onClose }: PromptProps) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetchDailyTemplate()
      .then((r) => setValue(r.template ?? defaultTemplate()))
      .finally(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      await saveDailyTemplate(value);
      setMsg("Saved.");
      setTimeout(onClose, 600);
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card daily-template" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>Daily-note template</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
        <p className="theme-studio-hint">
          Saved to <code>.markviz/daily-template.md</code>. Placeholders:{" "}
          <code>{"{{date}}"}</code> · <code>{"{{long-date}}"}</code> ·{" "}
          <code>{"{{weekday}}"}</code> · <code>{"{{year}}"}</code> ·{" "}
          <code>{"{{month}}"}</code> · <code>{"{{day}}"}</code>.
        </p>
        <textarea
          className="daily-template-editor"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          disabled={!loaded}
        />
        <div className="theme-studio-actions">
          <button onClick={onClose}>Cancel</button>
          {msg && <div className="daily-template-msg">{msg}</div>}
          <button className="primary" onClick={save} disabled={saving || !loaded}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// A lightweight intermediate prompt: shown if the user hits Ctrl+Shift+D for
// the first time in a session — it confirms the path that will be created
// and gives a quick "Configure template…" link. After confirmation it just
// opens the note (creating it if needed).
export function DailyNotePrompt({ onClose, onOpen, onEditTemplate }: { onClose: () => void; onOpen: (path: string) => void; onEditTemplate: () => void }) {
  const path = todayDailyPath();
  const today = new Date();
  const long = today.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric", weekday: "long" });
  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card daily-prompt" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>Today's note</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
        <p className="daily-long-date">{long}</p>
        <p className="theme-studio-hint">
          Will open <code>{path}</code>, creating it from your template if it
          doesn't exist yet.
        </p>
        <div className="theme-studio-actions">
          <button onClick={onEditTemplate}>Edit template…</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose}>Cancel</button>
          <button
            className="primary"
            onClick={async () => {
              try {
                const p = await ensureDailyNote();
                onOpen(p);
              } catch {
                // fall through — caller closes the prompt anyway.
                onClose();
              }
            }}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
