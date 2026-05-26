import type { FocusMode } from "./types";

// Tiny module owning all interactions with `window.location` — getting initial
// state from the URL at boot and writing the path/page back as state changes.
// Centralizing this keeps URL semantics in one place instead of scattered
// throughout App.tsx.

export function getInitialFileFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("file");
}

export function getInitialPageFromUrl(): number | null {
  const v = new URLSearchParams(window.location.search).get("page");
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : null;
}

export function getInitialFocusFromUrl(): FocusMode | null {
  const v = new URLSearchParams(window.location.search).get("focus");
  return v === "normal" || v === "focus" || v === "zen" ? v : null;
}

export function getEditFromUrl(): boolean {
  return new URLSearchParams(window.location.search).get("edit") === "1";
}

export function setUrlFile(path: string | null): void {
  const url = new URL(window.location.href);
  if (path) url.searchParams.set("file", path);
  else url.searchParams.delete("file");
  url.searchParams.delete("page");
  window.history.replaceState({}, "", url);
}

export function setUrlPage(page: number | null): void {
  const url = new URL(window.location.href);
  if (page && page > 1) url.searchParams.set("page", String(page));
  else url.searchParams.delete("page");
  window.history.replaceState({}, "", url);
}
