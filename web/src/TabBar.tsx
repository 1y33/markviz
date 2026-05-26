import { useRef } from "react";
import { IconClose } from "./icons";

interface Props {
  side: "left" | "right";
  tabs: string[];
  activeTab: string | null;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  // Drag-and-drop to reorder within the same pane.
  onReorder: (from: number, to: number) => void;
  // Optional close-pane button for the right pane.
  onClosePane?: () => void;
}

function basenameOf(p: string): string {
  return p.split("/").pop() ?? p;
}

// Group tabs by basename so duplicates (transformers.md in two folders) can be
// disambiguated with a directory hint without making every tab huge.
function disambiguate(tabs: string[]): Map<string, string> {
  const counts = new Map<string, number>();
  for (const t of tabs) counts.set(basenameOf(t), (counts.get(basenameOf(t)) ?? 0) + 1);
  const labels = new Map<string, string>();
  for (const t of tabs) {
    const base = basenameOf(t);
    if ((counts.get(base) ?? 0) > 1) {
      // Show last folder segment + filename: "research/transformers.md".
      const parts = t.split("/");
      labels.set(t, parts.length >= 2 ? parts.slice(-2).join("/") : t);
    } else {
      labels.set(t, base);
    }
  }
  return labels;
}

export function TabBar({ side, tabs, activeTab, onActivate, onClose, onReorder, onClosePane }: Props) {
  const labels = disambiguate(tabs);
  const dragFromRef = useRef<number | null>(null);

  if (tabs.length === 0) {
    return (
      <div className={`tabbar tabbar-${side} is-empty`}>
        <span className="tabbar-empty">No files open in this pane.</span>
        {onClosePane && (
          <button className="tabbar-close-pane" onClick={onClosePane} title="Close pane">
            <IconClose size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className={`tabbar tabbar-${side}`}>
      <div className="tabbar-scroll">
        {tabs.map((path, idx) => {
          const isActive = path === activeTab;
          const isPdf = path.toLowerCase().endsWith(".pdf");
          return (
            <div
              key={path}
              className={`tab ${isActive ? "is-active" : ""} ${isPdf ? "is-pdf" : ""}`}
              draggable
              onDragStart={() => { dragFromRef.current = idx; }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const from = dragFromRef.current;
                dragFromRef.current = null;
                if (from === null || from === idx) return;
                onReorder(from, idx);
              }}
              onClick={() => onActivate(path)}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault();
                  onClose(path);
                }
              }}
              title={path}
            >
              {isPdf && <span className="tab-kind">PDF</span>}
              <span className="tab-label">{labels.get(path)}</span>
              <button
                className="tab-close"
                onClick={(e) => { e.stopPropagation(); onClose(path); }}
                aria-label={`Close ${path}`}
                title="Close (or middle-click)"
              >
                <IconClose size={10} />
              </button>
            </div>
          );
        })}
      </div>
      {onClosePane && (
        <button className="tabbar-close-pane" onClick={onClosePane} title="Close pane">
          <IconClose size={12} />
        </button>
      )}
    </div>
  );
}
