import { useEffect, useRef, useState } from "react";
import { FileView } from "./FileView";
import { Editor } from "./Editor";
import { FlashcardsBadge } from "./Flashcards";
import { fetchFile, saveFile } from "./api";
import type { FileKind } from "./types";
import {
  IconClose,
  IconChevronLeft,
  IconChevronRight,
  IconEdit,
  IconEye,
} from "./icons";

export interface PaneSnapshot {
  path: string | null;
  pdfInitialPage: number | null;
}

interface Props {
  side: "left" | "right";
  active: boolean;
  path: string | null;
  pdfInitialPage?: number | null;
  theme: "dark" | "light";
  zoom: number;
  wikiResolver?: (target: string) => string | null;
  wikiFiles?: string[];
  // Lifecycle hooks back to App.
  onFocus: () => void;
  onPathChange: (path: string | null) => void;
  onClose?: () => void;
  // Used to derive sibling-note state from the global file index.
  resolveSiblingNote: (pdfPath: string) => { path: string; exists: boolean } | null;
  onOpenSibling: (siblingPath: string, exists: boolean, fromPdfPath: string) => void;
  showFlashcards: () => void;
  reloadTreeAfterSave?: () => void;
}

export function Pane({
  side,
  active,
  path,
  pdfInitialPage,
  theme,
  zoom,
  wikiResolver,
  wikiFiles,
  onFocus,
  onPathChange,
  onClose,
  resolveSiblingNote,
  onOpenSibling,
  showFlashcards,
  reloadTreeAfterSave,
}: Props) {
  const [content, setContent] = useState<string | null>("");
  const [kind, setKind] = useState<FileKind>("markdown");
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const paneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!path) {
      setContent(null);
      setKind("markdown");
      setUrl(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    setEditing(false);
    fetchFile(path)
      .then((f) => {
        setContent(f.content);
        setKind(f.kind);
        setUrl(f.url);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);

  const canEdit = !!path && (kind === "markdown" || kind === "text");
  const sibling = path && kind === "pdf" ? resolveSiblingNote(path) : null;
  const filename = path ? path.split("/").pop() : null;

  const onSave = async (newContent: string) => {
    if (!path) return;
    await saveFile(path, newContent);
    setContent(newContent);
    setEditing(false);
    reloadTreeAfterSave?.();
  };

  return (
    <section
      ref={paneRef}
      className={`pane pane-${side} ${active ? "is-active" : ""}`}
      onMouseDown={onFocus}
      onFocus={onFocus}
    >
      <div className="pane-header">
        <div className="pane-label" title={path ?? ""}>
          {path ? (
            <>
              <span className="pane-side-tag">{side === "left" ? "L" : "R"}</span>
              <span className="pane-filename">{filename}</span>
            </>
          ) : (
            <span className="pane-empty-label">Empty pane</span>
          )}
        </div>
        <div className="pane-header-actions">
          {canEdit && (
            <button
              className={`iconbtn ghost ${editing ? "is-active" : ""}`}
              onClick={() => setEditing((e) => !e)}
              title={editing ? "View" : "Edit"}
            >
              {editing ? <IconEye size={13} /> : <IconEdit size={13} />}
            </button>
          )}
          {onClose && (
            <button
              className="iconbtn ghost"
              onClick={onClose}
              title="Close this pane"
              aria-label="Close pane"
            >
              <IconClose size={13} />
            </button>
          )}
        </div>
      </div>
      <div className="pane-body">
        {error && <div className="error">{error}</div>}
        {loading && <div className="loading">Loading…</div>}
        {!loading && !error && path && editing && content !== null && (
          <Editor
            initialContent={content}
            filePath={path}
            kind={kind}
            theme={theme}
            zoom={zoom}
            onSave={onSave}
            onCancel={() => setEditing(false)}
            wikiFiles={wikiFiles}
          />
        )}
        {!loading && !error && path && !editing && (
          <>
            <FileView
              path={path}
              kind={kind}
              content={content}
              url={url}
              theme={theme}
              zoom={zoom}
              wikiResolver={wikiResolver}
              pdfInitialPage={pdfInitialPage ?? undefined}
              pdfSiblingNoteState={
                kind === "pdf" ? (sibling?.exists ? "exists" : "missing") : "unknown"
              }
              onOpenPdfSiblingNote={
                kind === "pdf" && sibling
                  ? () => onOpenSibling(sibling.path, sibling.exists, path)
                  : undefined
              }
            />
            {kind === "markdown" && content && (
              <div className="extras-overlay">
                <FlashcardsBadge content={content} onStudy={showFlashcards} />
              </div>
            )}
          </>
        )}
        {!loading && !error && !path && (
          <div className="empty-state pane-empty">
            <p className="hint">
              {side === "right"
                ? "Open a file in this pane: alt-click in the sidebar, or use the split toggle."
                : "Select a file from the sidebar."}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

// Tiny icon re-exports so consumers can match the look used here.
export const PaneIcons = { IconChevronLeft, IconChevronRight };
