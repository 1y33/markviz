import { useMemo, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import { CodeBlock } from "./CodeBlock";
import { MermaidBlock } from "./MermaidBlock";
import { HtmlArtifact } from "./HtmlArtifact";
import { PyodideRunner } from "./PyodideRunner";
import { ChartBlock } from "./ChartBlock";
import { transformWikilinks, isWikiHref, isTagHref, parseWikiHref, parseTagHref } from "./wikilinks";
import { BacklinksPane } from "./BacklinksPane";
import "katex/dist/katex.min.css";

interface Props {
  content: string;
  theme: "dark" | "light";
  filePath: string | null;
  zoom?: number;
  wikiResolver?: (target: string) => string | null;
  onTagClick?: (tag: string) => void;
}

interface Heading {
  level: number;
  text: string;
  id: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-");
}

function extractHeadings(md: string): Heading[] {
  const lines = md.split("\n");
  const headings: Heading[] = [];
  let inFence = false;
  for (const line of lines) {
    if (/^```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) {
      const level = m[1].length;
      const text = m[2].trim();
      headings.push({ level, text, id: slugify(text) });
    }
  }
  return headings;
}

export function MarkdownView({ content, theme, filePath, zoom = 1, wikiResolver, onTagClick }: Props) {
  const transformed = useMemo(() => transformWikilinks(content), [content]);
  const headings = useMemo(() => extractHeadings(content), [content]);
  const viewRef = useRef<HTMLDivElement>(null);

  // When file changes, scroll to top.
  useEffect(() => {
    viewRef.current?.scrollTo({ top: 0 });
  }, [filePath]);

  const components = useMemo(
    () => ({
      code({ inline, className, children, ...props }: any) {
        const match = /language-([\w-]+)/.exec(className || "");
        const codeStr = String(children ?? "").replace(/\n$/, "");
        if (inline || !match) {
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
        const lang = match[1].toLowerCase();
        // Special blocks: mermaid, html-artifact, python-run / py-run / runnable-python
        if (lang === "mermaid") {
          return <MermaidBlock code={codeStr} theme={theme} />;
        }
        if (lang === "html-artifact" || lang === "artifact" || lang === "htmlartifact") {
          return <HtmlArtifact code={codeStr} theme={theme} />;
        }
        if (
          lang === "python-run" ||
          lang === "py-run" ||
          lang === "runnable-python" ||
          lang === "run-python"
        ) {
          return <PyodideRunner code={codeStr} theme={theme} />;
        }
        if (lang === "plotly") {
          return <ChartBlock code={codeStr} kind="plotly" theme={theme} />;
        }
        if (lang === "vega" || lang === "vega-lite" || lang === "vegalite") {
          return <ChartBlock code={codeStr} kind="vega-lite" theme={theme} />;
        }
        return <CodeBlock code={codeStr} lang={lang} theme={theme} />;
      },
      a({ href, children, ...props }: any) {
        const isExternal = href && /^https?:\/\//.test(href);
        const isAnchor = href && href.startsWith("#");
        if (href && isWikiHref(href)) {
          const parsed = parseWikiHref(href);
          const resolved = parsed && wikiResolver ? wikiResolver(parsed.target) : null;
          const cls = `wikilink ${resolved ? "" : "wikilink-unresolved"}`;
          return (
            <a
              className={cls}
              href={href}
              data-target={parsed?.target}
              title={resolved ? resolved : `Unresolved: ${parsed?.target}`}
              onClick={(e) => {
                e.preventDefault();
                if (resolved) {
                  const heading = parsed?.heading ? `#${parsed.heading}` : "";
                  const target = `${resolved}${heading}`;
                  window.dispatchEvent(new CustomEvent("markviz:navigate", { detail: { href: target, from: filePath, abs: true } }));
                }
              }}
            >
              {children}
            </a>
          );
        }
        if (href && isTagHref(href)) {
          const tag = parseTagHref(href);
          return (
            <a
              className="tag-link"
              href={href}
              onClick={(e) => {
                e.preventDefault();
                if (tag) onTagClick?.(tag);
              }}
            >
              {children}
            </a>
          );
        }
        if (isExternal) {
          return (
            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
              {children}
            </a>
          );
        }
        if (isAnchor) {
          return (
            <a href={href} {...props}>
              {children}
            </a>
          );
        }
        // Relative links - try to navigate to that markdown file via app state.
        return (
          <a
            href={href}
            onClick={(e) => {
              if (href && (href.endsWith(".md") || href.endsWith(".markdown") || href.endsWith(".mdx"))) {
                e.preventDefault();
                const event = new CustomEvent("markviz:navigate", { detail: { href, from: filePath } });
                window.dispatchEvent(event);
              }
            }}
            {...props}
          >
            {children}
          </a>
        );
      },
      img({ src, alt, ...props }: any) {
        // Rewrite relative image paths to /raw/<dir>/<src>
        if (src && !/^([a-z]+:|\/|data:)/i.test(src) && filePath) {
          const dir = filePath.includes("/") ? filePath.slice(0, filePath.lastIndexOf("/")) : "";
          const rel = dir ? `${dir}/${src}` : src;
          src = `/raw/${rel}`;
        }
        return <img src={src} alt={alt} loading="lazy" {...props} />;
      },
      table({ children, ...props }: any) {
        return (
          <div className="table-wrap">
            <table {...props}>{children}</table>
          </div>
        );
      },
    }),
    [theme, filePath],
  );

  const zoomStyle = { fontSize: `${zoom}em` } as React.CSSProperties;

  return (
    <div className="md-wrapper" ref={viewRef} style={zoomStyle} id="md-scroll">
      {headings.length > 2 && (
        <aside className="toc">
          <div className="toc-title">Contents</div>
          <ul>
            {headings.map((h, i) => (
              <li key={i} className={`toc-l${h.level}`}>
                <a href={`#${h.id}`}>{h.text}</a>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <article className="md-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex]}
          components={components}
        >
          {transformed}
        </ReactMarkdown>
        {filePath && (
          <BacklinksPane
            currentPath={filePath}
            onSelect={(p) => {
              window.dispatchEvent(new CustomEvent("markviz:navigate", { detail: { href: p, from: filePath, abs: true } }));
            }}
            reloadKey={filePath}
          />
        )}
      </article>
    </div>
  );
}
