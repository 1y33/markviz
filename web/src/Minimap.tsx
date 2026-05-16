import { useEffect, useRef, useState, useCallback } from "react";

interface Props {
  targetSelector: string;
  contentKey: string;
}

// Minimap: clone the rendered markdown into a scaled iframe-like preview.
// Approach: copy the .md-content element into a sibling div, apply a CSS
// transform: scale() to shrink it, and overlay a draggable viewport indicator.
// This gives "real text" preview at near-zero cost — no canvas re-rasterization.
export function Minimap({ targetSelector, contentKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const [scale, setScale] = useState(0.15);
  const [viewport, setViewport] = useState({ top: 0, height: 0, percent: 0 });
  const draggingRef = useRef(false);

  // Resolve target each time content changes.
  useEffect(() => {
    const el = document.querySelector(targetSelector) as HTMLElement | null;
    setTarget(el);
  }, [targetSelector, contentKey]);

  // Clone content into the minimap and compute scale.
  useEffect(() => {
    if (!target || !innerRef.current || !containerRef.current) return;
    const inner = innerRef.current;
    const container = containerRef.current;
    const source = target.querySelector(".md-content") as HTMLElement | null;
    if (!source) return;

    let cancelled = false;
    let cloneTimer: number | null = null;

    const update = () => {
      if (cancelled) return;
      const containerW = container.clientWidth;
      // Source width: clamp the original content width so scaled output fits
      const sourceW = source.scrollWidth || 800;
      const s = containerW / sourceW;
      setScale(s);
    };

    const reclone = () => {
      if (cancelled) return;
      const cloned = source.cloneNode(true) as HTMLElement;
      // Strip interactive bits we don't want to show
      cloned.querySelectorAll("button, .copy").forEach((b) => b.remove());
      // Mark as minimap so we can style differently
      cloned.classList.add("minimap-clone");
      inner.innerHTML = "";
      inner.appendChild(cloned);
      update();
    };

    reclone();

    const onScroll = () => {
      const containerH = container.clientHeight;
      const sourceH = source.scrollHeight || target.scrollHeight;
      if (sourceH === 0) return;
      const s = container.clientWidth / (source.scrollWidth || 800);
      const scaledH = sourceH * s;
      const percent = target.scrollTop / Math.max(1, target.scrollHeight - target.clientHeight);
      // Position of the inner clone so the visible region maps to the viewport indicator.
      // Strategy: viewport indicator stays roughly centered if content overflows minimap.
      const indicatorH = Math.max(20, target.clientHeight * s);
      const maxIndicatorTop = containerH - indicatorH;
      let indicatorTop: number;
      let innerOffset: number;
      if (scaledH <= containerH) {
        // Whole doc fits — indicator just moves through it
        indicatorTop = percent * (scaledH - indicatorH);
        innerOffset = 0;
      } else {
        // Doc taller than minimap — slide inner so viewport stays aligned
        indicatorTop = percent * maxIndicatorTop;
        const desiredScrollAtIndicator = target.scrollTop * s;
        innerOffset = -(desiredScrollAtIndicator - indicatorTop);
        const minOffset = -(scaledH - containerH);
        innerOffset = Math.max(minOffset, Math.min(0, innerOffset));
      }
      inner.style.transform = `translateY(${innerOffset}px) scale(${s})`;
      setViewport({ top: indicatorTop, height: indicatorH, percent });
    };
    onScroll();

    const ro = new ResizeObserver(() => {
      // Throttle re-clone — content size changes when fonts load etc.
      if (cloneTimer) cancelAnimationFrame(cloneTimer);
      cloneTimer = requestAnimationFrame(() => {
        update();
        onScroll();
      });
    });
    ro.observe(target);
    ro.observe(container);
    if (source) ro.observe(source);

    target.addEventListener("scroll", onScroll, { passive: true });

    // Mutation observer: re-clone when content mutates (e.g. shiki async highlight)
    const mo = new MutationObserver(() => {
      reclone();
      onScroll();
    });
    mo.observe(source, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      target.removeEventListener("scroll", onScroll);
      ro.disconnect();
      mo.disconnect();
      if (cloneTimer) cancelAnimationFrame(cloneTimer);
    };
  }, [target, contentKey]);

  const scrollTo = useCallback(
    (clientY: number, centerOnViewport = true) => {
      if (!containerRef.current || !target) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = clientY - rect.top;
      const containerH = rect.height;
      const ratio = Math.max(0, Math.min(1, (y - (centerOnViewport ? viewport.height / 2 : 0)) / Math.max(1, containerH - viewport.height)));
      target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);
    },
    [target, viewport.height],
  );

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true;
    scrollTo(e.clientY);
    const move = (ev: MouseEvent) => {
      if (draggingRef.current) scrollTo(ev.clientY);
    };
    const up = () => {
      draggingRef.current = false;
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      className="minimap"
      ref={containerRef}
      onMouseDown={onMouseDown}
      title="Click to jump · drag to scrub"
    >
      <div className="minimap-inner" ref={innerRef} style={{ transform: `scale(${scale})` }} />
      <div className="minimap-overlay" />
      <div
        className="minimap-viewport"
        style={{ top: viewport.top, height: viewport.height }}
      />
    </div>
  );
}
