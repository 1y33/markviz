import { useEffect, useState } from "react";
import { IconClose } from "./icons";

interface Props {
  title: string;
  hint?: string;
  initial: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: (value: string) => Promise<void> | void;
  onClose: () => void;
}

// Generic single-input confirmation dialog used by rename, duplicate, mkdir,
// and any other small file-management prompt. Kept tiny on purpose.
export function FsPrompt({ title, hint, initial, confirmLabel, danger, onConfirm, onClose }: Props) {
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { setValue(initial); }, [initial]);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      await onConfirm(value.trim());
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card fs-prompt" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>{title}</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
        {hint && <p className="theme-studio-hint">{hint}</p>}
        <input
          type="text"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          className="arxiv-input"
        />
        {error && <div className="arxiv-error">{error}</div>}
        <div className="theme-studio-actions">
          <button onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button
            className={`primary ${danger ? "is-danger" : ""}`}
            onClick={submit}
            disabled={busy || !value.trim()}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
