import { useEffect, useRef, useState } from "react";
import { fetchGraph, type GraphData } from "./api";
import { IconClose, IconRefresh } from "./icons";

interface Props {
  currentPath: string | null;
  onSelect: (path: string) => void;
  onClose: () => void;
}

interface Node {
  path: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  degree: number;
}

interface Edge { from: string; to: string; kind: "wiki" | "md"; }

// Lightweight force-directed layout. Runs the simulation in requestAnimationFrame
// and draws onto canvas. No D3 dependency.
export function GraphView({ currentPath, onSelect, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [graph, setGraph] = useState<GraphData | null>(null);
  const nodesRef = useRef<Map<string, Node>>(new Map());
  const edgesRef = useRef<Edge[]>([]);
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ node: Node; offX: number; offY: number } | null>(null);
  const panRef = useRef({ x: 0, y: 0, dragging: false, startX: 0, startY: 0 });
  const zoomRef = useRef(1);
  const [, force] = useState(0);
  const tick = () => force((n) => (n + 1) % 1_000_000);

  const reload = () => {
    fetchGraph().then((g) => {
      setGraph(g);
    }).catch(() => {});
  };

  useEffect(() => { reload(); }, []);

  // Init / update node positions when graph data changes
  useEffect(() => {
    if (!graph || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const deg: Record<string, number> = {};
    for (const e of graph.edges) {
      deg[e.from] = (deg[e.from] ?? 0) + 1;
      deg[e.to] = (deg[e.to] ?? 0) + 1;
    }
    const next = new Map<string, Node>();
    const prev = nodesRef.current;
    const cx = W / 2;
    const cy = H / 2;
    const r0 = Math.min(W, H) * 0.35;
    let i = 0;
    const n = graph.nodes.length;
    for (const node of graph.nodes) {
      const existing = prev.get(node.path);
      if (existing) {
        next.set(node.path, {
          ...existing,
          title: node.title,
          degree: deg[node.path] ?? 0,
        });
      } else {
        const angle = (i / Math.max(1, n)) * Math.PI * 2;
        next.set(node.path, {
          path: node.path,
          title: node.title,
          x: cx + Math.cos(angle) * r0 + (Math.random() - 0.5) * 20,
          y: cy + Math.sin(angle) * r0 + (Math.random() - 0.5) * 20,
          vx: 0,
          vy: 0,
          degree: deg[node.path] ?? 0,
        });
      }
      i++;
    }
    nodesRef.current = next;
    edgesRef.current = graph.edges;
  }, [graph]);

  // Simulation + draw loop
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const canvas = canvasRef.current;
    let raf = 0;
    const dpr = window.devicePixelRatio || 1;

    function resize() {
      const r = canvas.getBoundingClientRect();
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      canvas.style.width = `${r.width}px`;
      canvas.style.height = `${r.height}px`;
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const step = () => {
      const nodes = Array.from(nodesRef.current.values());
      const edges = edgesRef.current;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;

      // Forces — basic Fruchterman-Reingold
      const k = 80;
      const repulsionStrength = 4500;
      const centerStrength = 0.005;
      const damping = 0.86;

      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        // Repulsion
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy + 0.01;
          const f = repulsionStrength / d2;
          const d = Math.sqrt(d2);
          const fx = (dx / d) * f;
          const fy = (dy / d) * f;
          a.vx += fx; a.vy += fy;
          b.vx -= fx; b.vy -= fy;
        }
        // Center pull
        a.vx += (W / 2 - a.x) * centerStrength;
        a.vy += (H / 2 - a.y) * centerStrength;
      }

      // Attraction along edges
      for (const e of edges) {
        const a = nodesRef.current.get(e.from);
        const b = nodesRef.current.get(e.to);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) + 0.01;
        const f = (d - k) * 0.04;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        a.vx += fx; a.vy += fy;
        b.vx -= fx; b.vy -= fy;
      }

      // Apply velocity & damping
      for (const n of nodes) {
        if (dragRef.current && dragRef.current.node === n) continue;
        n.vx *= damping;
        n.vy *= damping;
        n.x += n.vx * 0.5;
        n.y += n.vy * 0.5;
      }

      draw();
      raf = requestAnimationFrame(step);
    };

    function draw() {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const W = canvas.clientWidth;
      const H = canvas.clientHeight;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      ctx.save();
      ctx.translate(panRef.current.x, panRef.current.y);
      ctx.scale(zoomRef.current, zoomRef.current);

      const styles = getComputedStyle(document.documentElement);
      const edgeColor = styles.getPropertyValue("--border").trim() || "#444";
      const wikiColor = styles.getPropertyValue("--accent").trim() || "#4f8cff";
      const nodeFill = styles.getPropertyValue("--bg-elev2").trim() || "#222";
      const nodeStroke = styles.getPropertyValue("--text-dim").trim() || "#888";
      const textColor = styles.getPropertyValue("--text").trim() || "#fff";
      const accent = styles.getPropertyValue("--accent").trim() || "#4f8cff";
      const dim = styles.getPropertyValue("--text-muted").trim() || "#666";

      // Edges
      ctx.lineWidth = 1;
      for (const e of edgesRef.current) {
        const a = nodesRef.current.get(e.from);
        const b = nodesRef.current.get(e.to);
        if (!a || !b) continue;
        ctx.strokeStyle = e.kind === "wiki" ? wikiColor : edgeColor;
        ctx.globalAlpha = e.kind === "wiki" ? 0.45 : 0.3;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Nodes
      const hover = hoverRef.current;
      const nodes = Array.from(nodesRef.current.values());
      for (const n of nodes) {
        const r = 4 + Math.min(14, n.degree * 1.4);
        const isActive = n.path === currentPath;
        const isHover = n.path === hover;
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isActive ? accent : nodeFill;
        ctx.fill();
        ctx.strokeStyle = isActive || isHover ? accent : nodeStroke;
        ctx.lineWidth = isActive || isHover ? 2 : 1;
        ctx.stroke();
      }

      // Labels (only for hover/active, or always for larger nodes)
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      for (const n of nodes) {
        const r = 4 + Math.min(14, n.degree * 1.4);
        const isActive = n.path === currentPath;
        const isHover = n.path === hover;
        const shouldShow = isActive || isHover || n.degree >= 2;
        if (!shouldShow) continue;
        ctx.fillStyle = isActive ? accent : isHover ? textColor : dim;
        ctx.fillText(n.title, n.x + r + 6, n.y);
      }

      ctx.restore();
    }

    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [currentPath, graph]);

  // Mouse interaction
  const screenToWorld = (clientX: number, clientY: number) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const x = (clientX - r.left - panRef.current.x) / zoomRef.current;
    const y = (clientY - r.top - panRef.current.y) / zoomRef.current;
    return { x, y };
  };

  const hitNode = (worldX: number, worldY: number): Node | null => {
    let best: Node | null = null;
    let bestD = 18 * 18;
    for (const n of nodesRef.current.values()) {
      const dx = n.x - worldX;
      const dy = n.y - worldY;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) { bestD = d2; best = n; }
    }
    return best;
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (dragRef.current) {
      const w = screenToWorld(e.clientX, e.clientY);
      dragRef.current.node.x = w.x + dragRef.current.offX;
      dragRef.current.node.y = w.y + dragRef.current.offY;
      dragRef.current.node.vx = 0;
      dragRef.current.node.vy = 0;
      return;
    }
    if (panRef.current.dragging) {
      panRef.current.x += e.movementX;
      panRef.current.y += e.movementY;
      return;
    }
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = hitNode(w.x, w.y);
    const prev = hoverRef.current;
    hoverRef.current = hit?.path ?? null;
    if (prev !== hoverRef.current) tick();
  };

  const onMouseDown = (e: React.MouseEvent) => {
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = hitNode(w.x, w.y);
    if (hit) {
      dragRef.current = { node: hit, offX: hit.x - w.x, offY: hit.y - w.y };
    } else {
      panRef.current.dragging = true;
      panRef.current.startX = e.clientX;
      panRef.current.startY = e.clientY;
    }
  };

  const onMouseUp = (e: React.MouseEvent) => {
    const wasDragging = !!dragRef.current;
    const node = dragRef.current?.node;
    dragRef.current = null;
    panRef.current.dragging = false;
    // Click without significant movement → select
    if (!wasDragging) return;
    const w = screenToWorld(e.clientX, e.clientY);
    if (node) {
      const dx = (w.x + (dragRef.current as any)?.offX ?? 0) - node.x;
      if (Math.abs(dx) < 3) onSelect(node.path);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    const w = screenToWorld(e.clientX, e.clientY);
    const hit = hitNode(w.x, w.y);
    if (hit) onSelect(hit.path);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    const newZoom = Math.max(0.3, Math.min(3, zoomRef.current + delta));
    zoomRef.current = newZoom;
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card graph-modal" onClick={(e) => e.stopPropagation()}>
        <div className="graph-header">
          <h2>Knowledge graph</h2>
          <div className="graph-actions">
            <button className="iconbtn ghost" onClick={reload} title="Reload">
              <IconRefresh size={14} />
            </button>
            <button className="iconbtn ghost" onClick={onClose} title="Close (Esc)">
              <IconClose size={14} />
            </button>
          </div>
        </div>
        <div className="graph-wrap" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onClick={onClick}
            onWheel={onWheel}
          />
          <div className="graph-legend">
            <span><span className="legend-dot" style={{ background: "var(--accent)" }} /> wikilink</span>
            <span><span className="legend-dot" style={{ background: "var(--text-muted)" }} /> markdown link</span>
            <span className="dim">drag to pan · wheel to zoom · click a node to open</span>
          </div>
        </div>
      </div>
    </div>
  );
}
