import { MarkdownView } from "./MarkdownView";
import { CodeBlock } from "./CodeBlock";
import type { FileKind } from "./types";

interface Props {
  path: string;
  kind: FileKind;
  content: string | null;
  url?: string;
  theme: "dark" | "light";
  zoom: number;
  wikiResolver?: (target: string) => string | null;
}

function langFromPath(p: string): string {
  const base = p.slice(p.lastIndexOf("/") + 1).toLowerCase();
  if (base === "dockerfile" || base.endsWith(".dockerfile")) return "docker";
  if (base === "makefile") return "make";
  if (base === "cmakelists.txt") return "cmake";
  const ext = p.slice(p.lastIndexOf(".") + 1).toLowerCase();
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    mjs: "javascript",
    cjs: "javascript",
    py: "python",
    pyi: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c",
    cc: "cpp",
    cpp: "cpp",
    h: "c",
    hh: "cpp",
    hpp: "cpp",
    cs: "csharp",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    scala: "scala",
    lua: "lua",
    sh: "bash",
    bash: "bash",
    zsh: "bash",
    fish: "bash",
    ps1: "powershell",
    html: "html",
    htm: "html",
    css: "css",
    scss: "scss",
    sass: "sass",
    less: "less",
    sql: "sql",
    graphql: "graphql",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    toml: "toml",
    ini: "ini",
    conf: "ini",
    cfg: "ini",
    vue: "vue",
    svelte: "svelte",
    env: "bash",
    // GPU / shaders / asm
    cu: "cpp",
    cuh: "cpp",
    glsl: "glsl",
    vert: "glsl",
    frag: "glsl",
    geom: "glsl",
    comp: "glsl",
    hlsl: "hlsl",
    wgsl: "wgsl",
    metal: "cpp",
    asm: "asm",
    s: "asm",
    wat: "wasm",
    wast: "wasm",
    // Data science / misc
    r: "r",
    jl: "julia",
    m: "matlab",
    dart: "dart",
    ex: "elixir",
    exs: "elixir",
    erl: "erlang",
    clj: "clojure",
    cljs: "clojure",
    hs: "haskell",
    tex: "latex",
    bib: "bibtex",
    cmake: "cmake",
    gradle: "groovy",
    vim: "vim",
    vimrc: "vim",
  };
  return map[ext] ?? "text";
}

export function FileView({ path, kind, content, url, theme, zoom, wikiResolver }: Props) {
  const zoomStyle = { fontSize: `${zoom}em` } as React.CSSProperties;

  if (kind === "markdown") {
    return <MarkdownView content={content ?? ""} theme={theme} filePath={path} zoom={zoom} wikiResolver={wikiResolver} />;
  }

  if (kind === "image") {
    return (
      <div className="image-view" style={zoomStyle}>
        <img src={url ?? `/raw/${path}`} alt={path} />
        <div className="image-caption">{path}</div>
      </div>
    );
  }

  if (kind === "text") {
    const lang = langFromPath(path);
    return (
      <div className="text-view md-wrapper" data-zoomed>
        <article className="md-content" style={zoomStyle}>
          <CodeBlock code={content ?? ""} lang={lang} theme={theme} />
        </article>
      </div>
    );
  }

  return <div className="empty-state"><p>Cannot preview this file type.</p></div>;
}
