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

function suggestedFilename(m: ArxivMeta): string {
  const idPart = m.id.replace(/\//g, "_");
  const suffix = m.title ? `-${slugify(m.title)}` : "";
  return `${idPart}${suffix}.pdf`;
}

// Parse a textarea of arxiv ids/URLs separated by newlines, commas, or
// whitespace. Returns deduplicated raw entries (lookup later filters out
// invalid ones via the server's metadata endpoint).
function parseBulkInput(s: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of s.split(/[,\s]+/)) {
    const t = piece.trim();
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

type Mode = "single" | "bulk";

interface BulkRow {
  raw: string;
  meta: ArxivMeta | null;
  loading: boolean;
  error: string | null;
  selected: boolean;
  filename: string;
  status: "pending" | "downloading" | "done" | "failed";
  resultPath?: string;
  resultError?: string;
}

export function ArxivImport({ defaultDir, onClose, onImported }: Props) {
  const [mode, setMode] = useState<Mode>("single");

  // --- Single mode state ---
  const [input, setInput] = useState("");
  const [meta, setMeta] = useState<ArxivMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subdir, setSubdir] = useState(defaultDir);
  const [filename, setFilename] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Bulk mode state ---
  const [bulkText, setBulkText] = useState("");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkSubdir, setBulkSubdir] = useState(defaultDir);
  const [bulkLooking, setBulkLooking] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });

  useEffect(() => { inputRef.current?.focus(); }, []);

  // --- Single flow ---
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
      setFilename(suggestedFilename(body as ArxivMeta));
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

  // --- Bulk flow ---
  const bulkLookup = async () => {
    const ids = parseBulkInput(bulkText);
    if (ids.length === 0) return;
    setBulkLooking(true);
    // Seed rows immediately so users see progress.
    const seed: BulkRow[] = ids.map((id) => ({
      raw: id, meta: null, loading: true, error: null, selected: true,
      filename: "", status: "pending",
    }));
    setBulkRows(seed);
    // Lookup concurrently in small batches — arXiv tolerates this fine.
    const next = [...seed];
    const concurrency = 3;
    let cursor = 0;
    const workers = Array.from({ length: concurrency }, async () => {
      while (cursor < ids.length) {
        const my = cursor++;
        try {
          const r = await fetch(`/api/arxiv/meta?id=${encodeURIComponent(ids[my])}`);
          const body = await r.json();
          if (!r.ok || body.error) {
            next[my] = { ...next[my], loading: false, error: body.error ?? `HTTP ${r.status}` };
          } else {
            const m = body as ArxivMeta;
            next[my] = { ...next[my], loading: false, meta: m, filename: suggestedFilename(m) };
          }
        } catch (e: unknown) {
          next[my] = { ...next[my], loading: false, error: (e as Error).message };
        }
        setBulkRows([...next]);
      }
    });
    await Promise.all(workers);
    setBulkLooking(false);
  };

  const bulkDownload = async () => {
    const targets = bulkRows.filter((r) => r.selected && r.meta && r.filename.trim());
    if (targets.length === 0) return;
    setBulkDownloading(true);
    setBulkProgress({ done: 0, total: targets.length });
    let done = 0;
    // Sequential: be polite to arXiv. Each download is ~1-3 MB so latency
    // is dominated by the network anyway.
    for (const row of targets) {
      const idx = bulkRows.indexOf(row);
      setBulkRows((rows) => {
        const next = [...rows];
        next[idx] = { ...next[idx], status: "downloading" };
        return next;
      });
      try {
        const r = await fetch("/api/arxiv/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: row.meta!.id + (row.meta!.version ?? ""),
            subdir: bulkSubdir,
            filename: row.filename.trim(),
          }),
        });
        const body = await r.json();
        if (!r.ok || body.error) {
          setBulkRows((rows) => {
            const next = [...rows];
            next[idx] = { ...next[idx], status: "failed", resultError: body.error ?? `HTTP ${r.status}` };
            return next;
          });
        } else {
          setBulkRows((rows) => {
            const next = [...rows];
            next[idx] = { ...next[idx], status: "done", resultPath: body.path as string };
            return next;
          });
        }
      } catch (e: unknown) {
        setBulkRows((rows) => {
          const next = [...rows];
          next[idx] = { ...next[idx], status: "failed", resultError: (e as Error).message };
          return next;
        });
      }
      done++;
      setBulkProgress({ done, total: targets.length });
    }
    setBulkDownloading(false);
    // If everything succeeded, refresh the tree by opening the first one.
    const firstOk = bulkRows.find((r) => r.status === "done")?.resultPath;
    if (firstOk) onImported(firstOk);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (mode === "single") {
      if (e.key === "Enter" && !meta) { e.preventDefault(); lookup(); }
      else if (e.key === "Enter" && meta && !importing) { e.preventDefault(); doImport(); }
    }
    if (e.key === "Escape") onClose();
  };

  const selectedCount = bulkRows.filter((r) => r.selected && r.meta).length;
  const successCount = bulkRows.filter((r) => r.status === "done").length;
  const failCount = bulkRows.filter((r) => r.status === "failed").length;

  return (
    <div className="modal" onClick={onClose}>
      <div className="modal-card arxiv-modal" onClick={(e) => e.stopPropagation()} onKeyDown={onKey}>
        <div className="arxiv-header">
          <h2>Import arXiv paper{mode === "bulk" ? "s" : ""}</h2>
          <button className="iconbtn ghost" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </div>

        <div className="arxiv-tabs">
          <button
            className={`arxiv-tab ${mode === "single" ? "is-active" : ""}`}
            onClick={() => setMode("single")}
          >
            Single
          </button>
          <button
            className={`arxiv-tab ${mode === "bulk" ? "is-active" : ""}`}
            onClick={() => setMode("bulk")}
          >
            Bulk
          </button>
        </div>

        {mode === "single" && <>
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
        </>}

        {mode === "bulk" && <>
          <label className="arxiv-label">arXiv IDs or URLs (one per line, comma-, or space-separated)</label>
          <textarea
            className="arxiv-bulk-input"
            value={bulkText}
            placeholder={"2305.12345\n1706.03762\nhttps://arxiv.org/abs/2010.11929\nmath/0211159"}
            onChange={(e) => setBulkText(e.target.value)}
            rows={5}
            spellCheck={false}
            disabled={bulkLooking || bulkDownloading}
          />

          <div className="arxiv-bulk-controls">
            <div className="arxiv-bulk-folder">
              <label className="arxiv-label" style={{ marginBottom: 4 }}>Save folder</label>
              <input
                type="text"
                value={bulkSubdir}
                onChange={(e) => setBulkSubdir(e.target.value)}
                className="arxiv-input"
                disabled={bulkDownloading}
              />
            </div>
            <button
              className="primary"
              onClick={bulkLookup}
              disabled={bulkLooking || bulkDownloading || !bulkText.trim()}
            >
              {bulkLooking ? <><IconRefresh size={14} className="spin" /> Looking up…</> : "Look up all"}
            </button>
          </div>

          {bulkRows.length > 0 && (
            <div className="arxiv-bulk-list">
              <div className="arxiv-bulk-list-head">
                <span>
                  {selectedCount} selected, {bulkRows.length} total
                  {successCount > 0 && <> · {successCount} downloaded</>}
                  {failCount > 0 && <> · {failCount} failed</>}
                </span>
                <button
                  className="arxiv-bulk-toggle-all"
                  onClick={() => {
                    const allOn = bulkRows.every((r) => r.selected || !r.meta);
                    setBulkRows((rows) => rows.map((r) => r.meta ? { ...r, selected: !allOn } : r));
                  }}
                >
                  {bulkRows.every((r) => r.selected || !r.meta) ? "Deselect all" : "Select all"}
                </button>
              </div>
              <div className="arxiv-bulk-rows">
                {bulkRows.map((r, idx) => (
                  <div key={idx} className={`arxiv-bulk-row status-${r.status}`}>
                    <input
                      type="checkbox"
                      checked={r.selected}
                      disabled={!r.meta || bulkDownloading}
                      onChange={(e) => {
                        const next = [...bulkRows];
                        next[idx] = { ...next[idx], selected: e.target.checked };
                        setBulkRows(next);
                      }}
                    />
                    <div className="arxiv-bulk-row-main">
                      <div className="arxiv-bulk-row-title">
                        {r.loading && <span className="arxiv-bulk-spinner"><IconRefresh size={12} className="spin" /></span>}
                        {r.meta?.title ?? <span className="arxiv-bulk-rawid">{r.raw}</span>}
                      </div>
                      {r.meta && (
                        <div className="arxiv-bulk-row-meta">
                          {r.meta.authors.slice(0, 3).join(", ")}{r.meta.authors.length > 3 ? ", …" : ""}
                          {" · "}arXiv:{r.meta.id}{r.meta.version ?? ""}
                        </div>
                      )}
                      {r.error && <div className="arxiv-bulk-row-error">Lookup failed: {r.error}</div>}
                      {r.resultError && <div className="arxiv-bulk-row-error">Download failed: {r.resultError}</div>}
                      {r.resultPath && <div className="arxiv-bulk-row-ok">Saved to {r.resultPath}</div>}
                      {r.meta && (
                        <input
                          type="text"
                          className="arxiv-bulk-filename"
                          value={r.filename}
                          onChange={(e) => {
                            const next = [...bulkRows];
                            next[idx] = { ...next[idx], filename: e.target.value };
                            setBulkRows(next);
                          }}
                          disabled={bulkDownloading || r.status === "done"}
                          placeholder="filename.pdf"
                        />
                      )}
                    </div>
                    <div className="arxiv-bulk-status">
                      {r.status === "downloading" && <IconRefresh size={12} className="spin" />}
                      {r.status === "done" && <span className="arxiv-bulk-done">✓</span>}
                      {r.status === "failed" && <span className="arxiv-bulk-failed">×</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="arxiv-actions">
            <button onClick={onClose}>Cancel</button>
            <div style={{ flex: 1 }}>
              {bulkDownloading && (
                <div className="arxiv-progress">
                  <div className="arxiv-progress-bar">
                    <div
                      className="arxiv-progress-fill"
                      style={{ width: `${(bulkProgress.done / Math.max(1, bulkProgress.total)) * 100}%` }}
                    />
                  </div>
                  <span className="arxiv-progress-text">
                    {bulkProgress.done} / {bulkProgress.total}
                  </span>
                </div>
              )}
            </div>
            <button
              className="primary"
              onClick={bulkDownload}
              disabled={bulkDownloading || selectedCount === 0}
            >
              {bulkDownloading ? "Downloading…" : `Download ${selectedCount} PDF${selectedCount === 1 ? "" : "s"}`}
            </button>
          </div>
        </>}
      </div>
    </div>
  );
}
