import { useEffect, useMemo, useState } from "react";
import { getHighlighter, type Highlighter } from "shiki";

let highlighterPromise: Promise<Highlighter> | null = null;

// Aliases for languages Shiki names differently or not at all.
const LANG_ALIASES: Record<string, string> = {
  cu: "cpp", cuh: "cpp", cuda: "cpp", // Shiki doesn't ship a CUDA grammar; cpp is the closest.
  hlsl: "glsl",
  shader: "glsl",
  metal: "cpp",
  ipynb: "python",
  pyi: "python",
  zsh: "bash",
  fish: "bash",
  sh: "bash",
  env: "bash",
  dockerfile: "docker",
  conf: "ini",
  cfg: "ini",
  vert: "glsl",
  frag: "glsl",
  geom: "glsl",
  comp: "glsl",
};

function getOrCreateHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = getHighlighter({
      themes: ["github-dark", "github-light"],
      langs: [
        "javascript",
        "typescript",
        "tsx",
        "jsx",
        "python",
        "rust",
        "go",
        "java",
        "c",
        "cpp",
        "csharp",
        "ruby",
        "php",
        "bash",
        "shell",
        "json",
        "yaml",
        "toml",
        "ini",
        "html",
        "css",
        "scss",
        "sql",
        "markdown",
        "diff",
        "docker",
        "lua",
        "haskell",
        "elixir",
        "kotlin",
        "swift",
        "glsl",
        "wgsl",
        "wasm",
        "asm",
        "make",
        "cmake",
        "regex",
        "graphql",
        "xml",
        "vue",
        "svelte",
        "r",
        "matlab",
        "julia",
        "scala",
        "dart",
        "vim",
      ],
    });
  }
  return highlighterPromise;
}

interface Props {
  code: string;
  lang: string;
  theme: "dark" | "light";
  showLineNumbers?: boolean;
}

export function CodeBlock({ code, lang, theme, showLineNumbers = true }: Props) {
  const [html, setHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const requested = (lang || "").toLowerCase();
    const resolved = LANG_ALIASES[requested] ?? requested;
    getOrCreateHighlighter()
      .then((hl) => {
        if (cancelled) return;
        const themeName = theme === "dark" ? "github-dark" : "github-light";
        const loadedLangs = hl.getLoadedLanguages();
        const effective = (loadedLangs as string[]).includes(resolved) ? resolved : "text";
        try {
          const out = hl.codeToHtml(code, { lang: effective, theme: themeName });
          if (!cancelled) setHtml(out);
        } catch {
          if (!cancelled) setHtml(null);
        }
      })
      .catch(() => {
        if (!cancelled) setHtml(null);
      });
    return () => {
      cancelled = true;
    };
  }, [code, lang, theme]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

  // Line numbers — count lines in source. Stable across re-renders.
  const lineCount = useMemo(() => {
    return code.split("\n").length - (code.endsWith("\n") ? 1 : 0) || 1;
  }, [code]);

  const lineNumbers = useMemo(() => {
    if (!showLineNumbers) return null;
    return (
      <div className="code-line-numbers" aria-hidden="true">
        {Array.from({ length: lineCount }, (_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
    );
  }, [lineCount, showLineNumbers]);

  return (
    <div className={`code-block ${showLineNumbers ? "has-lines" : ""}`}>
      <div className="code-header">
        <span className="code-lang">{lang || "text"}</span>
        <span className="code-lines-stat">{lineCount} line{lineCount === 1 ? "" : "s"}</span>
        <button className="copy" onClick={copy} title="Copy">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="code-body-wrap">
        {lineNumbers}
        {html ? (
          <div className="code-body" dangerouslySetInnerHTML={{ __html: html }} />
        ) : (
          <pre className="code-body fallback">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
