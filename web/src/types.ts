export type FileKind = "markdown" | "image" | "text" | "binary";

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

export type Theme = "dark" | "light" | "sepia" | "nord" | "solarized" | "dracula";

export type FocusMode = "normal" | "focus" | "zen";
