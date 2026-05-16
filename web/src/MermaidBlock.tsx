import { useEffect, useRef, useState } from "react";

let mermaidInstance: typeof import("mermaid").default | null = null;
let mermaidInitPromise: Promise<void> | null = null;

async function ensureMermaid(theme: "dark" | "light") {
  if (!mermaidInstance) {
    const mod = await import("mermaid");
    mermaidInstance = mod.default;
  }
  if (!mermaidInitPromise) {
    mermaidInitPromise = Promise.resolve(
      mermaidInstance.initialize({
        startOnLoad: false,
        theme: theme === "dark" ? "dark" : "default",
        securityLevel: "strict",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
      }),
    );
  }
  await mermaidInitPromise;
  return mermaidInstance;
}

interface Props {
  code: string;
  theme: "dark" | "light";
}

let idCounter = 0;

export function MermaidBlock({ code, theme }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderedSvg, setRenderedSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setRenderedSvg(null);
    (async () => {
      try {
        const m = await ensureMermaid(theme);
        const id = `mermaid-${idCounter++}`;
        // Reinitialize when theme changes — mermaid caches the theme.
        m.initialize({
          startOnLoad: false,
          theme: theme === "dark" ? "dark" : "default",
          securityLevel: "strict",
          fontFamily: "Inter, system-ui, sans-serif",
          fontSize: 14,
        });
        const { svg } = await m.render(id, code);
        if (!cancelled) setRenderedSvg(svg);
      } catch (e: unknown) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, theme]);

  if (error) {
    return (
      <div className="mermaid-block mermaid-error">
        <div className="mermaid-header">
          <span className="mermaid-label">mermaid · error</span>
        </div>
        <pre>{error}</pre>
        <details>
          <summary>Source</summary>
          <pre>{code}</pre>
        </details>
      </div>
    );
  }

  return (
    <div className="mermaid-block">
      <div className="mermaid-header">
        <span className="mermaid-label">mermaid</span>
      </div>
      {renderedSvg ? (
        <div
          ref={ref}
          className="mermaid-svg"
          dangerouslySetInnerHTML={{ __html: renderedSvg }}
        />
      ) : (
        <div ref={ref} className="mermaid-svg">
          <div className="mermaid-loading">Rendering diagram…</div>
        </div>
      )}
    </div>
  );
}
