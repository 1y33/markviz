import type { FileResponse, RootInfo, TreeNode } from "./types";

async function jsonFetch<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export async function fetchInfo(): Promise<RootInfo> {
  return jsonFetch<RootInfo>("/api/info");
}

export async function fetchTree(): Promise<{ tree: TreeNode[] }> {
  return jsonFetch<{ tree: TreeNode[] }>("/api/tree");
}

export async function fetchFile(filePath: string): Promise<FileResponse> {
  return jsonFetch<FileResponse>(`/api/file?path=${encodeURIComponent(filePath)}`);
}

export async function saveFile(filePath: string, content: string): Promise<{ ok: true; mtime: number; size: number }> {
  return jsonFetch<{ ok: true; mtime: number; size: number }>(`/api/file`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: filePath, content }),
  });
}

export async function connect(): Promise<void> {
  try { await fetch("/api/connect", { method: "POST" }); } catch {}
}
export async function disconnect(): Promise<void> {
  try {
    // Use sendBeacon if available so it survives page unload.
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/disconnect");
    } else {
      await fetch("/api/disconnect", { method: "POST", keepalive: true });
    }
  } catch {}
}
export async function heartbeat(): Promise<void> {
  try { await fetch("/api/heartbeat", { method: "POST" }); } catch {}
}

export interface BrowseEntry { name: string; path: string; type: "dir"; mdCount: number; }
export interface BrowseResponse { path: string; parent: string | null; items: BrowseEntry[]; mdCount: number; }

export async function browse(filePath?: string): Promise<BrowseResponse> {
  const q = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
  return jsonFetch<BrowseResponse>(`/api/browse${q}`);
}

export async function reroot(newRoot: string): Promise<{ ok: true; root: string; rootName: string }> {
  return jsonFetch<{ ok: true; root: string; rootName: string }>("/api/reroot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path: newRoot }),
  });
}

export interface FileIndex { files: string[]; byBasename: Record<string, string[]>; }
export async function fetchIndex(): Promise<FileIndex> { return jsonFetch<FileIndex>("/api/index"); }

export interface GraphData {
  nodes: Array<{ path: string; title: string }>;
  edges: Array<{ from: string; to: string; kind: "wiki" | "md" }>;
}
export async function fetchGraph(): Promise<GraphData> { return jsonFetch<GraphData>("/api/graph"); }
