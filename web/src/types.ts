export type FileKind = "markdown" | "image" | "text" | "pdf" | "binary";

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "dir";
  kind?: FileKind;
  size?: number;
  children?: TreeNode[];
}

export interface FileResponse {
  path: string;
  kind: FileKind;
  content: string | null;
  mtime: number;
  size: number;
  url?: string;
}

export interface RootInfo {
  root: string;
  rootName: string;
  pid?: number;
  home?: string;
}

export type BuiltinTheme =
  | "dark"
  | "light"
  | "sepia"
  | "nord"
  | "solarized"
  | "dracula"
  | "gruvbox-dark"
  | "tokyo-night"
  | "catppuccin-mocha"
  | "github-light"
  | "rose-pine";

// User-defined themes are addressed by `custom:<name>` to distinguish them
// from built-in theme tokens.
export type Theme = BuiltinTheme | `custom:${string}`;

export interface SavedTheme {
  name: string;
  base: BuiltinTheme;
  customization: ThemeCustomization;
}

export interface ThemeCustomization {
  accent?: string;
  fontSans?: string;
  fontMono?: string;
  fontSerif?: string;
  fontSizePx?: number;
  lineHeight?: number;
  contentMaxPx?: number;
  serifBody?: boolean;
}

export type FocusMode = "normal" | "focus" | "zen";

export type ReadingOverlay = "off" | "night" | "sepia" | "dim" | "high-contrast";
