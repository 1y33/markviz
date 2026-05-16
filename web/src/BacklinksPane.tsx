import { useEffect, useState } from "react";
import { fetchGraph, type GraphData } from "./api";
import { IconChevronUp, IconChevronDown } from "./icons";

interface Props {
  currentPath: string | null;
  onSelect: (path: string) => void;
  reloadKey: unknown;
}

export function BacklinksPane({ currentPath, onSelect, reloadKey }: Props) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchGraph().then((g) => { if (!cancelled) setGraph(g); }).catch(() => {});
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (!currentPath || !graph) return null;

  const backlinks = graph.edges
    .filter((e) => e.to === currentPath)
    .map((e) => ({ ...e, fromNode: graph.nodes.find((n) => n.path === e.from) }))
    .filter((e) => e.fromNode);

  const outgoing = graph.edges
    .filter((e) => e.from === currentPath)
    .map((e) => ({ ...e, toNode: graph.nodes.find((n) => n.path === e.to) }))
    .filter((e) => e.toNode);

  if (backlinks.length === 0 && outgoing.length === 0) return null;

  return (
    <div className="backlinks-pane">
      <button className="backlinks-header" onClick={() => setOpen((v) => !v)}>
        <span>
          LINKS
          <span className="backlinks-count">
            {backlinks.length} in · {outgoing.length} out
          </span>
        </span>
        {open ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
      </button>
      {open && (
        <div className="backlinks-body">
          {backlinks.length > 0 && (
            <div className="backlinks-group">
              <div className="backlinks-label">Linked from</div>
              {backlinks.map((b) => (
                <button
                  key={b.from + b.kind}
                  className="backlinks-item"
                  onClick={() => onSelect(b.from)}
                  title={b.from}
                >
                  <span className={`link-kind kind-${b.kind}`}>{b.kind === "wiki" ? "⟦⟧" : "→"}</span>
                  <span className="title">{b.fromNode!.title}</span>
                  <span className="dim">{b.from}</span>
                </button>
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <div className="backlinks-group">
              <div className="backlinks-label">Links to</div>
              {outgoing.map((b) => (
                <button
                  key={b.to + b.kind}
                  className="backlinks-item"
                  onClick={() => onSelect(b.to)}
                  title={b.to}
                >
                  <span className={`link-kind kind-${b.kind}`}>{b.kind === "wiki" ? "⟦⟧" : "→"}</span>
                  <span className="title">{b.toNode!.title}</span>
                  <span className="dim">{b.to}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
