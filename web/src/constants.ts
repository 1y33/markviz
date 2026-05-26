import type { BuiltinTheme } from "./types";

// Tokens we don't want spread across components. Add to this list when you
// introduce a new builtin theme — the dropdown order, dropdown swatch CSS,
// and the BuiltinTheme union type all need to stay in sync with it.
export const BUILTIN_THEMES: BuiltinTheme[] = [
  "dark",
  "light",
  "github-light",
  "sepia",
  "solarized",
  "nord",
  "dracula",
  "gruvbox-dark",
  "tokyo-night",
  "catppuccin-mocha",
  "rose-pine",
];

export function isBuiltinTheme(t: string): t is BuiltinTheme {
  return (BUILTIN_THEMES as string[]).includes(t);
}

export const MIN_SIDEBAR_WIDTH = 180;
export const MAX_SIDEBAR_WIDTH = 600;
export const MIN_MINIMAP_WIDTH = 80;
export const MAX_MINIMAP_WIDTH = 220;
