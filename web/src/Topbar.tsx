import { useEffect, useRef, useState } from "react";
import {
  IconMenu,
  IconChevronLeft,
  IconChevronRight,
  IconBookmark,
  IconBookmarkFilled,
  IconFocus,
  IconPalette,
  IconEdit,
  IconEye,
  IconHelp,
  IconZoomIn,
  IconZoomOut,
  IconChevronDown,
  IconMap,
  IconFolderOpen,
  IconHash,
  IconPrint,
  IconDownload,
  IconSplit,
  IconSwap,
} from "./icons";
import type { FocusMode, SavedTheme, Theme } from "./types";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  minimapOpen: boolean;
  onToggleMinimap: () => void;
  currentPath: string | null;
  rootName: string;
  isRead: boolean;
  onMarkRead: () => void;
  onPrev: () => void;
  onNext: () => void;
  focus: FocusMode;
  onCycleFocus: () => void;
  theme: Theme;
  onSetTheme: (t: Theme) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
  editing: boolean;
  onToggleEdit: () => void;
  canEdit: boolean;
  onOpenFolder: () => void;
  onOpenGraph: () => void;
  onPrint: () => void;
  onHelp: () => void;
  onArxivImport: () => void;
  onCustomizeTheme: () => void;
  savedThemes: Record<string, SavedTheme>;
  onDeleteSavedTheme: (name: string) => void;
  splitOpen: boolean;
  onToggleSplit: () => void;
  onSwapPanes: () => void;
}

const THEMES: { value: Theme; label: string }[] = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "github-light", label: "GitHub Light" },
  { value: "sepia", label: "Sepia" },
  { value: "solarized", label: "Solarized" },
  { value: "nord", label: "Nord" },
  { value: "dracula", label: "Dracula" },
  { value: "gruvbox-dark", label: "Gruvbox Dark" },
  { value: "tokyo-night", label: "Tokyo Night" },
  { value: "catppuccin-mocha", label: "Catppuccin Mocha" },
  { value: "rose-pine", label: "Rosé Pine" },
];

const FOCUS_LABELS: Record<FocusMode, string> = {
  normal: "Normal",
  focus: "Focus",
  zen: "Zen",
};

function useOutsideClick<T extends HTMLElement>(ref: React.RefObject<T>, onClose: () => void) {
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onClose]);
}

// Hold-to-repeat: on pointerdown fires the action immediately, then keeps
// firing every `interval` ms (after an initial `delay`). Returns handlers.
function useHoldRepeat(action: () => void, delay = 350, interval = 60) {
  const timerRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const clear = () => {
    if (timerRef.current) { window.clearTimeout(timerRef.current); timerRef.current = null; }
    if (intervalRef.current) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
  };
  useEffect(() => () => clear(), []);
  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    action();
    timerRef.current = window.setTimeout(() => {
      intervalRef.current = window.setInterval(action, interval);
    }, delay);
  };
  return {
    onPointerDown,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
  };
}

export function Topbar(props: Props) {
  const [themeOpen, setThemeOpen] = useState(false);
  const themeRef = useRef<HTMLDivElement>(null);
  useOutsideClick(themeRef, () => setThemeOpen(false));

  const zoomInHold = useHoldRepeat(props.onZoomIn);
  const zoomOutHold = useHoldRepeat(props.onZoomOut);
  const prevHold = useHoldRepeat(props.onPrev, 400, 120);
  const nextHold = useHoldRepeat(props.onNext, 400, 120);

  const crumbParts = (props.currentPath ?? "").split("/").filter(Boolean);

  return (
    <header className="topbar">
      <div className="topbar-group">
        <button
          className="iconbtn"
          onClick={props.onToggleSidebar}
          title="Toggle sidebar (Ctrl+B)"
          aria-label="Toggle sidebar"
        >
          <IconMenu size={15} />
        </button>
        <button
          className={`iconbtn ${props.minimapOpen ? "is-active" : ""}`}
          onClick={props.onToggleMinimap}
          title="Toggle minimap (Ctrl+M)"
          aria-label="Toggle minimap"
        >
          <IconMap size={15} />
        </button>
        <button
          className={`iconbtn ${props.splitOpen ? "is-active" : ""}`}
          onClick={props.onToggleSplit}
          title="Toggle split view (Ctrl+\\)"
          aria-label="Toggle split view"
        >
          <IconSplit size={15} />
        </button>
        {props.splitOpen && (
          <button
            className="iconbtn"
            onClick={props.onSwapPanes}
            title="Swap panes"
            aria-label="Swap panes"
          >
            <IconSwap size={15} />
          </button>
        )}
      </div>

      <button
        className="iconbtn ghost root-pill"
        onClick={props.onOpenFolder}
        title="Open another folder (o)"
      >
        <IconFolderOpen size={14} />
        <span className="btn-label">{props.rootName}</span>
        <IconChevronDown size={11} />
      </button>

      <div className="crumb" title={props.currentPath ?? ""}>
        {crumbParts.length === 0 ? (
          <span className="crumb-empty">No file selected</span>
        ) : (
          crumbParts.map((p, i) => (
            <span key={i}>
              {i > 0 && <span className="crumb-sep">/</span>}
              <span className={i === crumbParts.length - 1 ? "crumb-current" : "crumb-part"}>{p}</span>
            </span>
          ))
        )}
      </div>

      <div className="spacer" />

      <div className="topbar-group seg">
        <button
          className="iconbtn"
          {...prevHold}
          title="Previous file (k) · hold to repeat"
          aria-label="Previous file"
        >
          <IconChevronLeft size={15} />
        </button>
        <button
          className="iconbtn"
          {...nextHold}
          title="Next file (j) · hold to repeat"
          aria-label="Next file"
        >
          <IconChevronRight size={15} />
        </button>
      </div>

      <button
        className={`iconbtn ${props.isRead ? "is-active" : ""}`}
        onClick={props.onMarkRead}
        title="Mark as read (m)"
        disabled={!props.currentPath}
      >
        {props.isRead ? <IconBookmarkFilled size={15} /> : <IconBookmark size={15} />}
        <span className="btn-label">{props.isRead ? "Read" : "Mark"}</span>
      </button>

      <div className="topbar-group seg">
        <button
          className="iconbtn"
          {...zoomOutHold}
          title="Zoom out (Ctrl+-) · hold to repeat"
          aria-label="Zoom out"
        >
          <IconZoomOut size={15} />
        </button>
        <button
          className="iconbtn zoom-label"
          onClick={props.onZoomReset}
          title="Reset zoom (Ctrl+0)"
        >
          {Math.round(props.zoom * 100)}%
        </button>
        <button
          className="iconbtn"
          {...zoomInHold}
          title="Zoom in (Ctrl++) · hold to repeat"
          aria-label="Zoom in"
        >
          <IconZoomIn size={15} />
        </button>
      </div>

      <button className="iconbtn" onClick={props.onCycleFocus} title="Cycle focus mode (f)">
        <IconFocus size={15} />
        <span className="btn-label">{FOCUS_LABELS[props.focus]}</span>
      </button>

      <div className="dropdown" ref={themeRef}>
        <button
          className="iconbtn"
          onClick={() => setThemeOpen((v) => !v)}
          title="Theme"
          aria-haspopup="menu"
          aria-expanded={themeOpen}
        >
          <IconPalette size={15} />
          <span className="btn-label">{
            typeof props.theme === "string" && props.theme.startsWith("custom:")
              ? props.theme.slice("custom:".length)
              : THEMES.find((t) => t.value === props.theme)?.label
          }</span>
          <IconChevronDown size={12} />
        </button>
        {themeOpen && (
          <div className="dropdown-menu" role="menu">
            {THEMES.map((t) => (
              <button
                key={t.value}
                role="menuitemradio"
                aria-checked={props.theme === t.value}
                className={`dropdown-item ${props.theme === t.value ? "is-selected" : ""}`}
                onClick={() => {
                  props.onSetTheme(t.value);
                  setThemeOpen(false);
                }}
              >
                <span className={`theme-swatch swatch-${t.value}`} />
                <span>{t.label}</span>
              </button>
            ))}
            {Object.values(props.savedThemes).length > 0 && (
              <>
                <div className="dropdown-divider" />
                <div className="dropdown-section">My themes</div>
                {Object.values(props.savedThemes).map((st) => {
                  const id = `custom:${st.name}` as Theme;
                  return (
                    <div
                      key={st.name}
                      className={`dropdown-item saved-theme-row ${props.theme === id ? "is-selected" : ""}`}
                    >
                      <button
                        className="saved-theme-pick"
                        onClick={() => {
                          props.onSetTheme(id);
                          setThemeOpen(false);
                        }}
                      >
                        <span
                          className="theme-swatch"
                          style={{ background: st.customization.accent ?? "var(--accent)" }}
                        />
                        <span>{st.name}</span>
                      </button>
                      <button
                        className="saved-theme-delete"
                        title="Delete this theme"
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onDeleteSavedTheme(st.name);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </>
            )}
            <div className="dropdown-divider" />
            <button
              className="dropdown-item"
              onClick={() => {
                props.onCustomizeTheme();
                setThemeOpen(false);
              }}
            >
              <span className="theme-swatch swatch-custom" />
              <span>Customize…</span>
            </button>
          </div>
        )}
      </div>

      <button
        className={`iconbtn primary ${props.editing ? "is-active" : ""}`}
        onClick={props.onToggleEdit}
        title="Toggle edit mode (Ctrl+E)"
        disabled={!props.canEdit}
      >
        {props.editing ? <IconEye size={15} /> : <IconEdit size={15} />}
        <span className="btn-label">{props.editing ? "View" : "Edit"}</span>
      </button>

      <button className="iconbtn ghost" onClick={props.onOpenGraph} title="Knowledge graph (g)">
        <IconHash size={15} />
      </button>

      <button className="iconbtn ghost" onClick={props.onArxivImport} title="Import arXiv paper (a)">
        <IconDownload size={15} />
      </button>

      <button className="iconbtn ghost" onClick={props.onPrint} title="Print / save as PDF (Ctrl+Shift+P)">
        <IconPrint size={15} />
      </button>

      <button className="iconbtn ghost" onClick={props.onHelp} title="Keyboard shortcuts (?)">
        <IconHelp size={15} />
      </button>
    </header>
  );
}
