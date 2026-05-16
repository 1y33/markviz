import { useEffect, useRef, useState } from "react";
import { MarkdownView } from "./MarkdownView";
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
}

export function Editor({ initialContent, filePath, kind, theme, zoom, onSave, onCancel }: Props) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
              onChange={(e) => setContent(e.target.value)}
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
    </div>
  );
}
