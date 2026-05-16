// Local storage helpers — namespaced per-root so the same markviz install
// reading two different folders doesn't bleed state across them.

import type { RootInfo } from "./types";

let prefix = "markviz:";

export function setStoragePrefix(info: RootInfo) {
  // hash root path so different folders keep separate state
  let h = 0;
  for (let i = 0; i < info.root.length; i++) {
    h = (h * 31 + info.root.charCodeAt(i)) | 0;
  }
  prefix = `markviz:${Math.abs(h).toString(36)}:`;
}

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(prefix + key);
    if (raw == null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function lsSet<T>(key: string, value: T) {
  try {
    localStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {}
}
