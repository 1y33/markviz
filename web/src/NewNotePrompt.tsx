import { useEffect, useState } from "react";
import { saveFile } from "./api";
import { IconClose } from "./icons";

interface Props {
  defaultDir: string;
  onClose: () => void;
  onCreated: (savedPath: string) => void;
}

// Sanitize a user-supplied filename — strip path traversal and weird chars,
// but allow forward-slashes so people can type "subfolder/name.md" inline.
function cleanPath(input: string): string {
  let p = input.trim();
  p = p.replace(/\\+/g, "/");
  p = p.split("/").map((seg) => seg.replace(/[^a-zA-Z0-9._ -]/g, "")).filter(Boolean).join("/");
  if (!p) return "";
  if (!/\.(md|markdown|mdx)$/i.test(p)) p = p + ".md";
  return p;
}

function defaultBody(name: string): string {
  // Heading derived from filename (strip extension, replace separators with spaces).
  const stem = name.replace(/\.[^/.]+$/, "").split("/").pop() ?? "Untitled";
  const title = stem.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const today = new Date().toISOString().slice(0, 10);
  return `# ${title}

> Created ${today}.

`;
}

export function NewNotePrompt({ defaultDir, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState("");

  useEffect(() => {
    const cleaned = cleanPath(name);
    const dir = defaultDir && defaultDir !== "." ? defaultDir + "/" : "";
    const full = cleaned.includes("/") ? cleaned : `${dir}${cleaned}`;
    setResolved(full);
  }, [name, defaultDir]);

  const submit = async () => {
    setError(null);
    if (!resolved) { setError("Type a filename."); return; }
    setCreating(true);
    try {
      await saveFile(resolved, defaultBody(resolved));
      onCreated(resolved);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card new-note-prompt" onClick={(e) => e.stopPropagation()}>
        <div className="arxiv-header">
          <h2>New note</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>
        <p className="theme-studio-hint">
          Type a filename. Use <code>subdir/name</code> to put it in a folder
          (created automatically). <code>.md</code> is added if missing.
        </p>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="my-new-note  ·  research/transformers"
          className="arxiv-input"
        />
        {resolved && (
          <div className="new-note-preview">
            Will create <code>{resolved}</code>
          </div>
        )}
        {error && <div className="arxiv-error">{error}</div>}
        <div className="theme-studio-actions">
          <button onClick={onClose}>Cancel</button>
          <div style={{ flex: 1 }} />
          <button className="primary" onClick={submit} disabled={creating || !resolved}>
            {creating ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
