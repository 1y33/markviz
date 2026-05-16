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
  IconBookmark,
  IconBookmarkFilled,
} from "./icons";

interface Props {
  tree: TreeNode[];
  rootName: string;
  currentPath: string | null;
  readPaths: Set<string>;
  onSelect: (path: string) => void;
  onToggleRead: (path: string) => void;
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
    default:
      return <IconFile size={14} />;
  }
}

function TreeView({
  nodes,
  depth,
  currentPath,
  readPaths,
  expanded,
  onToggleExpand,
  onSelect,
  onToggleRead,
}: {
  nodes: TreeNode[];
  depth: number;
  currentPath: string | null;
  readPaths: Set<string>;
  expanded: Set<string>;
  onToggleExpand: (p: string) => void;
  onSelect: (p: string) => void;
  onToggleRead: (p: string) => void;
}) {
  return (
    <ul className="tree" role="tree">
      {nodes.map((n) => {
        const isOpen = expanded.has(n.path);
        const isActive = n.type === "file" && n.path === currentPath;
        const isRead = readPaths.has(n.path);
        return (
          <li key={n.path} role="treeitem" aria-expanded={n.type === "dir" ? isOpen : undefined}>
            <div
              className={`tree-row ${isActive ? "active" : ""} ${isRead && n.type === "file" ? "read" : ""}`}
              style={{ paddingLeft: depth * 12 + 8 }}
              onClick={() => {
                if (n.type === "dir") onToggleExpand(n.path);
                else onSelect(n.path);
              }}
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
              </span>
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
                readPaths={readPaths}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
                onSelect={onSelect}
                onToggleRead={onToggleRead}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar(props: Props) {
  const { tree, rootName, currentPath, readPaths, onSelect, onToggleRead } = props;
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

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

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
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
      <div className="tree-scroll">
        {filtered.length === 0 ? (
          <div className="empty">No files found</div>
        ) : (
          <TreeView
            nodes={filtered}
            depth={0}
            currentPath={currentPath}
            readPaths={readPaths}
            expanded={effectiveExpanded}
            onToggleExpand={toggleExpand}
            onSelect={onSelect}
            onToggleRead={onToggleRead}
          />
        )}
      </div>
    </aside>
  );
}
