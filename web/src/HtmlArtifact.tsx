import { useEffect, useMemo, useRef, useState } from "react";
import { IconRefresh, IconCode, IconEye } from "./icons";

interface Props {
  code: string;
  theme: "dark" | "light";
}

// Sandboxed HTML artifact runner. The code is embedded into a tiny page and
// loaded into an iframe with `sandbox="allow-scripts"` — no same-origin, no
// network access to markviz APIs, no localStorage of host. Auto-resizes to
// content via postMessage from inside the iframe.
export function HtmlArtifact({ code, theme }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(300);
  const [showSource, setShowSource] = useState(false);
  const [nonce, setNonce] = useState(0);

  const doc = useMemo(() => {
    // If the code is a full HTML document, use it as-is. Otherwise wrap it.
    const isFullDoc = /<\s*(?:!doctype|html|head|body)\b/i.test(code);
    const bg = theme === "dark" ? "#0d1117" : "#ffffff";
    const fg = theme === "dark" ? "#e6edf3" : "#1f2328";
    if (isFullDoc) return code;
    return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  :root { color-scheme: ${theme}; }
  html, body { margin: 0; padding: 12px; background: ${bg}; color: ${fg}; font-family: Inter, system-ui, sans-serif; font-size: 14px; line-height: 1.5; }
  * { box-sizing: border-box; }
</style>
</head>
<body>
${code}
<script>
  // Auto-resize: tell parent how tall we are.
  function postSize() {
    const h = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    parent.postMessage({ type: "markviz:artifact-size", h }, "*");
  }
  window.addEventListener("load", postSize);
  new ResizeObserver(postSize).observe(document.documentElement);
  // Also after small delays in case dynamic content (canvas, async) renders late.
  setTimeout(postSize, 50);
  setTimeout(postSize, 500);
  setTimeout(postSize, 1500);
</script>
</body>
</html>`;
  }, [code, theme]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (data && data.type === "markviz:artifact-size" && typeof data.h === "number") {
        // Bound the height so a runaway artifact can't push the page indefinitely.
        const next = Math.max(80, Math.min(2400, Math.ceil(data.h) + 4));
        setHeight((cur) => (Math.abs(cur - next) > 2 ? next : cur));
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  const reload = () => setNonce((n) => n + 1);

  return (
    <div className="artifact-block">
      <div className="artifact-header">
        <span className="artifact-label">html artifact</span>
        <div className="artifact-actions">
          <button
            className="copy"
            onClick={() => setShowSource((v) => !v)}
            title="Toggle source"
          >
            {showSource ? <IconEye size={12} /> : <IconCode size={12} />}
            {showSource ? "Preview" : "Source"}
          </button>
          <button className="copy" onClick={reload} title="Reload">
            <IconRefresh size={12} /> Reload
          </button>
        </div>
      </div>
      {showSource ? (
        <pre className="artifact-source">{code}</pre>
      ) : (
        <iframe
          key={nonce}
          ref={iframeRef}
          className="artifact-frame"
          sandbox="allow-scripts allow-pointer-lock"
          srcDoc={doc}
          style={{ height }}
          title="HTML artifact"
        />
      )}
    </div>
  );
}
