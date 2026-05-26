import { useEffect, useMemo, useState } from "react";
import { IconClose } from "./icons";
import type { BuiltinTheme, SavedTheme, Theme, ThemeCustomization } from "./types";

interface Props {
  // Active theme id (e.g. "dark" or "custom:Reading"). Used to know what base
  // we're editing on top of and whether we're editing a saved theme.
  activeTheme: Theme;
  // The base theme (a builtin) — required so the preview swatch can render
  // with the right background colors when the active theme is a custom one.
  baseTheme: BuiltinTheme;
  value: ThemeCustomization;
  onChange: (next: ThemeCustomization) => void;
  onReset: () => void;
  onClose: () => void;
  // Save / update a named theme. If `replaceName` is given, the old name is
  // removed; otherwise the new save is added.
  onSaveAs: (theme: SavedTheme, replaceName?: string) => void;
  existingSavedNames: string[];
}

const FONT_SANS_STACKS: { label: string; stack: string }[] = [
  { label: "Inter (default)", stack: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif' },
  { label: "IBM Plex Sans", stack: '"IBM Plex Sans", system-ui, sans-serif' },
  { label: "System UI", stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  { label: "Source Sans Pro", stack: '"Source Sans Pro", system-ui, sans-serif' },
  { label: "Helvetica Neue", stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
];

const FONT_SERIF_STACKS: { label: string; stack: string }[] = [
  { label: "Source Serif 4 (default)", stack: '"Source Serif 4", "Iowan Old Style", Georgia, serif' },
  { label: "EB Garamond", stack: '"EB Garamond", Garamond, Georgia, serif' },
  { label: "Iowan Old Style", stack: '"Iowan Old Style", "Palatino Linotype", Georgia, serif' },
  { label: "Georgia", stack: 'Georgia, "Times New Roman", serif' },
  { label: "Charter", stack: 'Charter, "Iowan Old Style", Georgia, serif' },
];

const FONT_MONO_STACKS: { label: string; stack: string }[] = [
  { label: "JetBrains Mono (default)", stack: '"JetBrains Mono", ui-monospace, "SF Mono", "Fira Code", Menlo, Consolas, monospace' },
  { label: "Fira Code", stack: '"Fira Code", ui-monospace, monospace' },
  { label: "Source Code Pro", stack: '"Source Code Pro", ui-monospace, monospace' },
  { label: "IBM Plex Mono", stack: '"IBM Plex Mono", ui-monospace, monospace' },
  { label: "System Monospace", stack: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace' },
];

const PRESET_ACCENTS: string[] = [
  "#4f8cff", "#0969da", "#8a4a1e", "#88c0d0", "#268bd2", "#bd93f9",
  "#fabd2f", "#7aa2f7", "#cba6f7", "#ebbcba", "#46b07c", "#f97316",
  "#e06c75", "#10b981", "#ec4899",
];

// Helpers to translate the customization back to the actual computed values we
// need for the preview pane (without touching the live document).
function previewVars(c: ThemeCustomization): React.CSSProperties {
  const out: Record<string, string> = {};
  if (c.fontSans) out["--prev-font-sans"] = c.fontSans;
  if (c.fontMono) out["--prev-font-mono"] = c.fontMono;
  if (c.fontSerif) out["--prev-font-serif"] = c.fontSerif;
  if (c.accent) out["--prev-accent"] = c.accent;
  if (c.fontSizePx) out["--prev-font-size"] = `${c.fontSizePx}px`;
  if (c.lineHeight) out["--prev-line-height"] = String(c.lineHeight);
  return out as React.CSSProperties;
}

export function ThemeStudio({
  activeTheme,
  baseTheme,
  value,
  onChange,
  onReset,
  onClose,
  onSaveAs,
  existingSavedNames,
}: Props) {
  const [draft, setDraft] = useState<ThemeCustomization>(value);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => { onChange(draft); }, [draft, onChange]);
  useEffect(() => { setDraft(value); }, [value]);

  const editingSavedName = useMemo(
    () =>
      typeof activeTheme === "string" && activeTheme.startsWith("custom:")
        ? activeTheme.slice("custom:".length)
        : null,
    [activeTheme],
  );

  const set = <K extends keyof ThemeCustomization>(k: K, v: ThemeCustomization[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
  };

  const doSave = () => {
    setSaveError(null);
    const n = saveName.trim();
    if (!n) {
      setSaveError("Give your theme a name.");
      return;
    }
    if (n.includes(":") || n.length > 40) {
      setSaveError("Names must be ≤ 40 chars and contain no ':'.");
      return;
    }
    // If we're editing an existing saved theme and the name didn't change,
    // overwrite — otherwise check for collisions.
    const isRename = editingSavedName && editingSavedName !== n;
    if (n !== editingSavedName && existingSavedNames.includes(n)) {
      setSaveError("A theme with that name already exists.");
      return;
    }
    onSaveAs(
      { name: n, base: baseTheme, customization: draft },
      isRename ? editingSavedName ?? undefined : undefined,
    );
    setSaving(false);
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card theme-studio" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>
            Customize
            <span className="theme-studio-base"> · base: {baseTheme}{editingSavedName ? ` · saved as "${editingSavedName}"` : ""}</span>
          </h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>

        <div className="theme-studio-layout">
          <div className="theme-studio-controls">
            <div className="theme-studio-row">
              <label>Accent color</label>
              <div className="theme-studio-accent">
                <input
                  type="color"
                  value={draft.accent ?? "#4f8cff"}
                  onChange={(e) => set("accent", e.target.value)}
                />
                <input
                  type="text"
                  value={draft.accent ?? ""}
                  placeholder="#4f8cff"
                  onChange={(e) => set("accent", e.target.value || undefined)}
                  className="arxiv-input"
                />
              </div>
              <div className="accent-presets">
                {PRESET_ACCENTS.map((c) => (
                  <button
                    key={c}
                    className="accent-preset"
                    style={{ background: c }}
                    onClick={() => set("accent", c)}
                    aria-label={`Set accent to ${c}`}
                    title={c}
                  />
                ))}
              </div>
            </div>

            <div className="theme-studio-row">
              <label>Body font</label>
              <select
                value={draft.fontSans ?? FONT_SANS_STACKS[0].stack}
                onChange={(e) => set("fontSans", e.target.value)}
                className="arxiv-input"
              >
                {FONT_SANS_STACKS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
              </select>
            </div>

            <div className="theme-studio-row">
              <label>Serif font</label>
              <select
                value={draft.fontSerif ?? FONT_SERIF_STACKS[0].stack}
                onChange={(e) => set("fontSerif", e.target.value)}
                className="arxiv-input"
              >
                {FONT_SERIF_STACKS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
              </select>
              <label className="theme-studio-toggle">
                <input
                  type="checkbox"
                  checked={!!draft.serifBody}
                  onChange={(e) => set("serifBody", e.target.checked)}
                />
                Use serif for prose
              </label>
            </div>

            <div className="theme-studio-row">
              <label>Code font</label>
              <select
                value={draft.fontMono ?? FONT_MONO_STACKS[0].stack}
                onChange={(e) => set("fontMono", e.target.value)}
                className="arxiv-input"
              >
                {FONT_MONO_STACKS.map((f) => <option key={f.label} value={f.stack}>{f.label}</option>)}
              </select>
            </div>

            <div className="theme-studio-row">
              <label>Font size</label>
              <div className="slider-row">
                <input
                  type="range"
                  min={13}
                  max={20}
                  step={0.5}
                  value={draft.fontSizePx ?? 16.5}
                  onChange={(e) => set("fontSizePx", Number(e.target.value))}
                />
                <span className="slider-val">{(draft.fontSizePx ?? 16.5).toFixed(1)} px</span>
              </div>
            </div>

            <div className="theme-studio-row">
              <label>Line height</label>
              <div className="slider-row">
                <input
                  type="range"
                  min={1.3}
                  max={2.0}
                  step={0.05}
                  value={draft.lineHeight ?? 1.75}
                  onChange={(e) => set("lineHeight", Number(e.target.value))}
                />
                <span className="slider-val">{(draft.lineHeight ?? 1.75).toFixed(2)}</span>
              </div>
            </div>

            <div className="theme-studio-row">
              <label>Content width</label>
              <div className="slider-row">
                <input
                  type="range"
                  min={560}
                  max={1100}
                  step={20}
                  value={draft.contentMaxPx ?? 820}
                  onChange={(e) => set("contentMaxPx", Number(e.target.value))}
                />
                <span className="slider-val">{draft.contentMaxPx ?? 820} px</span>
              </div>
            </div>
          </div>

          {/* Preview pane — uses scoped CSS vars so the live document isn't
              affected mid-drag if we ever want to defer the apply. */}
          <div className="theme-studio-preview" style={previewVars(draft)}>
            <div className="preview-doc">
              <div className="preview-h1">Theme preview</div>
              <p className="preview-p">
                The quick brown fox jumps over the lazy dog. Pack my box with
                five dozen liquor jugs — typography in motion.
              </p>
              <p className="preview-p preview-serif">
                <em>Serif:</em> "Yes," said the centaur, "but a wave is not a
                state of water — it's a state of movement."
              </p>
              <div className="preview-code">
                <span style={{ color: "var(--prev-accent, var(--accent))" }}>const</span>{" "}
                <span>greet</span> = (<span>name</span>) =&gt; `Hello, ${"${name}"}`;
              </div>
              <div className="preview-list">
                <div className="preview-li">
                  <span className="preview-bullet" />
                  Bullet item with <a className="preview-a">accent link</a>
                </div>
                <div className="preview-li">
                  <span className="preview-bullet" />
                  Another item — the accent shows up here too
                </div>
              </div>
              <div className="preview-kbd-row">
                <kbd className="preview-kbd">Ctrl</kbd>
                <kbd className="preview-kbd">P</kbd>
                <span className="preview-mono">opens the palette</span>
              </div>
            </div>
          </div>
        </div>

        {saving ? (
          <div className="theme-studio-save-row">
            <input
              type="text"
              className="arxiv-input"
              placeholder="Theme name (e.g. Reading, Writing, Night)"
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
          <div className="theme-studio-actions">
            <button onClick={onReset}>Reset this theme</button>
            <div style={{ flex: 1 }} />
            {editingSavedName ? (
              <button
                onClick={() => {
                  onSaveAs(
                    { name: editingSavedName, base: baseTheme, customization: draft },
                  );
                }}
                title="Overwrite this saved theme"
              >
                Update "{editingSavedName}"
              </button>
            ) : null}
            <button
              onClick={() => {
                setSaveName(editingSavedName ?? "");
                setSaving(true);
              }}
            >
              Save as…
            </button>
            <button className="primary" onClick={onClose}>Done</button>
          </div>
        )}
        {saveError && <div className="arxiv-error" style={{ marginTop: 10 }}>{saveError}</div>}
      </div>
    </div>
  );
}
