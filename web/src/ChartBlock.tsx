import { useEffect, useRef, useState } from "react";

// Lazy-load Plotly and Vega-Lite from CDN. Both are heavy (1MB+) so we don't
// bundle them — only download when a chart block is first rendered.

let plotlyPromise: Promise<typeof import("plotly.js-dist-min")> | null = null;
let vegaPromise: Promise<{ embed: (el: HTMLElement, spec: unknown) => Promise<unknown> }> | null = null;

async function loadPlotly() {
  if (plotlyPromise) return plotlyPromise;
  plotlyPromise = (async () => {
    if (!(window as any).Plotly) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Plotly"));
        document.head.appendChild(s);
      });
    }
    return (window as any).Plotly;
  })();
  return plotlyPromise;
}

async function loadVega() {
  if (vegaPromise) return vegaPromise;
  vegaPromise = (async () => {
    for (const url of [
      "https://cdn.jsdelivr.net/npm/vega@5/build/vega.min.js",
      "https://cdn.jsdelivr.net/npm/vega-lite@5/build/vega-lite.min.js",
      "https://cdn.jsdelivr.net/npm/vega-embed@6/build/vega-embed.min.js",
    ]) {
      if (document.querySelector(`script[src="${url}"]`)) continue;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = url;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(`Failed to load ${url}`));
        document.head.appendChild(s);
      });
    }
    return { embed: (window as any).vegaEmbed };
  })();
  return vegaPromise;
}

interface Props {
  code: string;
  kind: "plotly" | "vega" | "vega-lite";
  theme: "dark" | "light";
}

export function ChartBlock({ code, kind, theme }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setLoading(true);
    (async () => {
      try {
        let spec: any;
        try {
          spec = JSON.parse(code);
        } catch (e) {
          throw new Error(`Invalid JSON: ${(e as Error).message}`);
        }
        if (kind === "plotly") {
          const Plotly = await loadPlotly();
          if (cancelled || !ref.current) return;
          // Plotly spec: { data, layout, config }
          const data = Array.isArray(spec) ? spec : spec.data ?? [];
          const layout = (Array.isArray(spec) ? {} : spec.layout ?? {}) as Record<string, unknown>;
          if (theme === "dark") {
            layout.paper_bgcolor = "rgba(0,0,0,0)";
            layout.plot_bgcolor = "rgba(0,0,0,0)";
            layout.font = { ...(layout.font as object), color: "#e6edf3" };
          }
          await (Plotly as any).newPlot(ref.current, data, layout, { responsive: true, displaylogo: false });
        } else {
          const v = await loadVega();
          if (cancelled || !ref.current) return;
          const fullSpec = {
            ...spec,
            $schema: spec.$schema ?? "https://vega.github.io/schema/vega-lite/v5.json",
          };
          await v.embed(ref.current, fullSpec, {
            theme: theme === "dark" ? "dark" : undefined,
            actions: false,
          } as any);
        }
        if (!cancelled) setLoading(false);
      } catch (e: unknown) {
        if (!cancelled) {
          setError((e as Error).message);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [code, kind, theme]);

  return (
    <div className="chart-block">
      <div className="chart-header">
        <span className="chart-label">{kind}</span>
      </div>
      {error ? (
        <div className="chart-body chart-error">{error}</div>
      ) : (
        <div className="chart-body">
          {loading && <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Loading chart…</div>}
          <div ref={ref} style={{ width: "100%" }} />
        </div>
      )}
    </div>
  );
}
