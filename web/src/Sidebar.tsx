import { useMemo, useState, useEffect, useRef } from "react";
import type { TreeNode } from "./types";
import {
  IconSearch,
  IconClose,
  IconCaretRight,
  IconCaretDown,
  IconFolder,
  IconFolderOpen,
  IconFileText,
  IconFile,
  IconImage,
  IconCode,
  IconFilePdf,
  IconBookmark,
  IconBookmarkFilled,
} from "./icons";

interface Props {
  tree: TreeNode[];
  rootName: string;
  currentPath: string | null;
  rightPath?: string | null;
  readPaths: Set<string>;
  onSelect: (path: string) => void;
  onOpenInRightPane?: (path: string) => void;
  onToggleRead: (path: string) => void;
  onContextMenu?: (node: TreeNode, x: number, y: number) => void;
  // Move `sourcePath` into `destDir` ("" for root). Sidebar calls this on
  // drop; the caller does the actual filesystem rename + tree reload.
  onMove?: (sourcePath: string, destDir: string) => Promise<void> | void;
  // Pinned paths shown in a separate top section.
  pinnedPaths?: string[];
  onTogglePin?: (path: string) => void;
}

interface TreeViewProps {
  nodes: TreeNode[];
  depth: number;
  currentPath: string | null;
  rightPath?: string | null;
  readPaths: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (p: string) => void;
  onSelect: (p: string) => void;
  onOpenInRightPane?: (p: string) => void;
  onToggleRead: (p: string) => void;
  onContextMenu?: (node: TreeNode, x: number, y: number) => void;
  onMove?: (sourcePath: string, destDir: string) => Promise<void> | void;
  // Shared drag state so we know what's being dragged at all times.
  dragState: DragState;
  setDragState: (s: DragState) => void;
}

interface DragState {
  // The path being dragged, or null when nothing is in flight.
  source: string | null;
  // The directory currently being hovered as a drop target, or null.
  hoverDir: string | null;
  // Briefly highlight a drop target after a successful drop.
  flashDir: string | null;
}

function flatten(nodes: TreeNode[], out: TreeNode[] = []): TreeNode[] {
  for (const n of nodes) {
    if (n.type === "file") out.push(n);
    if (n.children) flatten(n.children, out);
  }
  return out;
}

function matches(name: string, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return name.toLowerCase().includes(q);
}

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const result: TreeNode[] = [];
  for (const n of nodes) {
    if (n.type === "file") {
      if (matches(n.name, query) || matches(n.path, query)) result.push(n);
    } else if (n.children) {
      const filtered = filterTree(n.children, query);
      if (filtered.length > 0 || matches(n.name, query)) {
        result.push({ ...n, children: filtered });
      }
    }
  }
  return result;
}

function fileIcon(kind: TreeNode["kind"]) {
  switch (kind) {
    case "markdown":
      return <IconFileText size={14} />;
    case "image":
      return <IconImage size={14} />;
    case "text":
      return <IconCode size={14} />;
    case "pdf":
      return <IconFilePdf size={14} />;
    default:
      return <IconFile size={14} />;
  }
}

function TreeView({
  nodes,
  depth,
  currentPath,
  rightPath,
  readPaths,
  expanded,
  onToggleExpand,
  onSelect,
  onOpenInRightPane,
  onToggleRead,
  onContextMenu,
  onMove,
  dragState,
  setDragState,
}: TreeViewProps) {
  // Returns true when `dest` is `source` or contains it — used to forbid
  // dragging a folder into itself or one of its descendants.
  const isInvalidDrop = (source: string, dest: string) => {
    if (!source) return true;
    if (dest === source) return true;
    if (dest.startsWith(source + "/")) return true;
    // No-op move: dropping into the parent folder of the source.
    const srcParent = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
    if (srcParent === dest) return true;
    return false;
  };
  return (
    <ul className="tree" role="tree">
      {nodes.map((n) => {
        const isOpen = expanded.has(n.path);
        const isLeftActive = n.type === "file" && n.path === currentPath;
        const isRightActive = n.type === "file" && n.path === rightPath;
        const isActive = isLeftActive || isRightActive;
        const isRead = readPaths.has(n.path);
        const isDragSource = dragState.source === n.path;
        const isDropTarget = n.type === "dir" && dragState.hoverDir === n.path && dragState.source !== null && !isInvalidDrop(dragState.source, n.path);
        const isDropFlash = n.type === "dir" && dragState.flashDir === n.path;
        return (
          <li key={n.path} role="treeitem" aria-expanded={n.type === "dir" ? isOpen : undefined}>
            <div
              className={`tree-row ${isActive ? "active" : ""} ${isRead && n.type === "file" ? "read" : ""} ${isDragSource ? "is-drag-source" : ""} ${isDropTarget ? "is-drop-target" : ""} ${isDropFlash ? "is-drop-flash" : ""}`}
              style={{ paddingLeft: depth * 12 + 8 }}
              draggable={!!onMove}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/markviz-path", n.path);
                // Custom drag ghost: a small pill with the filename so the
                // default "row screenshot" doesn't look ugly.
                const ghost = document.createElement("div");
                ghost.className = "drag-ghost";
                ghost.textContent = n.name + (n.type === "dir" ? "/" : "");
                document.body.appendChild(ghost);
                e.dataTransfer.setDragImage(ghost, 12, 12);
                setTimeout(() => ghost.remove(), 0);
                setDragState({ source: n.path, hoverDir: null, flashDir: null });
              }}
              onDragEnd={() => {
                setDragState({ source: null, hoverDir: null, flashDir: dragState.flashDir });
              }}
              onDragOver={(e) => {
                if (n.type !== "dir" || !dragState.source) return;
                if (isInvalidDrop(dragState.source, n.path)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragState.hoverDir !== n.path) {
                  setDragState({ ...dragState, hoverDir: n.path });
                }
              }}
              onDragLeave={(e) => {
                if (n.type !== "dir") return;
                // Only clear if leaving for somewhere outside this row.
                const related = e.relatedTarget as Node | null;
                if (related && (e.currentTarget as HTMLElement).contains(related)) return;
                if (dragState.hoverDir === n.path) {
                  setDragState({ ...dragState, hoverDir: null });
                }
              }}
              onDrop={async (e) => {
                if (n.type !== "dir" || !dragState.source) return;
                e.preventDefault();
                const source = dragState.source;
                if (isInvalidDrop(source, n.path)) {
                  setDragState({ source: null, hoverDir: null, flashDir: null });
                  return;
                }
                // Flash the drop target briefly to acknowledge the move.
                setDragState({ source: null, hoverDir: null, flashDir: n.path });
                window.setTimeout(() => {
                  setDragState({ source: null, hoverDir: null, flashDir: null });
                }, 600);
                try {
                  await onMove?.(source, n.path);
                } catch {
                  // Swallow — App-level error handling shows a toast.
                }
              }}
              onClick={(e) => {
                if (n.type === "dir") onToggleExpand(n.path);
                else if (n.type === "file") {
                  // alt-click (or ⌘-click on mac) → right pane.
                  if ((e.altKey || e.metaKey) && onOpenInRightPane) onOpenInRightPane(n.path);
                  else onSelect(n.path);
                }
              }}
              onContextMenu={(e) => {
                if (!onContextMenu) return;
                e.preventDefault();
                onContextMenu(n, e.clientX, e.clientY);
              }}
              title={n.type === "file" ? `${n.path}\n(alt-click → open in right pane · right-click → menu · drag → move)` : `${n.path}\n(drag a file here to move it)`}
            >
              <span className="caret">
                {n.type === "dir" ? (isOpen ? <IconCaretDown size={12} /> : <IconCaretRight size={12} />) : null}
              </span>
              <span className={`icon ${n.type === "dir" ? "icon-dir" : "icon-file"}`}>
                {n.type === "dir" ? (
                  isOpen ? <IconFolderOpen size={14} /> : <IconFolder size={14} />
                ) : (
                  fileIcon(n.kind)
                )}
              </span>
              <span className="label" title={n.path}>
                {n.name}
                {isLeftActive && <span className="pane-marker pane-marker-l">L</span>}
                {isRightActive && <span className="pane-marker pane-marker-r">R</span>}
              </span>
              {n.type === "file" && onOpenInRightPane && (
                <button
                  className="open-right"
                  title="Open in right pane"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenInRightPane(n.path);
                  }}
                >
                  ⇥
                </button>
              )}
              {n.type === "file" && (
                <button
                  className={`mark-read ${isRead ? "is-read" : ""}`}
                  title={isRead ? "Unmark" : "Mark as read"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleRead(n.path);
                  }}
                >
                  {isRead ? <IconBookmarkFilled size={12} /> : <IconBookmark size={12} />}
                </button>
              )}
            </div>
            {n.type === "dir" && isOpen && n.children && (
              <TreeView
                nodes={n.children}
                depth={depth + 1}
                currentPath={currentPath}
                rightPath={rightPath}
                readPaths={readPaths}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onOpenInRightPane={onOpenInRightPane}
                onToggleRead={onToggleRead}
                onContextMenu={onContextMenu}
                onMove={onMove}
                dragState={dragState}
                setDragState={setDragState}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar(props: Props) {
  const {
    tree,
    rootName,
    currentPath,
    rightPath,
    readPaths,
    onSelect,
    onOpenInRightPane,
    onToggleRead,
    onContextMenu,
    onMove,
    pinnedPaths,
    onTogglePin,
  } = props;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragState, setDragState] = useState<DragState>({ source: null, hoverDir: null, flashDir: null });
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the tree when the user drags near the top or bottom edge.
  // Saves the headache of mid-drag scrolling.
  useEffect(() => {
    if (!dragState.source) return;
    let raf = 0;
    const onMove = (e: DragEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const margin = 28;
      let delta = 0;
      if (e.clientY < rect.top + margin) delta = -(margin - (e.clientY - rect.top)) * 0.5;
      else if (e.clientY > rect.bottom - margin) delta = ((e.clientY - rect.bottom) + margin) * 0.5;
      if (delta !== 0) {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => { el.scrollTop += delta; });
      }
    };
    window.addEventListener("dragover", onMove);
    return () => {
      window.removeEventListener("dragover", onMove);
      cancelAnimationFrame(raf);
    };
  }, [dragState.source]);

  // Look up every node in the tree by path so we can render pinned files
  // with the same icon/kind metadata as in the tree.
  const nodeByPath = useMemo(() => {
    const map = new Map<string, TreeNode>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        map.set(n.path, n);
        if (n.children) walk(n.children);
      }
    };
    walk(tree);
    return map;
  }, [tree]);

  const filtered = useMemo(() => filterTree(tree, query), [tree, query]);

  const effectiveExpanded = useMemo(() => {
    if (!query) return expanded;
    const all = new Set<string>();
    const walk = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "dir") {
          all.add(n.path);
          if (n.children) walk(n.children);
        }
      }
    };
    walk(filtered);
    return all;
  }, [query, expanded, filtered]);

  const toggleExpand = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  useEffect(() => {
    if (!currentPath) return;
    const parts = currentPath.split("/").slice(0, -1);
    let acc = "";
    const next = new Set(expanded);
    for (const p of parts) {
      acc = acc ? `${acc}/${p}` : p;
      next.add(acc);
    }
    setExpanded(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPath]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (!isTyping && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const allFiles = useMemo(() => flatten(tree), [tree]);
  const fileCount = allFiles.length;
  const readCount = allFiles.filter((n) => readPaths.has(n.path)).length;
  const progress = fileCount > 0 ? (readCount / fileCount) * 100 : 0;

  // Drop on the sidebar header / root area = move to root ("").
  const rootDropHandlers = onMove ? {
    onDragOver: (e: React.DragEvent) => {
      if (!dragState.source) return;
      // Don't allow drop on root if the file is already at root.
      const srcParent = dragState.source.includes("/") ? dragState.source.slice(0, dragState.source.lastIndexOf("/")) : "";
      if (srcParent === "") return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragState.hoverDir !== "") {
        setDragState({ ...dragState, hoverDir: "" });
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      const related = e.relatedTarget as Node | null;
      if (related && (e.currentTarget as HTMLElement).contains(related)) return;
      if (dragState.hoverDir === "") {
        setDragState({ ...dragState, hoverDir: null });
      }
    },
    onDrop: async (e: React.DragEvent) => {
      if (!dragState.source) return;
      e.preventDefault();
      const source = dragState.source;
      setDragState({ source: null, hoverDir: null, flashDir: "__root__" });
      window.setTimeout(() => setDragState({ source: null, hoverDir: null, flashDir: null }), 600);
      try { await onMove(source, ""); } catch {}
    },
  } : {};

  const pinnedNodes = (pinnedPaths ?? [])
    .map((p) => nodeByPath.get(p))
    .filter((n): n is TreeNode => Boolean(n));

  return (
    <aside className="sidebar">
      <div
        className={`sidebar-header ${dragState.hoverDir === "" ? "is-drop-target" : ""} ${dragState.flashDir === "__root__" ? "is-drop-flash" : ""}`}
        {...rootDropHandlers}
      >
        <div className="root-name" title={rootName}>
          {rootName}
        </div>
        <div className="progress-row">
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${progress}%` }} /></div>
          <span className="stats">{readCount}/{fileCount}</span>
        </div>
      </div>
      <div className="search">
        <span className="search-icon"><IconSearch size={14} /></span>
        <input
          ref={searchRef}
          type="text"
          placeholder="Search files"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button className="clear" onClick={() => setQuery("")} title="Clear">
            <IconClose size={14} />
          </button>
        )}
      </div>
      {pinnedNodes.length > 0 && !query && (
        <div className="pinned-section">
          <div className="pinned-title">Pinned</div>
          <ul className="tree pinned-list" role="list">
            {pinnedNodes.map((n) => {
              const isLeftActive = n.path === currentPath;
              const isRightActive = n.path === rightPath;
              const isActive = isLeftActive || isRightActive;
              return (
                <li key={n.path} role="treeitem">
                  <div
                    className={`tree-row pinned-row ${isActive ? "active" : ""}`}
                    onClick={(e) => {
                      if ((e.altKey || e.metaKey) && onOpenInRightPane) onOpenInRightPane(n.path);
                      else onSelect(n.path);
                    }}
                    onContextMenu={(e) => {
                      if (!onContextMenu) return;
                      e.preventDefault();
                      onContextMenu(n, e.clientX, e.clientY);
                    }}
                    title={`${n.path}\n(right-click → unpin)`}
                  >
                    <span className="pinned-dot" />
                    <span className={`icon icon-file`}>{fileIcon(n.kind)}</span>
                    <span className="label">{n.name}</span>
                    {onTogglePin && (
                      <button
                        className="pinned-remove"
                        title="Unpin"
                        onClick={(e) => { e.stopPropagation(); onTogglePin(n.path); }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <div className="tree-scroll" ref={scrollRef}>
        {filtered.length === 0 ? (
          <div className="empty">No files found</div>
        ) : (
          <TreeView
            nodes={filtered}
            depth={0}
            currentPath={currentPath}
            rightPath={rightPath}
            readPaths={readPaths}
            expanded={effectiveExpanded}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
            onOpenInRightPane={onOpenInRightPane}
            onToggleRead={onToggleRead}
            onContextMenu={onContextMenu}
            onMove={onMove}
            dragState={dragState}
            setDragState={setDragState}
          />
        )}
      </div>
    </aside>
  );
}
