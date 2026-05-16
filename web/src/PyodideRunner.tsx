import { useCallback, useEffect, useRef, useState } from "react";
import { CodeBlock } from "./CodeBlock";

interface PyodideAPI {
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(opts: { batched: (s: string) => void }): void;
  setStderr(opts: { batched: (s: string) => void }): void;
  globals: { get(name: string): unknown };
}

let pyodideLoadPromise: Promise<PyodideAPI> | null = null;

async function loadPyodide(): Promise<PyodideAPI> {
  if (pyodideLoadPromise) return pyodideLoadPromise;
  pyodideLoadPromise = (async () => {
    // Load pyodide from CDN. We don't bundle it (huge — 6+MB) and we don't
    // need it unless a Python runnable block is hit.
    const PYODIDE_VERSION = "0.27.0";
    const src = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.js`;
    // @ts-expect-error global injected by pyodide.js
    if (!window.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Pyodide loader"));
        document.head.appendChild(s);
      });
    }
    // @ts-expect-error global
    const py = await window.loadPyodide({
      indexURL: `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`,
    });
    return py as PyodideAPI;
  })();
  return pyodideLoadPromise;
}

interface Props {
  code: string;
  theme: "dark" | "light";
}

export function PyodideRunner({ code, theme }: Props) {
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [loadingPyodide, setLoadingPyodide] = useState(false);
  const stdoutBufRef = useRef<string>("");

  const run = useCallback(async () => {
    setRunning(true);
    setError(null);
    setOutput("");
    stdoutBufRef.current = "";
    setHasRun(true);
    try {
      setLoadingPyodide(true);
      const py = await loadPyodide();
      setLoadingPyodide(false);
      const append = (s: string) => {
        stdoutBufRef.current += s;
        setOutput(stdoutBufRef.current);
      };
      py.setStdout({ batched: append });
      py.setStderr({ batched: (s) => append(s) });
      const result = await py.runPythonAsync(code);
      if (result !== undefined && result !== null) {
        append(`\n${String(result)}`);
      }
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setRunning(false);
      setLoadingPyodide(false);
    }
  }, [code]);

  useEffect(() => {
    // Reset output when code changes
    setOutput("");
    setError(null);
    setHasRun(false);
  }, [code]);

  return (
    <div className="runnable-block">
      <CodeBlock code={code} lang="python" theme={theme} />
      <div className="runnable-toolbar">
        <button className="iconbtn primary" onClick={run} disabled={running}>
          {running ? (loadingPyodide ? "Loading Pyodide…" : "Running…") : "▸ Run"}
        </button>
        {hasRun && (
          <button
            className="iconbtn ghost"
            onClick={() => { setOutput(""); setError(null); setHasRun(false); }}
            disabled={running}
          >
            Clear
          </button>
        )}
        <span className="runnable-hint">
          Python · runs in your browser (Pyodide)
        </span>
      </div>
      {hasRun && (
        <div className="runnable-output">
          <div className="runnable-output-label">{error ? "error" : "stdout"}</div>
          <pre>{error ?? output ?? ""}</pre>
        </div>
      )}
    </div>
  );
}
