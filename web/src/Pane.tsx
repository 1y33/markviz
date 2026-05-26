import { useEffect, useRef, useState } from "react";
import { FileView } from "./FileView";
import { Editor } from "./Editor";
import { FlashcardsBadge } from "./Flashcards";
import { TabBar } from "./TabBar";
import { fetchFile, saveFile } from "./api";
import { IconEdit, IconEye } from "./icons";
import type { FileKind } from "./types";

export interface PaneSnapshot {
  path: string | null;
  pdfInitialPage: number | null;
}

interface Props {
  side: "left" | "right";
  active: boolean;
  // Tab strip: the list of files open in this pane.
  tabs: string[];
  activeTab: string | null;
  onActivateTab: (path: string) => void;
  onCloseTab: (path: string) => void;
  onReorderTabs: (from: number, to: number) => void;
  // PDF state.
  pdfInitialPage?: number | null;
  theme: "dark" | "light";
  zoom: number;
  wikiResolver?: (target: string) => string | null;
  wikiFiles?: string[];
  // Lifecycle.
  onFocus: () => void;
  onClosePane?: () => void;
  // PDF/note sibling.
  resolveSiblingNote: (pdfPath: string) => { path: string; exists: boolean } | null;
  onOpenSibling: (siblingPath: string, exists: boolean, fromPdfPath: string) => void;
  showFlashcards: () => void;
  reloadTreeAfterSave?: () => void;
}

export function Pane({
  side,
  active,
  tabs,
  activeTab,
  onActivateTab,
  onCloseTab,
  onReorderTabs,
  pdfInitialPage,
  theme,
  zoom,
  wikiResolver,
  wikiFiles,
  onFocus,
  onClosePane,
  resolveSiblingNote,
  onOpenSibling,
  showFlashcards,
  reloadTreeAfterSave,
}: Props) {
  const path = activeTab;
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

  const sibling = path && kind === "pdf" ? resolveSiblingNote(path) : null;
  const canEdit = !!path && (kind === "markdown" || kind === "text");

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
      <TabBar
        side={side}
        tabs={tabs}
        activeTab={activeTab}
        onActivate={onActivateTab}
        onClose={onCloseTab}
        onReorder={onReorderTabs}
        onClosePane={onClosePane}
        trailing={canEdit ? (
          <button
            className={`tab-action-btn ${editing ? "is-active" : ""}`}
            onClick={() => setEditing((e) => !e)}
            title={editing ? "View (Ctrl+E)" : "Edit (Ctrl+E)"}
          >
            {editing ? <IconEye size={13} /> : <IconEdit size={13} />}
            <span>{editing ? "View" : "Edit"}</span>
          </button>
        ) : null}
      />
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
