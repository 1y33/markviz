// Subscribes to server-sent events for filesystem changes.

type Listener = (event: { type: string; path?: string }) => void;

let source: EventSource | null = null;
const listeners = new Set<Listener>();
let reconnectTimer: number | null = null;

function connect() {
  if (source) return;
  try {
    source = new EventSource("/api/events");
    source.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        for (const l of listeners) l(ev);
      } catch {}
    };
    source.onerror = () => {
      // Browser will auto-reconnect, but if it gives up we trigger manually.
      if (source && source.readyState === EventSource.CLOSED) {
        source = null;
        if (reconnectTimer) window.clearTimeout(reconnectTimer);
        reconnectTimer = window.setTimeout(connect, 2000);
      }
    };
  } catch {
    if (reconnectTimer) window.clearTimeout(reconnectTimer);
    reconnectTimer = window.setTimeout(connect, 2000);
  }
}

export function subscribeFs(listener: Listener): () => void {
  listeners.add(listener);
  connect();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && source) {
      source.close();
      source = null;
    }
  };
}
