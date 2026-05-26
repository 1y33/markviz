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
import { ArxivImport } from "./ArxivImport";
import { ThemeStudio } from "./ThemeStudio";
import { Pane } from "./Pane";
import { IconEdit, IconEye } from "./icons";
import { setStoragePrefix, lsGet, lsSet } from "./storage";
import type { BuiltinTheme, FileKind, FocusMode, ReadingOverlay, RootInfo, SavedTheme, Theme, ThemeCustomization, TreeNode } from "./types";

const BUILTIN_THEMES: BuiltinTheme[] = [
  "dark", "light", "github-light", "sepia", "solarized",
  "nord", "dracula", "gruvbox-dark", "tokyo-night", "catppuccin-mocha", "rose-pine",
];

function isBuiltinTheme(t: string): t is BuiltinTheme {
  return (BUILTIN_THEMES as string[]).includes(t);
}

function getInitialFileFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("file");
}

function getInitialPageFromUrl(): number | null {
  const v = new URLSearchParams(window.location.search).get("page");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
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
  url.searchParams.delete("page");
  window.history.replaceState({}, "", url);
}

function setUrlPage(page: number | null) {
  const url = new URL(window.location.href);
  if (page && page > 1) url.searchParams.set("page", String(page));
  else url.searchParams.delete("page");
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

function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f0-9]{3}|[a-f0-9]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hexToRgba(hex: string, a: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${a})`;
}

function lightenHex(hex: string, amt: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [r, g, b] = rgb.map((c) => Math.round(c + (255 - c) * amt)) as [number, number, number];
  return `rgb(${r}, ${g}, ${b})`;
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
  const [overlay, setOverlay] = useState<ReadingOverlay>(() => lsGet<ReadingOverlay>("overlay", "off"));
  useEffect(() => { if (info) lsSet("overlay", overlay); }, [overlay, info]);
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
  const [showArxiv, setShowArxiv] = useState(false);
  const [pdfInitialPage, setPdfInitialPage] = useState<number | null>(() => getInitialPageFromUrl());
  const [showThemeStudio, setShowThemeStudio] = useState(false);
  const [themeCustom, setThemeCustom] = useState<Record<string, ThemeCustomization>>(
    () => lsGet<Record<string, ThemeCustomization>>("themeCustom", {}),
  );
  const [savedThemes, setSavedThemes] = useState<Record<string, SavedTheme>>(
    () => lsGet<Record<string, SavedTheme>>("savedThemes", {}),
  );

  // === Split view (right pane) ===
  const [splitOpen, setSplitOpen] = useState<boolean>(() => lsGet<boolean>("splitOpen", false));
  const [splitRatio, setSplitRatio] = useState<number>(() => lsGet<number>("splitRatio", 0.5));
  const [rightPath, setRightPath] = useState<string | null>(() => lsGet<string | null>("rightPath", null));
  const [rightPdfInitialPage, setRightPdfInitialPage] = useState<number | null>(null);
  const [activePane, setActivePane] = useState<"left" | "right">("left");

  useEffect(() => { if (info) lsSet("splitOpen", splitOpen); }, [splitOpen, info]);
  useEffect(() => { if (info) lsSet("splitRatio", splitRatio); }, [splitRatio, info]);
  useEffect(() => { if (info) lsSet("rightPath", rightPath); }, [rightPath, info]);

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

  // Resolve the active theme into (builtin base, customization). For builtin
  // themes we use the per-theme overrides map; for saved custom themes we use
  // the customization that was frozen into the SavedTheme when it was created.
  const resolvedTheme = useMemo<{ base: BuiltinTheme; customization: ThemeCustomization }>(() => {
    if (typeof theme === "string" && theme.startsWith("custom:")) {
      const key = theme.slice("custom:".length);
      const saved = savedThemes[key];
      if (saved) return { base: saved.base, customization: saved.customization };
    }
    if (isBuiltinTheme(theme)) {
      return { base: theme, customization: themeCustom[theme] ?? {} };
    }
    return { base: "dark", customization: {} };
  }, [theme, themeCustom, savedThemes]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme.base;
    document.documentElement.dataset.focus = focus;
    if (overlay && overlay !== "off") document.documentElement.dataset.overlay = overlay;
    else delete document.documentElement.dataset.overlay;
  }, [resolvedTheme.base, focus, overlay]);

  // Persist customizations + saved themes.
  useEffect(() => { if (info) lsSet("themeCustom", themeCustom); }, [themeCustom, info]);
  useEffect(() => { if (info) lsSet("savedThemes", savedThemes); }, [savedThemes, info]);
  useEffect(() => {
    const root = document.documentElement;
    const c = resolvedTheme.customization;
    // Build a list of (var, value) so we can both apply and clean up.
    const vars: Array<[string, string | null]> = [
      ["--font-sans", c.fontSans ?? null],
      ["--font-mono", c.fontMono ?? null],
      ["--font-serif", c.fontSerif ?? null],
      ["--reader-font-size", c.fontSizePx ? `${c.fontSizePx}px` : null],
      ["--reader-line-height", c.lineHeight ? String(c.lineHeight) : null],
      ["--md-content-max", c.contentMaxPx ? `${c.contentMaxPx}px` : null],
    ];
    for (const [k, v] of vars) {
      if (v) root.style.setProperty(k, v);
      else root.style.removeProperty(k);
    }
    // Accent + derived alpha variants.
    if (c.accent) {
      root.style.setProperty("--accent", c.accent);
      root.style.setProperty("--accent-hover", lightenHex(c.accent, 0.18));
      root.style.setProperty("--accent-soft", hexToRgba(c.accent, 0.16));
      root.style.setProperty("--accent-border", hexToRgba(c.accent, 0.4));
      root.style.setProperty("--selection", hexToRgba(c.accent, 0.28));
    } else {
      for (const k of ["--accent", "--accent-hover", "--accent-soft", "--accent-border", "--selection"]) {
        root.style.removeProperty(k);
      }
    }
    // Serif-body toggle is a data attribute we hook in CSS.
    if (c.serifBody) root.dataset.serifBody = "1";
    else delete root.dataset.serifBody;
  }, [resolvedTheme]);

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

  // Sibling note for any PDF: same path with .pdf swapped for .md / .markdown.
  // Resolved via the file index so we don't 404 against the server.
  const resolveSiblingNote = useCallback((pdfPath: string) => {
    if (!pdfPath.toLowerCase().endsWith(".pdf")) return null;
    const stem = pdfPath.replace(/\.pdf$/i, "");
    const candidates = [`${stem}.md`, `${stem}.markdown`, `${stem}.mdx`];
    const files = index?.files ?? [];
    for (const c of candidates) {
      if (files.includes(c)) return { path: c, exists: true };
    }
    return { path: `${stem}.md`, exists: false };
  }, [index]);

  const pdfSibling = useMemo(() => {
    if (currentKind !== "pdf" || !currentPath) return null;
    return resolveSiblingNote(currentPath);
  }, [currentKind, currentPath, resolveSiblingNote]);

  const createSiblingNote = useCallback(async (pdfPath: string): Promise<string> => {
    const sib = resolveSiblingNote(pdfPath);
    if (!sib) throw new Error("not a pdf");
    if (sib.exists) return sib.path;
    const pdfName = pdfPath.split("/").pop() ?? "paper.pdf";
    const stem = pdfName.replace(/\.pdf$/i, "");
    const title = stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const today = new Date().toISOString().slice(0, 10);
    const template = `# ${title}

> Notes on [\`${pdfName}\`](./${pdfName}).

**Started:** ${today}

#paper

## Summary

_Three sentences on what this paper is about._

## Key ideas

-
-
-

## Quotes

>
> — p. _N_

## Open questions

-

## Flashcards

\`\`\`flashcards
Q:
A:
\`\`\`
`;
    await saveFile(sib.path, template);
    await reloadTree();
    return sib.path;
  }, [resolveSiblingNote, reloadTree]);

  // Open a sibling note when the user clicks the PDF toolbar button. If the
  // split view is open, the note opens in the *other* pane so PDF + note
  // sit side by side; if not, the split view auto-opens.
  const openSiblingFromPane = useCallback(async (siblingPath: string, exists: boolean, fromPdfPath: string) => {
    let target = siblingPath;
    if (!exists) {
      try {
        target = await createSiblingNote(fromPdfPath);
      } catch (e: unknown) {
        setError((e as Error).message);
        return;
      }
    }
    // Auto-open split view if it's currently single-pane.
    if (!splitOpen) {
      setSplitOpen(true);
      setRightPath(target);
      setActivePane("right");
    } else {
      // Show the note in the pane that does NOT contain the PDF.
      if (currentPath === fromPdfPath) {
        setRightPath(target);
        setActivePane("right");
      } else {
        setCurrentPath(target);
        setActivePane("left");
      }
    }
  }, [splitOpen, currentPath, createSiblingNote]);

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
      const ce = e as CustomEvent<{ href: string; from: string | null; abs?: boolean; pane?: "left" | "right" }>;
      const resolved = ce.detail.abs
        ? ce.detail.href.split("#")[0]
        : resolveRelativeHref(ce.detail.from, ce.detail.href);
      const hashIdx = ce.detail.href.indexOf("#");
      const hash = hashIdx >= 0 ? ce.detail.href.slice(hashIdx + 1) : "";
      const pageMatch = /^p=(\d+)$/i.exec(hash);
      // Decide which pane to drive: explicit override → active pane (if split
      // is open) → left.
      const targetPane: "left" | "right" =
        ce.detail.pane ?? (splitOpen ? activePane : "left");
      if (targetPane === "right") {
        setRightPath(resolved);
        if (pageMatch) setRightPdfInitialPage(Number(pageMatch[1]));
      } else {
        setCurrentPath(resolved);
        if (pageMatch) setPdfInitialPage(Number(pageMatch[1]));
      }
      if (hash && !pageMatch) {
        // Markdown heading anchor.
        setTimeout(() => {
          const el = document.getElementById(hash);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 250);
      }
    };
    window.addEventListener("markviz:navigate", handler as EventListener);
    return () => window.removeEventListener("markviz:navigate", handler as EventListener);
  }, [splitOpen, activePane]);

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
      if ((e.metaKey || e.ctrlKey) && e.key === "\\") {
        e.preventDefault();
        setSplitOpen((s) => {
          const next = !s;
          if (next && !rightPath && currentPath) setRightPath(currentPath);
          return next;
        });
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
      else if (e.key === "a") setShowArxiv(true);
      else if (e.key === "?") setShowHelp((v) => !v);
      else if (e.key === "Escape") {
        setShowHelp(false);
        setShowFolderPicker(false);
        setShowGraph(false);
        setShowFlashcards(false);
        setShowPalette(false);
        setShowArxiv(false);
        setShowThemeStudio(false);
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
          rightPath={splitOpen ? rightPath : null}
          readPaths={readSet}
          onSelect={(p) => {
            if (activePane === "right" && splitOpen) setRightPath(p);
            else setCurrentPath(p);
            if (sidebarIsOverlay) setZenSidebarPeek(false);
          }}
          onOpenInRightPane={(p) => {
            setSplitOpen(true);
            setRightPath(p);
            setActivePane("right");
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
          onArxivImport={() => setShowArxiv(true)}
          onCustomizeTheme={() => setShowThemeStudio(true)}
          savedThemes={savedThemes}
          onDeleteSavedTheme={(name) => {
            setSavedThemes((all) => {
              const next = { ...all };
              delete next[name];
              return next;
            });
            const id = `custom:${name}` as Theme;
            if (theme === id) {
              const saved = savedThemes[name];
              setTheme(saved?.base ?? "dark");
            }
          }}
          overlay={overlay}
          onSetOverlay={setOverlay}
          splitOpen={splitOpen}
          onToggleSplit={() => {
            setSplitOpen((s) => {
              const next = !s;
              if (next && !rightPath && currentPath) setRightPath(currentPath);
              return next;
            });
          }}
          onSwapPanes={() => {
            const l = currentPath;
            const r = rightPath;
            setCurrentPath(r);
            setRightPath(l);
          }}
        />
        <div
          className={`content ${splitOpen ? "is-split" : ""}`}
          style={splitOpen ? { gridTemplateColumns: `${splitRatio * 100}% 6px 1fr` } : undefined}
        >
          {/* Left pane = the historical "main view" backed by App state so
              backlinks, flashcards, minimap continue to attach to it. */}
          <section
            className={`pane pane-left ${activePane === "left" && splitOpen ? "is-active" : ""}`}
            onMouseDown={() => setActivePane("left")}
          >
            {splitOpen && (
              <div className="pane-header">
                <div className="pane-label" title={currentPath ?? ""}>
                  <span className="pane-side-tag">L</span>
                  <span className="pane-filename">
                    {currentPath ? currentPath.split("/").pop() : "Empty"}
                  </span>
                </div>
                <div className="pane-header-actions">
                  {canEdit && (
                    <button
                      className={`iconbtn ghost ${editing ? "is-active" : ""}`}
                      onClick={() => setEditing((v) => !v)}
                      title={editing ? "View" : "Edit"}
                    >
                      {editing ? <IconEye size={13} /> : <IconEdit size={13} />}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="pane-body">
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
                    pdfInitialPage={pdfInitialPage ?? undefined}
                    pdfSiblingNoteState={
                      currentKind === "pdf"
                        ? pdfSibling?.exists ? "exists" : "missing"
                        : "unknown"
                    }
                    onOpenPdfSiblingNote={
                      currentKind === "pdf" && pdfSibling
                        ? () => openSiblingFromPane(pdfSibling.path, pdfSibling.exists, currentPath!)
                        : undefined
                    }
                    onPdfPageChange={(p) => {
                      setUrlPage(p);
                      setPdfInitialPage(null);
                    }}
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
          </section>

          {splitOpen && (
            <div
              className="resize-handle resize-h-split"
              onMouseDown={(e) => {
                e.preventDefault();
                const startX = e.clientX;
                const startRatio = splitRatio;
                const container = (e.currentTarget.parentElement as HTMLElement);
                const containerWidth = container.getBoundingClientRect().width;
                const move = (ev: MouseEvent) => {
                  const dx = ev.clientX - startX;
                  const next = Math.min(0.85, Math.max(0.15, startRatio + dx / containerWidth));
                  setSplitRatio(next);
                };
                const up = () => {
                  window.removeEventListener("mousemove", move);
                  window.removeEventListener("mouseup", up);
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
              }}
              onDoubleClick={() => setSplitRatio(0.5)}
              title="Drag to resize · double-click for 50/50"
            />
          )}

          {splitOpen && (
            <Pane
              side="right"
              active={activePane === "right"}
              path={rightPath}
              pdfInitialPage={rightPdfInitialPage}
              theme={codeTheme}
              zoom={zoom}
              wikiResolver={wikiResolver}
              onFocus={() => setActivePane("right")}
              onPathChange={(p) => setRightPath(p)}
              onClose={() => {
                setSplitOpen(false);
                setActivePane("left");
              }}
              resolveSiblingNote={resolveSiblingNote}
              onOpenSibling={openSiblingFromPane}
              showFlashcards={() => setShowFlashcards(true)}
              reloadTreeAfterSave={reloadTree}
            />
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

      {showThemeStudio && (
        <ThemeStudio
          activeTheme={theme}
          baseTheme={resolvedTheme.base}
          value={resolvedTheme.customization}
          existingSavedNames={Object.keys(savedThemes)}
          onChange={(next) => {
            if (typeof theme === "string" && theme.startsWith("custom:")) {
              const name = theme.slice("custom:".length);
              setSavedThemes((all) => ({
                ...all,
                [name]: { ...(all[name] ?? { name, base: resolvedTheme.base }), name, base: resolvedTheme.base, customization: next },
              }));
            } else if (isBuiltinTheme(theme)) {
              setThemeCustom((all) => ({ ...all, [theme]: next }));
            }
          }}
          onReset={() => {
            if (typeof theme === "string" && theme.startsWith("custom:")) {
              const name = theme.slice("custom:".length);
              setSavedThemes((all) => ({
                ...all,
                [name]: { ...(all[name] ?? { name, base: resolvedTheme.base }), customization: {} },
              }));
            } else if (isBuiltinTheme(theme)) {
              setThemeCustom((all) => {
                const copy = { ...all };
                delete copy[theme];
                return copy;
              });
            }
          }}
          onSaveAs={(saved, replaceName) => {
            setSavedThemes((all) => {
              const next = { ...all };
              if (replaceName && replaceName !== saved.name) delete next[replaceName];
              next[saved.name] = saved;
              return next;
            });
            setTheme(`custom:${saved.name}` as Theme);
          }}
          onClose={() => setShowThemeStudio(false)}
        />
      )}

      {showArxiv && (
        <ArxivImport
          defaultDir={currentPath && currentPath.includes("/")
            ? currentPath.slice(0, currentPath.lastIndexOf("/"))
            : "."}
          onClose={() => setShowArxiv(false)}
          onImported={async (savedPath) => {
            setShowArxiv(false);
            await reloadTree();
            setCurrentPath(savedPath);
          }}
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
                <tr><td><kbd>a</kbd></td><td>Import arXiv paper as PDF</td></tr>
                <tr><td><kbd>Ctrl</kbd>+<kbd>\</kbd></td><td>Toggle split view (2 panes)</td></tr>
                <tr><td>Alt-click in sidebar</td><td>Open file in the right pane</td></tr>
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
