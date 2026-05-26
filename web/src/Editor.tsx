import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "./MarkdownView";
import { WikilinkAutocomplete, type Suggestion } from "./WikilinkAutocomplete";
import type { FileKind } from "./types";
import { IconEye, IconEdit, IconCode } from "./icons";

type SplitMode = "edit" | "split" | "preview";

interface Props {
  initialContent: string;
  filePath: string;
  kind: FileKind;
  theme: "dark" | "light";
  zoom: number;
  onSave: (content: string) => Promise<void>;
  onCancel: () => void;
  // Optional list of files for [[wikilink]] autocomplete. When omitted the
  // editor still works; autocomplete simply doesn't open.
  wikiFiles?: string[];
}

// Compute the on-screen pixel position of the caret in a textarea by mirroring
// the textarea contents inside a hidden div. The mirror gets all the same
// font/sizing styles, and we use the absolute pixel position of a marker span
// inserted at the caret index. This is the standard trick — there's no DOM
// API for textarea caret coordinates.
function caretXY(ta: HTMLTextAreaElement, caret: number): { x: number; y: number } {
  const rect = ta.getBoundingClientRect();
  const style = window.getComputedStyle(ta);
  const mirror = document.createElement("div");
  // Copy the properties that affect text layout.
  const props = [
    "boxSizing", "width", "padding", "border", "fontSize", "fontFamily",
    "fontWeight", "fontStyle", "lineHeight", "letterSpacing", "textTransform",
    "wordSpacing", "tabSize", "whiteSpace", "wordWrap", "overflowWrap",
  ];
  for (const p of props) {
    (mirror.style as unknown as Record<string, string>)[p] =
      (style as unknown as Record<string, string>)[p];
  }
  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";
  mirror.textContent = ta.value.slice(0, caret);
  const marker = document.createElement("span");
  marker.textContent = ta.value.slice(caret) || "."; // dot keeps marker height
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const offsetTop = marker.offsetTop;
  const offsetLeft = marker.offsetLeft;
  document.body.removeChild(mirror);
  return {
    x: rect.left + offsetLeft - ta.scrollLeft,
    y: rect.top + offsetTop - ta.scrollTop,
  };
}

export function Editor({ initialContent, filePath, kind, theme, zoom, onSave, onCancel, wikiFiles }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<{ start: number; query: string; caret: { x: number; y: number } } | null>(null);
  const [mode, setMode] = useState<SplitMode>(() => {
    try {
      const v = localStorage.getItem("markviz:editorSplit");
      return v === "edit" || v === "preview" ? v : "split";
    } catch {
      return "split";
    }
  });
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setContent(initialContent), [initialContent]);
  useEffect(() => { ref.current?.focus(); }, []);
  useEffect(() => {
    try { localStorage.setItem("markviz:editorSplit", mode); } catch {}
  }, [mode]);

  const dirty = content !== initialContent;

  // Look at the text to the left of the caret. If we find an unmatched `[[`
  // (i.e. no `]]` between it and the caret, and no newline either), we're in
  // wikilink-completion context and the popover should be shown.
  const detectWikilinkContext = (ta: HTMLTextAreaElement, value: string) => {
    const caret = ta.selectionStart ?? 0;
    const before = value.slice(0, caret);
    // Find the last `[[` in `before`, but stop if we cross a newline or `]]`.
    const open = before.lastIndexOf("[[");
    if (open < 0) { setAutoState(null); return; }
    const tail = before.slice(open + 2);
    if (tail.includes("]]") || tail.includes("\n")) { setAutoState(null); return; }
    // Allow only "normal" link characters in the query — anything weird is a
    // hint that we're not actually in a wikilink.
    if (/[\[\]`]/.test(tail)) { setAutoState(null); return; }
    const xy = caretXY(ta, caret);
    setAutoState({ start: open + 2, query: tail, caret: xy });
  };

  const insertWikilink = (s: Suggestion) => {
    const ta = ref.current;
    if (!ta || !autoState) return;
    const caret = ta.selectionStart ?? 0;
    const before = content.slice(0, autoState.start);
    const after = content.slice(caret);
    // Drop the .md extension; for PDFs keep .pdf so navigation resolves correctly.
    const target = s.isPdf ? s.path : s.basename;
    // Auto-close if there's no `]]` ahead in the line.
    const lineAfter = after.split("\n", 1)[0] ?? "";
    const close = lineAfter.startsWith("]]") ? "" : "]]";
    const insertion = `${target}${close}`;
    const next = before + insertion + after;
    setContent(next);
    setAutoState(null);
    // Restore the caret to the end of the inserted target (before `]]`).
    requestAnimationFrame(() => {
      ta.focus();
      const pos = before.length + target.length + (close ? 0 : 2);
      ta.setSelectionRange(pos, pos);
    });
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    setError(null);
    try {
      await onSave(content);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        if (!dirty || confirm("Discard unsaved changes?")) {
          onCancel();
        }
      } else if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setMode((m) => (m === "edit" ? "split" : m === "split" ? "preview" : "edit"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, dirty]);

  // Sync scrolling between editor and preview when in split mode
  const editorPaneRef = useRef<HTMLDivElement>(null);
  const previewPaneRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);

  useEffect(() => {
    if (mode !== "split") return;
    const ta = ref.current;
    const preview = previewPaneRef.current;
    if (!ta || !preview) return;
    const onScrollEditor = () => {
      if (syncingRef.current) { syncingRef.current = false; return; }
      const ratio = ta.scrollTop / Math.max(1, ta.scrollHeight - ta.clientHeight);
      syncingRef.current = true;
      preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
    };
    ta.addEventListener("scroll", onScrollEditor, { passive: true });
    return () => {
      ta.removeEventListener("scroll", onScrollEditor);
    };
  }, [mode]);

  const isMarkdown = kind === "markdown";
  const showPreview = isMarkdown && mode !== "edit";
  const showCode = mode !== "preview" || !isMarkdown;

  return (
    <div className="editor">
      <div className="editor-toolbar">
        <div className="editor-mode-badge">
          <span className="badge-dot" />
          <span>EDITING</span>
          <span className="badge-path">{filePath}</span>
        </div>
        <div className="editor-mode-tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === "edit"}
            className={`mode-tab ${mode === "edit" ? "is-active" : ""}`}
            onClick={() => setMode("edit")}
            title="Editor only (Ctrl+/)"
          >
            <IconCode size={13} /> Source
          </button>
          {isMarkdown && (
            <button
              role="tab"
              aria-selected={mode === "split"}
              className={`mode-tab ${mode === "split" ? "is-active" : ""}`}
              onClick={() => setMode("split")}
              title="Split view (Ctrl+/)"
            >
              <IconEdit size={13} /> Split
            </button>
          )}
          {isMarkdown && (
            <button
              role="tab"
              aria-selected={mode === "preview"}
              className={`mode-tab ${mode === "preview" ? "is-active" : ""}`}
              onClick={() => setMode("preview")}
              title="Preview only (Ctrl+/)"
            >
              <IconEye size={13} /> Preview
            </button>
          )}
        </div>
        <div className="editor-actions">
          <span className={`editor-status ${dirty ? "is-dirty" : ""}`}>
            {dirty ? "Modified" : "Saved"}
            {error && <span className="err">  {error}</span>}
          </span>
          <button className="iconbtn" onClick={onCancel} title="Cancel (Esc)">
            Cancel
          </button>
          <button className="iconbtn primary" disabled={!dirty || saving} onClick={save} title="Save (Ctrl+S)">
            {saving ? "Saving" : "Save"}
          </button>
        </div>
      </div>
      <div className={`editor-body mode-${mode}`}>
        {showCode && (
          <div className="editor-pane" ref={editorPaneRef}>
            <div className="pane-label">SOURCE</div>
            <textarea
              ref={ref}
              className="editor-textarea"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                if (wikiFiles && wikiFiles.length > 0) {
                  detectWikilinkContext(e.target as HTMLTextAreaElement, e.target.value);
                }
              }}
              onKeyUp={(e) => {
                if (wikiFiles && wikiFiles.length > 0) {
                  detectWikilinkContext(e.currentTarget, e.currentTarget.value);
                }
              }}
              onClick={(e) => {
                if (wikiFiles && wikiFiles.length > 0) {
                  detectWikilinkContext(e.currentTarget, e.currentTarget.value);
                }
              }}
              onBlur={() => {
                // Give onMouseDown on the popover a tick to fire before we close.
                setTimeout(() => setAutoState(null), 120);
              }}
              spellCheck={false}
              style={{ fontSize: `${0.95 * zoom}em` }}
            />
          </div>
        )}
        {showPreview && (
          <div className="editor-pane preview-pane" ref={previewPaneRef}>
            <div className="pane-label">PREVIEW</div>
            <div className="preview-scroll">
              <MarkdownView content={content} theme={theme} filePath={filePath} zoom={zoom} />
            </div>
          </div>
        )}
      </div>
      {autoState && wikiFiles && ref.current && (
        <WikilinkAutocomplete
          anchor={ref.current}
          files={wikiFiles}
          query={autoState.query}
          caret={autoState.caret}
          onPick={insertWikilink}
          onClose={() => setAutoState(null)}
        />
      )}
    </div>
  );
}
