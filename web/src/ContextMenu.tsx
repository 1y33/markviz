import { useEffect, useRef } from "react";
import type { TreeNode } from "./types";

export interface ContextAction {
  id: string;
  label: string;
  danger?: boolean;
  separator?: boolean;
  onPick: () => void;
}

interface Props {
  x: number;
  y: number;
  actions: ContextAction[];
  onClose: () => void;
  // Useful for showing the target name in the menu header.
  target?: TreeNode;
}

export function ContextMenu({ x, y, actions, onClose, target }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    // Use mousedown to beat any further-down click logic.
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", key);
    };
  }, [onClose]);

  // Clamp so the menu doesn't overflow the viewport.
  const W = 220;
  const H = Math.min(380, actions.length * 32 + 36);
  const left = Math.min(x, window.innerWidth - W - 4);
  const top = Math.min(y, window.innerHeight - H - 4);

  return (
    <div ref={ref} className="ctx-menu" style={{ left, top, width: W }}>
      {target && (
        <div className="ctx-menu-header" title={target.path}>
          <span className="ctx-menu-kind">{target.type === "dir" ? "folder" : "file"}</span>
          <span className="ctx-menu-name">{target.name}</span>
        </div>
      )}
      <div className="ctx-menu-items">
        {actions.map((a) =>
          a.separator ? (
            <div key={a.id} className="ctx-menu-sep" />
          ) : (
            <button
              key={a.id}
              className={`ctx-menu-item ${a.danger ? "is-danger" : ""}`}
              onClick={() => { a.onPick(); onClose(); }}
            >
              {a.label}
            </button>
          ),
        )}
      </div>
    </div>
  );
}
