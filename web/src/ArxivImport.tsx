import { useEffect, useRef, useState } from "react";
import { IconClose, IconRefresh } from "./icons";

interface Props {
  defaultDir: string;
  onClose: () => void;
  onImported: (savedPath: string) => void;
}

interface ArxivMeta {
  id: string;
  version: string | null;
  title: string | null;
  summary: string | null;
  authors: string[];
  published: string | null;
  pdfUrl: string;
  absUrl: string;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ArxivImport({ defaultDir, onClose, onImported }: Props) {
  const [input, setInput] = useState("");
  const [meta, setMeta] = useState<ArxivMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subdir, setSubdir] = useState(defaultDir);
  const [filename, setFilename] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const lookup = async () => {
    setError(null);
    setMeta(null);
    if (!input.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/arxiv/meta?id=${encodeURIComponent(input.trim())}`);
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setMeta(body as ArxivMeta);
      // Auto-fill filename suggestion: "<id>-<title-slug>.pdf"
      const m = body as ArxivMeta;
      const idPart = m.id.replace(/\//g, "_");
      const suffix = m.title ? `-${slugify(m.title)}` : "";
      setFilename(`${idPart}${suffix}.pdf`);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const doImport = async () => {
    if (!meta) return;
    setImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/arxiv/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: meta.id + (meta.version ?? ""), subdir, filename }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      onImported(body.path as string);
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setImporting(false);
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !meta) {
      e.preventDefault();
      lookup();
    } else if (e.key === "Enter" && meta && !importing) {
      e.preventDefault();
      doImport();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card arxiv-modal" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="arxiv-header">
          <h2>Import arXiv paper</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>

        <label className="arxiv-label">arXiv ID or URL</label>
        <div className="arxiv-input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            placeholder="2305.12345  ·  https://arxiv.org/abs/…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            className="arxiv-input"
            autoFocus
          />
          <button className="primary" onClick={lookup} disabled={loading || !input.trim()}>
            {loading ? <IconRefresh size={14} className="spin" /> : "Look up"}
          </button>
        </div>

        {error && <div className="arxiv-error">{error}</div>}

        {meta && (
          <>
            <div className="arxiv-meta">
              <div className="arxiv-meta-title">{meta.title ?? "(no title)"}</div>
              {meta.authors.length > 0 && (
                <div className="arxiv-meta-authors">{meta.authors.join(", ")}</div>
              )}
              {meta.published && (
                <div className="arxiv-meta-date">
                  {meta.published.slice(0, 10)} · arXiv:{meta.id}{meta.version ?? ""}
                </div>
              )}
              {meta.summary && <div className="arxiv-meta-summary">{meta.summary}</div>}
            </div>

            <label className="arxiv-label">Save to folder (relative to root)</label>
            <input
              type="text"
              value={subdir}
              onChange={(e) => setSubdir(e.target.value)}
              className="arxiv-input"
              placeholder="."
            />

            <label className="arxiv-label">Filename</label>
            <input
              type="text"
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              className="arxiv-input"
            />

            <div className="arxiv-actions">
              <button onClick={onClose}>Cancel</button>
              <button className="primary" onClick={doImport} disabled={importing || !filename.trim()}>
                {importing ? "Downloading…" : "Download PDF"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
