import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { Minimap } from "./Minimap";
import { FileView } from "./FileView";
import { Editor } from "./Editor";
import { fetchInfo, fetchTree, fetchFile, saveFile, connect, disconnect, heartbeat, fetchIndex, type FileIndex } from "./api";
import { FolderPicker } from "./FolderPicker";
import { BacklinksPane } from "./BacklinksPane";
import { GraphView } from "./GraphView";
import { FlashcardsBadge, FlashcardsStudy } from "./Flashcards";
import { subscribeFs } from "./liveReload";
import { CommandPalette } from "./CommandPalette";
import { setStoragePrefix, lsGet, lsSet } from "./storage";
import type { FileKind, FocusMode, RootInfo, Theme, TreeNode } from "./types";

function getInitialFileFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("file");
}

function getInitialFocusFromUrl(): FocusMode | null {
  const params = new URLSearchParams(window.location.search);
  const v = params.get("focus");
  return v === "normal" || v === "focus" || v === "zen" ? v : null;
}

function getEditFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("edit") === "1";
}

function setUrlFile(path: string | null) {
  const url = new URL(window.location.href);
  if (path) url.searchParams.set("file", path);
  else url.searchParams.delete("file");
  window.history.replaceState({}, "", url);
}

function findFirstMarkdown(nodes: TreeNode[]): string | null {
  for (const n of nodes) {
    if (n.type === "file" && (!n.kind || n.kind === "markdown")) return n.path;
    if (n.children) {
      const f = findFirstMarkdown(n.children);
      if (f) return f;
    }
  }
  for (const n of nodes) {
    if (n.type === "file") return n.path;
    if (n.children) {
      const f = findFirstMarkdown(n.children);
      if (f) return f;
    }
  }
  return null;
}

function resolveRelativeHref(from: string | null, href: string): string {
  if (!from) return href.replace(/^\.\//, "");
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/")) : "";
  const parts = (dir ? dir.split("/") : []).concat(href.split("/"));
  const stack: string[] = [];
  for (const p of parts) {
    if (p === "" || p === ".") continue;
    if (p === "..") stack.pop();
    else stack.push(p);
  }
  return stack.join("/");
}

const MIN_SIDEBAR_WIDTH = 180;
const MAX_SIDEBAR_WIDTH = 600;
const MIN_MINIMAP_WIDTH = 80;
const MAX_MINIMAP_WIDTH = 220;

export function App() {
  const [info, setInfo] = useState<RootInfo | null>(null);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>("");
  const [currentKind, setCurrentKind] = useState<FileKind>("markdown");
  const [currentUrl, setCurrentUrl] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [theme, setTheme] = useState<Theme>(() => lsGet<Theme>("theme", "dark"));
  const [focus, setFocus] = useState<FocusMode>(() => lsGet<FocusMode>("focus", "normal"));
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(() => lsGet<boolean>("sidebarOpen", true));
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => lsGet<number>("sidebarWidth", 280));
  const [minimapOpen, setMinimapOpen] = useState<boolean>(() => lsGet<boolean>("minimapOpen", true));
  const [minimapWidth, setMinimapWidth] = useState<number>(() => lsGet<number>("minimapWidth", 150));
  const [zoom, setZoom] = useState<number>(() => lsGet<number>("zoom", 1));
  const [editing, setEditing] = useState(false);
  const [readSet, setReadSet] = useState<Set<string>>(new Set());
  const [showHelp, setShowHelp] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(
    () => new URLSearchParams(window.location.search).get("picker") === "1",
  );
  const [showGraph, setShowGraph] = useState(false);
  const [showFlashcards, setShowFlashcards] = useState(false);
  const [index, setIndex] = useState<FileIndex | null>(null);
  const [recentFolders, setRecentFolders] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("markviz:recentFolders") ?? "[]"); }
    catch { return []; }
  });
  const [recentFiles, setRecentFiles] = useState<string[]>(() => lsGet<string[]>("recentFiles", []));
  const [showPalette, setShowPalette] = useState(false);

  const addRecentFile = useCallback((p: string) => {
    setRecentFiles((prev) => {
      const next = [p, ...prev.filter((x) => x !== p)].slice(0, 20);
      if (info) lsSet("recentFiles", next);
      return next;
    });
  }, [info]);

  const addRecentFolder = useCallback((p: string) => {
    setRecentFolders((prev) => {
      const next = [p, ...prev.filter((x) => x !== p)].slice(0, 8);
      try { localStorage.setItem("markviz:recentFolders", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    connect();
    const hbInterval = setInterval(heartbeat, 5_000);
    const onUnload = () => disconnect();
    window.addEventListener("beforeunload", onUnload);
    window.addEventListener("pagehide", onUnload);
    return () => {
      clearInterval(hbInterval);
      window.removeEventListener("beforeunload", onUnload);
      window.removeEventListener("pagehide", onUnload);
      disconnect();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const i = await fetchInfo();
        setInfo(i);
        setStoragePrefix(i);
        setReadSet(new Set(lsGet<string[]>("read", [])));
        setTheme(lsGet<Theme>("theme", "dark"));
        const urlFocus = getInitialFocusFromUrl();
        setFocus(urlFocus ?? lsGet<FocusMode>("focus", "normal"));
        setSidebarOpen(lsGet<boolean>("sidebarOpen", true));
        setSidebarWidth(lsGet<number>("sidebarWidth", 280));
        setMinimapOpen(lsGet<boolean>("minimapOpen", true));
        setMinimapWidth(lsGet<number>("minimapWidth", 120));
        setZoom(lsGet<number>("zoom", 1));
        const t = await fetchTree();
        setTree(t.tree);
        const fromUrl = getInitialFileFromUrl();
        const target = fromUrl ?? findFirstMarkdown(t.tree);
        if (target) setCurrentPath(target);
      } catch (e: unknown) {
        setError((e as Error).message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!currentPath) {
      setContent(null);
      setCurrentKind("markdown");
      setCurrentUrl(undefined);
      return;
    }
    setLoading(true);
    setError(null);
    setEditing(false);
    fetchFile(currentPath)
      .then((f) => {
        setContent(f.content);
        setCurrentKind(f.kind);
        setCurrentUrl(f.url);
        setUrlFile(currentPath);
        addRecentFile(currentPath);
        if (getEditFromUrl() && (f.kind === "markdown" || f.kind === "text")) {
          setEditing(true);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [currentPath]);

  // Persist UI state
  useEffect(() => { if (info) lsSet("theme", theme); }, [theme, info]);
  useEffect(() => { if (info) lsSet("focus", focus); }, [focus, info]);
  useEffect(() => { if (info) lsSet("sidebarOpen", sidebarOpen); }, [sidebarOpen, info]);
  useEffect(() => { if (info) lsSet("sidebarWidth", sidebarWidth); }, [sidebarWidth, info]);
  useEffect(() => { if (info) lsSet("minimapOpen", minimapOpen); }, [minimapOpen, info]);
  useEffect(() => { if (info) lsSet("minimapWidth", minimapWidth); }, [minimapWidth, info]);
  useEffect(() => { if (info) lsSet("zoom", zoom); }, [zoom, info]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.focus = focus;
  }, [theme, focus]);

  // Dynamic document title — show the open file (or root name) in the tab.
  useEffect(() => {
    let title = "markviz";
    if (currentPath) {
      // Try to extract H1 from the markdown content; fall back to filename.
      let displayName: string | null = null;
      if (currentKind === "markdown" && typeof content === "string") {
        const m = /^#\s+(.+?)\s*$/m.exec(content);
        if (m) displayName = m[1].trim();
      }
      if (!displayName) {
        const parts = currentPath.split("/");
        displayName = parts[parts.length - 1];
      }
      title = info ? `${displayName} — ${info.rootName}` : displayName;
    } else if (info) {
      title = `${info.rootName} — markviz`;
    }
    document.title = title;
  }, [currentPath, content, currentKind, info]);

  // When the root changes (via folder picker), seed recent.
  useEffect(() => {
    if (info?.root) addRecentFolder(info.root);
  }, [info?.root, addRecentFolder]);

  const cycleFocus = useCallback(() => {
    setFocus((f) => (f === "normal" ? "focus" : f === "focus" ? "zen" : "normal"));
  }, []);

  const toggleRead = useCallback(
    (p: string) => {
      setReadSet((prev) => {
        const next = new Set(prev);
        if (next.has(p)) next.delete(p);
        else next.add(p);
        if (info) lsSet("read", Array.from(next));
        return next;
      });
    },
    [info],
  );

  const markCurrentRead = useCallback(() => {
    if (!currentPath) return;
    toggleRead(currentPath);
  }, [currentPath, toggleRead]);

  const reloadTree = useCallback(async () => {
    try {
      const t = await fetchTree();
      setTree(t.tree);
    } catch {}
    try {
      const i = await fetchIndex();
      setIndex(i);
    } catch {}
  }, []);

  // Initial + on-tree-change index fetch (for wikilink resolution).
  useEffect(() => {
    if (tree.length === 0) return;
    fetchIndex().then(setIndex).catch(() => {});
  }, [tree]);

  // === Live reload — subscribe to server file watcher ===
  const [reloadPing, setReloadPing] = useState(0);
  useEffect(() => {
    const unsub = subscribeFs((ev) => {
      if (ev.type === "tree-change" || ev.type === "root-change") {
        reloadTree();
      }
      if (ev.type === "fs-change" && ev.path && currentPath && !editing) {
        // Compare path normalizations. ev.path is server-relative.
        if (ev.path === currentPath || ev.path.endsWith("/" + currentPath)) {
          fetchFile(currentPath).then((f) => {
            setContent(f.content);
            setCurrentKind(f.kind);
            setCurrentUrl(f.url);
            setReloadPing((n) => n + 1);
          }).catch(() => {});
        }
      }
    });
    return unsub;
  }, [currentPath, editing, reloadTree]);
  void reloadPing;

  const wikiResolver = useCallback((target: string): string | null => {
    if (!index) return null;
    const key = target.toLowerCase().trim();
    const candidates = index.byBasename[key];
    if (candidates && candidates.length > 0) return candidates[0];
    // Try treating target as a path
    if (index.files.includes(target)) return target;
    return null;
  }, [index]);

  const reopenAt = useCallback(async (newRoot: string) => {
    // The server has already been re-rooted by FolderPicker via /api/reroot.
    // We just refresh local state + clear URL/file.
    setShowFolderPicker(false);
    setCurrentPath(null);
    setContent("");
    setCurrentKind("markdown");
    setLoading(true);
    try {
      const i = await fetchInfo();
      setInfo(i);
      setStoragePrefix(i);
      setReadSet(new Set(lsGet<string[]>("read", [])));
      setTheme(lsGet<Theme>("theme", "dark"));
      setFocus(lsGet<FocusMode>("focus", "normal"));
      const t = await fetchTree();
      setTree(t.tree);
      const first = findFirstMarkdown(t.tree);
      if (first) setCurrentPath(first);
      addRecentFolder(newRoot);
      // Clean URL query for the new root.
      const url = new URL(window.location.href);
      url.searchParams.delete("file");
      window.history.replaceState({}, "", url);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [addRecentFolder]);

  useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ href: string; from: string | null; abs?: boolean }>;
      const resolved = ce.detail.abs
        ? ce.detail.href.split("#")[0]
        : resolveRelativeHref(ce.detail.from, ce.detail.href);
      setCurrentPath(resolved);
      // Scroll to heading if specified
      const hashIdx = ce.detail.href.indexOf("#");
      if (hashIdx >= 0) {
        const heading = ce.detail.href.slice(hashIdx + 1);
        setTimeout(() => {
          const el = document.getElementById(heading);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
    };
    window.addEventListener("markviz:navigate", handler as EventListener);
    return () => window.removeEventListener("markviz:navigate", handler as EventListener);
  }, []);

  const fileList = useMemo(() => {
    const out: string[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "file") out.push(n.path);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return out;
  }, [tree]);

  const navRelative = useCallback(
    (dir: 1 | -1) => {
      if (!currentPath) return;
      const idx = fileList.indexOf(currentPath);
      if (idx === -1) return;
      const next = fileList[idx + dir];
      if (next) setCurrentPath(next);
    },
    [currentPath, fileList],
  );

  const zoomIn = useCallback(() => setZoom((z) => Math.min(2.5, Math.round((z + 0.1) * 100) / 100)), []);
  const zoomOut = useCallback(() => setZoom((z) => Math.max(0.6, Math.round((z - 0.1) * 100) / 100)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (editing) return;
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;

      // shortcuts that work even while typing (only with modifiers)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setShowPalette(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setShowPalette(true);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((s) => !s);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "m") {
        e.preventDefault();
        setMinimapOpen((s) => !s);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        if (currentPath && (currentKind === "markdown" || currentKind === "text")) {
          setEditing((v) => !v);
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        zoomIn();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "-") {
        e.preventDefault();
        zoomOut();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "0") {
        e.preventDefault();
        zoomReset();
        return;
      }

      if (isTyping) return;

      if (e.key === "f") cycleFocus();
      else if (e.key === "m") markCurrentRead();
      else if (e.key === "j") navRelative(1);
      else if (e.key === "k") navRelative(-1);
      else if (e.key === "o") setShowFolderPicker(true);
      else if (e.key === "g") setShowGraph(true);
      else if (e.key === "s") setShowFlashcards(true);
      else if (e.key === "?") setShowHelp((v) => !v);
      else if (e.key === "Escape") {
        setShowHelp(false);
        setShowFolderPicker(false);
        setShowGraph(false);
        setShowFlashcards(false);
        setShowPalette(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing, cycleFocus, markCurrentRead, navRelative, zoomIn, zoomOut, zoomReset, currentPath, currentKind]);

  // Sidebar resize
  const sidebarResizingRef = useRef(false);
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    sidebarResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      if (!sidebarResizingRef.current) return;
      const w = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, ev.clientX));
      setSidebarWidth(w);
    };
    const up = () => {
      sidebarResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  // Minimap resize
  const minimapResizingRef = useRef(false);
  const startMinimapResize = (e: React.MouseEvent) => {
    e.preventDefault();
    minimapResizingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const move = (ev: MouseEvent) => {
      if (!minimapResizingRef.current) return;
      const w = Math.max(MIN_MINIMAP_WIDTH, Math.min(MAX_MINIMAP_WIDTH, window.innerWidth - ev.clientX));
      setMinimapWidth(w);
    };
    const up = () => {
      minimapResizingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const onSave = useCallback(
    async (newContent: string) => {
      if (!currentPath) return;
      await saveFile(currentPath, newContent);
      setContent(newContent);
      setEditing(false);
      reloadTree();
    },
    [currentPath, reloadTree],
  );

  const codeTheme: "dark" | "light" =
    theme === "light" || theme === "sepia" || theme === "solarized" ? "light" : "dark";

  // Zen-mode sidebar peek: hover near the left edge to reveal the sidebar.
  const [zenSidebarPeek, setZenSidebarPeek] = useState(false);
  useEffect(() => {
    if (focus !== "zen") {
      setZenSidebarPeek(false);
      return;
    }
    const onMove = (e: MouseEvent) => {
      // Show when within 12px of the left edge; hide when more than 320px away
      // (so it stays open while user reaches into the panel).
      if (e.clientX <= 12) setZenSidebarPeek(true);
      else if (e.clientX > 360) setZenSidebarPeek(false);
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [focus]);

  const isMarkdown = currentKind === "markdown";
  const canEdit = !!currentPath && (currentKind === "markdown" || currentKind === "text");
  const showMinimap = minimapOpen && isMarkdown && focus !== "zen";
  const showSidebar = (sidebarOpen && focus !== "zen") || (focus === "zen" && zenSidebarPeek);
  const sidebarIsOverlay = focus === "zen" && zenSidebarPeek;

  // In zen mode the sidebar floats over the content; don't reserve grid space.
  const reserveSidebar = showSidebar && !sidebarIsOverlay;
  const gridCols = [
    reserveSidebar ? `${sidebarWidth}px` : null,
    reserveSidebar ? "4px" : null,
    "1fr",
    showMinimap ? "4px" : null,
    showMinimap ? `${minimapWidth}px` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`app focus-${focus} ${showSidebar ? "" : "sidebar-collapsed"} ${editing ? "is-editing" : ""} ${sidebarIsOverlay ? "sidebar-overlay" : ""}`}
      style={{ gridTemplateColumns: gridCols }}
    >
      {showSidebar && info && (
        <Sidebar
          tree={tree}
          rootName={info.rootName}
          currentPath={currentPath}
          readPaths={readSet}
          onSelect={(p) => {
            setCurrentPath(p);
            if (sidebarIsOverlay) setZenSidebarPeek(false);
          }}
          onToggleRead={toggleRead}
        />
      )}
      {reserveSidebar && (
        <div className="resize-handle resize-h-left" onMouseDown={startSidebarResize} title="Resize sidebar" />
      )}
      {focus === "zen" && !zenSidebarPeek && (
        <div className="zen-edge-hint" title="Hover to reveal the sidebar" />
      )}

      <main className="main">
        <Topbar
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          minimapOpen={minimapOpen}
          onToggleMinimap={() => setMinimapOpen((s) => !s)}
          currentPath={currentPath}
          rootName={info?.rootName ?? "markviz"}
          isRead={!!currentPath && readSet.has(currentPath)}
          onMarkRead={markCurrentRead}
          onPrev={() => navRelative(-1)}
          onNext={() => navRelative(1)}
          focus={focus}
          onCycleFocus={cycleFocus}
          theme={theme}
          onSetTheme={setTheme}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
          editing={editing}
          onToggleEdit={() => setEditing((v) => !v)}
          canEdit={canEdit}
          onOpenFolder={() => setShowFolderPicker(true)}
          onOpenGraph={() => setShowGraph(true)}
          onPrint={() => window.print()}
          onHelp={() => setShowHelp(true)}
        />
        <div className="content">
          {error && <div className="error">{error}</div>}
          {loading && <div className="loading">Loading…</div>}
          {!loading && !error && currentPath && editing && content !== null && (
            <Editor
              initialContent={content}
              filePath={currentPath}
              kind={currentKind}
              theme={codeTheme}
              zoom={zoom}
              onSave={onSave}
              onCancel={() => setEditing(false)}
            />
          )}
          {!loading && !error && currentPath && !editing && (
            <>
              <FileView
                path={currentPath}
                kind={currentKind}
                content={content}
                url={currentUrl}
                theme={codeTheme}
                zoom={zoom}
                wikiResolver={wikiResolver}
              />
              {currentKind === "markdown" && content && (
                <div className="extras-overlay">
                  <FlashcardsBadge content={content} onStudy={() => setShowFlashcards(true)} />
                </div>
              )}
            </>
          )}
          {!loading && !error && !currentPath && (
            <div className="empty-state">
              <h2>markviz</h2>
              <p>Select a file from the sidebar to start reading.</p>
              <p className="hint">Press <kbd>?</kbd> for keyboard shortcuts.</p>
            </div>
          )}
        </div>
      </main>

      {showMinimap && (
        <div className="resize-handle resize-h-right" onMouseDown={startMinimapResize} title="Resize minimap" />
      )}
      {showMinimap && (
        <Minimap targetSelector=".md-wrapper" contentKey={`${currentPath}-${zoom}-${focus}-${theme}`} />
      )}

      {focus === "zen" && (
        <div className="zen-hint">
          ZEN MODE — press <kbd>f</kbd> to exit
        </div>
      )}

      {showFolderPicker && info && (
        <FolderPicker
          currentRoot={info.root}
          home={info.home ?? "/"}
          recent={recentFolders}
          onClose={() => setShowFolderPicker(false)}
          onOpened={reopenAt}
          onAddRecent={addRecentFolder}
        />
      )}

      {showGraph && (
        <GraphView
          currentPath={currentPath}
          onSelect={(p) => { setCurrentPath(p); setShowGraph(false); }}
          onClose={() => setShowGraph(false)}
        />
      )}

      {showFlashcards && currentPath && content && (
        <FlashcardsStudy
          content={content}
          theme={codeTheme}
          filePath={currentPath}
          onClose={() => setShowFlashcards(false)}
        />
      )}

      {showPalette && index && (
        <CommandPalette
          files={index.files}
          recentFiles={recentFiles}
          currentPath={currentPath}
          onSelect={(p) => {
            setCurrentPath(p);
            setShowPalette(false);
          }}
          onClose={() => setShowPalette(false)}
        />
      )}

      {showHelp && (
        <div className="modal" onClick={() => setShowHelp(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard shortcuts</h2>
            <table className="kbd-table">
              <tbody>
                <tr><td><kbd>Ctrl</kbd>+<kbd>P</kbd></td><td>Quick file open (palette)</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd></td><td>Search in all files</td></tr>
                <tr><td><kbd>/</kbd></td><td>Focus sidebar search</td></tr>
                <tr><td><kbd>j</kbd> / <kbd>k</kbd></td><td>Next / previous file</td></tr>
                <tr><td><kbd>f</kbd></td><td>Cycle focus mode</td></tr>
                <tr><td><kbd>m</kbd></td><td>Toggle mark-as-read</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>B</kbd></td><td>Toggle sidebar</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>M</kbd></td><td>Toggle minimap</td></tr>
                <tr><td><kbd>o</kbd></td><td>Open another folder</td></tr>
                <tr><td><kbd>g</kbd></td><td>Knowledge graph</td></tr>
                <tr><td><kbd>s</kbd></td><td>Study flashcards (if any in this file)</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>E</kbd></td><td>Edit current file</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>S</kbd></td><td>Save (in editor)</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>+</kbd> / <kbd>-</kbd> / <kbd>0</kbd></td><td>Zoom in / out / reset</td></tr>
                <tr><td><kbd>Esc</kbd></td><td>Close dialog / leave editor</td></tr>
                <tr><td><kbd>?</kbd></td><td>Show / hide this help</td></tr>
              </tbody>
            </table>
            <button onClick={() => setShowHelp(false)} className="primary">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
