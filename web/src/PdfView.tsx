import { useEffect, useRef, useState, useCallback } from "react";
import {
  GlobalWorkerOptions,
  getDocument,
  TextLayer,
  type PDFDocumentProxy,
  type PDFPageProxy,
} from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  IconChevronLeft,
  IconChevronRight,
  IconZoomIn,
  IconZoomOut,
  IconRefresh,
  IconFileText,
  IconCaretRight,
  IconCaretDown,
} from "./icons";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface Props {
  src: string;
  filePath: string;
  theme: "dark" | "light";
  zoom: number;
  initialPage?: number;
  onOpenSiblingNote?: () => void;
  siblingNoteState?: "exists" | "missing" | "unknown";
  onPageChange?: (page: number) => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 3;

export function PdfView({
  src,
  filePath,
  theme,
  zoom,
  initialPage,
  onOpenSiblingNote,
  siblingNoteState,
  onPageChange,
}: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scale, setScale] = useState(1.2);
  const [activePage, setActivePage] = useState(initialPage ?? 1);
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const pendingInitialJump = useRef<number | null>(initialPage ?? null);

  type OutlineNode = { title: string; page: number | null; children: OutlineNode[] };
  const [outline, setOutline] = useState<OutlineNode[] | null>(null);
  const [outlineOpen, setOutlineOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setDoc(null);
    setNumPages(0);
    setLoadError(null);
    setActivePage(initialPage ?? 1);
    pendingInitialJump.current = initialPage ?? null;
    const task = getDocument({ url: src });
    task.promise.then(
      (d) => {
        if (cancelled) {
          d.destroy();
          return;
        }
        setDoc(d);
        setNumPages(d.numPages);
      },
      (err) => {
        if (!cancelled) setLoadError(err?.message ?? "Failed to load PDF");
      },
    );
    return () => {
      cancelled = true;
      task.destroy();
    };
  }, [src, initialPage]);

  // Fetch the PDF outline (chapters) and resolve each entry to a page number.
  useEffect(() => {
    if (!doc) {
      setOutline(null);
      return;
    }
    let cancelled = false;
    (async () => {
      // pdf.js types: getOutline() returns Array<{ title, dest, items, ... }> | null.
      // `dest` can be a string (named destination) or an array; either way we
      // can resolve it to an explicit dest, then to a page index.
      const resolveOne = async (entry: {
        title: string;
        dest?: string | unknown[] | null;
        items?: unknown[];
      }): Promise<OutlineNode> => {
        let page: number | null = null;
        try {
          let dest = entry.dest as unknown as string | unknown[] | null;
          if (typeof dest === "string") {
            dest = await doc.getDestination(dest);
          }
          if (Array.isArray(dest) && dest[0]) {
            const ref = dest[0] as { num: number; gen: number };
            const idx = await doc.getPageIndex(ref);
            page = idx + 1;
          }
        } catch {
          page = null;
        }
        const children = await Promise.all(
          ((entry.items as Array<{ title: string; dest?: unknown; items?: unknown[] }>) ?? []).map(resolveOne),
        );
        return { title: entry.title, page, children };
      };
      try {
        const raw = await doc.getOutline();
        if (cancelled) return;
        if (!raw || raw.length === 0) {
          setOutline([]);
          return;
        }
        const tree = await Promise.all(raw.map(resolveOne));
        if (cancelled) return;
        setOutline(tree);
        // If there's a meaningful outline (more than one chapter), open the
        // panel by default so users discover it.
        setOutlineOpen(tree.length >= 2);
      } catch {
        if (!cancelled) setOutline([]);
      }
    })();
    return () => { cancelled = true; };
  }, [doc]);

  // Render each page: canvas image + selectable text layer overlay.
  useEffect(() => {
    if (!doc) return;
    const dpr = window.devicePixelRatio || 1;
    const effective = scale * zoom * dpr;
    const cssScale = scale * zoom;
    let cancelled = false;
    const renderTasks: Array<{ cancel: () => void } | null> = [];

    (async () => {
      for (let i = 1; i <= doc.numPages; i++) {
        if (cancelled) return;
        const wrapper = pageRefs.current.get(i);
        if (!wrapper) continue;
        const canvas = wrapper.querySelector("canvas") as HTMLCanvasElement | null;
        const textLayerDiv = wrapper.querySelector(".pdf-text-layer") as HTMLDivElement | null;
        if (!canvas) continue;
        let page: PDFPageProxy;
        try {
          page = await doc.getPage(i);
        } catch {
          continue;
        }
        if (cancelled) return;

        const viewport = page.getViewport({ scale: effective });
        const cssViewport = page.getViewport({ scale: cssScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = `${cssViewport.width}px`;
        canvas.style.height = `${cssViewport.height}px`;
        wrapper.style.width = `${cssViewport.width}px`;
        wrapper.style.height = `${cssViewport.height}px`;

        const ctx = canvas.getContext("2d");
        if (!ctx) continue;
        const task = page.render({ canvasContext: ctx, viewport });
        renderTasks.push(task as unknown as { cancel: () => void });
        try {
          await task.promise;
        } catch {
          continue;
        }

        // Text layer for selection / copy.
        if (textLayerDiv && !cancelled) {
          textLayerDiv.innerHTML = "";
          textLayerDiv.style.width = `${cssViewport.width}px`;
          textLayerDiv.style.height = `${cssViewport.height}px`;
          try {
            const textContent = await page.getTextContent();
            if (cancelled) return;
            const tl = new TextLayer({
              textContentSource: textContent,
              container: textLayerDiv,
              viewport: cssViewport,
            });
            await tl.render();
          } catch {
            // Some pages legitimately have no text layer (image-only scans).
          }
        }

        // Jump to initial page once that page is rendered.
        if (pendingInitialJump.current === i) {
          pendingInitialJump.current = null;
          // Defer one frame so layout is settled.
          requestAnimationFrame(() => {
            const target = pageRefs.current.get(i);
            if (target && containerRef.current) {
              target.scrollIntoView({ block: "start" });
            }
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      for (const t of renderTasks) {
        try { t?.cancel(); } catch {}
      }
    };
  }, [doc, scale, zoom]);

  // Track which page is in view by observing the page wrappers.
  useEffect(() => {
    if (!doc || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { page: number; ratio: number } | null = null;
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const p = Number((e.target as HTMLElement).dataset.page ?? 0);
          if (!p) continue;
          if (!best || e.intersectionRatio > best.ratio) {
            best = { page: p, ratio: e.intersectionRatio };
          }
        }
        if (best) {
          setActivePage(best.page);
          onPageChange?.(best.page);
        }
      },
      { root: containerRef.current, threshold: [0.25, 0.5, 0.75] },
    );
    for (const el of pageRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [doc, onPageChange]);

  const scrollToPage = useCallback((p: number) => {
    const el = pageRefs.current.get(p);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const zoomIn = () => setScale((s) => Math.min(MAX_SCALE, Math.round((s + 0.15) * 100) / 100));
  const zoomOut = () => setScale((s) => Math.max(MIN_SCALE, Math.round((s - 0.15) * 100) / 100));
  const fit = () => setScale(1.2);

  const filename = filePath.split("/").pop() ?? filePath;
  const noteBtnLabel =
    siblingNoteState === "exists" ? "Open notes" :
    siblingNoteState === "missing" ? "Create notes" : "Notes";

  const hasOutline = outline && outline.length > 0;

  return (
    <div className={`pdf-view pdf-theme-${theme} ${outlineOpen && hasOutline ? "has-outline" : ""}`}>
      <div className="pdf-toolbar">
        {hasOutline && (
          <button
            className={`iconbtn ${outlineOpen ? "is-active" : ""}`}
            onClick={() => setOutlineOpen((v) => !v)}
            title={outlineOpen ? "Hide chapters" : "Show chapters"}
          >
            {outlineOpen ? <IconCaretDown size={14} /> : <IconCaretRight size={14} />}
            <span className="btn-label">Chapters</span>
          </button>
        )}

        <div className="pdf-toolbar-group">
          <button
            className="iconbtn"
            onClick={() => scrollToPage(Math.max(1, activePage - 1))}
            disabled={activePage <= 1}
            title="Previous page"
          >
            <IconChevronLeft size={14} />
          </button>
          <input
            className="pdf-page-input"
            type="number"
            min={1}
            max={numPages || 1}
            value={activePage}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 1 && v <= numPages) scrollToPage(v);
            }}
            title="Jump to page"
          />
          <span className="pdf-page-of">/ {numPages || "…"}</span>
          <button
            className="iconbtn"
            onClick={() => scrollToPage(Math.min(numPages, activePage + 1))}
            disabled={activePage >= numPages}
            title="Next page"
          >
            <IconChevronRight size={14} />
          </button>
        </div>

        {onOpenSiblingNote && (
          <button
            className={`iconbtn pdf-notes-btn ${siblingNoteState === "exists" ? "is-active" : ""}`}
            onClick={onOpenSiblingNote}
            title={
              siblingNoteState === "exists" ? "Open companion .md note (same basename)"
              : "Create a companion .md note next to this PDF"
            }
          >
            <IconFileText size={13} />
            <span className="btn-label">{noteBtnLabel}</span>
          </button>
        )}

        <div className="pdf-toolbar-spacer" />
        <div className="pdf-filename" title={filePath}>{filename}</div>
        <div className="pdf-toolbar-spacer" />
        <div className="pdf-toolbar-group">
          <button className="iconbtn" onClick={zoomOut} disabled={scale <= MIN_SCALE} title="Zoom out">
            <IconZoomOut size={14} />
          </button>
          <button className="iconbtn pdf-scale-label" onClick={fit} title="Reset zoom">
            {Math.round(scale * 100)}%
          </button>
          <button className="iconbtn" onClick={zoomIn} disabled={scale >= MAX_SCALE} title="Zoom in">
            <IconZoomIn size={14} />
          </button>
          <a className="iconbtn" href={src} target="_blank" rel="noopener noreferrer" title="Open raw PDF">
            <IconRefresh size={14} />
          </a>
        </div>
      </div>

      <div className="pdf-body">
        {outlineOpen && hasOutline && (
          <aside className="pdf-outline">
            <div className="pdf-outline-title">Chapters</div>
            <OutlineTree nodes={outline!} depth={0} activePage={activePage} onJump={scrollToPage} />
          </aside>
        )}
        <div className="pdf-scroll" ref={containerRef}>
        {loadError && <div className="error">Failed to load PDF: {loadError}</div>}
        {!doc && !loadError && <div className="loading">Loading PDF…</div>}
        {doc && (
          <div className="pdf-pages">
            {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
              <div
                key={p}
                ref={(el) => {
                  if (el) pageRefs.current.set(p, el);
                  else pageRefs.current.delete(p);
                }}
                data-page={p}
                className="pdf-page"
              >
                <canvas />
                <div className="pdf-text-layer" />
                <div className="pdf-page-num">{p}</div>
              </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

interface OutlineNode { title: string; page: number | null; children: OutlineNode[] }

function OutlineTree({ nodes, depth, activePage, onJump }: { nodes: OutlineNode[]; depth: number; activePage: number; onJump: (p: number) => void }) {
  return (
    <ul className="pdf-outline-list" style={{ paddingLeft: depth === 0 ? 0 : 14 }}>
      {nodes.map((n, i) => {
        const isActive = n.page !== null && n.page === activePage;
        return (
          <li key={i}>
            <button
              className={`pdf-outline-row ${isActive ? "is-active" : ""} ${n.page === null ? "is-disabled" : ""}`}
              onClick={() => n.page !== null && onJump(n.page)}
              disabled={n.page === null}
              title={n.title}
            >
              <span className="pdf-outline-title-text">{n.title}</span>
              {n.page !== null && <span className="pdf-outline-page">p. {n.page}</span>}
            </button>
            {n.children.length > 0 && (
              <OutlineTree nodes={n.children} depth={depth + 1} activePage={activePage} onJump={onJump} />
            )}
          </li>
        );
      })}
    </ul>
  );
}
