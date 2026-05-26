// SVG icon set — single-source so styling stays consistent.
// All icons inherit currentColor.

type IconProps = { size?: number; className?: string };

const baseProps = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function Icon({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      {...baseProps}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const IconMenu = (p: IconProps) => (
  <Icon {...p}><path d="M3 6h18M3 12h18M3 18h18" /></Icon>
);
export const IconChevronLeft = (p: IconProps) => (
  <Icon {...p}><path d="M15 18l-6-6 6-6" /></Icon>
);
export const IconChevronRight = (p: IconProps) => (
  <Icon {...p}><path d="M9 6l6 6-6 6" /></Icon>
);
export const IconChevronDown = (p: IconProps) => (
  <Icon {...p}><path d="M6 9l6 6 6-6" /></Icon>
);
export const IconChevronUp = (p: IconProps) => (
  <Icon {...p}><path d="M6 15l6-6 6 6" /></Icon>
);
export const IconCaretRight = (p: IconProps) => (
  <Icon {...p}><path d="M10 6l6 6-6 6" /></Icon>
);
export const IconCaretDown = (p: IconProps) => (
  <Icon {...p}><path d="M6 10l6 6 6-6" /></Icon>
);
export const IconSearch = (p: IconProps) => (
  <Icon {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></Icon>
);
export const IconClose = (p: IconProps) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);
export const IconCheck = (p: IconProps) => (
  <Icon {...p}><path d="M5 12l5 5L20 7" /></Icon>
);
export const IconBookOpen = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 5a2 2 0 012-2h5v16H5a2 2 0 01-2-2V5z" />
    <path d="M21 5a2 2 0 00-2-2h-5v16h5a2 2 0 002-2V5z" />
  </Icon>
);
export const IconEdit = (p: IconProps) => (
  <Icon {...p}>
    <path d="M11 4H5a2 2 0 00-2 2v13a2 2 0 002 2h13a2 2 0 002-2v-6" />
    <path d="M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
  </Icon>
);
export const IconEye = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
);
export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
  </Icon>
);
export const IconHelp = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="10" />
    <path d="M9.1 9a3 3 0 015.8 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </Icon>
);
export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </Icon>
);
export const IconMoon = (p: IconProps) => (
  <Icon {...p}><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></Icon>
);
export const IconFocus = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M3 7V5a2 2 0 012-2h2M17 3h2a2 2 0 012 2v2M21 17v2a2 2 0 01-2 2h-2M7 21H5a2 2 0 01-2-2v-2" />
  </Icon>
);
export const IconZoomIn = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M8 11h6M11 8v6" />
  </Icon>
);
export const IconZoomOut = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.3-4.3M8 11h6" />
  </Icon>
);
export const IconFile = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
  </Icon>
);
export const IconFileText = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" />
  </Icon>
);
export const IconImage = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <path d="M21 15l-5-5L5 21" />
  </Icon>
);
export const IconCode = (p: IconProps) => (
  <Icon {...p}><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" /></Icon>
);
export const IconFolder = (p: IconProps) => (
  <Icon {...p}>
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
  </Icon>
);
export const IconFolderOpen = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7v12a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2h-9l-2-3H5a2 2 0 00-2 2z" />
  </Icon>
);
export const IconBookmark = (p: IconProps) => (
  <Icon {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /></Icon>
);
export const IconBookmarkFilled = (p: IconProps) => (
  <Icon {...p}><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" fill="currentColor" /></Icon>
);
export const IconPalette = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.66 0 3-1.34 3-3 0-.78-.3-1.5-.78-2.04-.46-.5-.72-1.18-.72-1.96 0-1.66 1.34-3 3-3h1.5c2.07 0 3.75-1.68 3.75-3.75C21.75 6.04 17.36 2 12 2z" />
    <circle cx="6.5" cy="11.5" r="1" fill="currentColor" />
    <circle cx="9.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="14.5" cy="7.5" r="1" fill="currentColor" />
    <circle cx="17.5" cy="11.5" r="1" fill="currentColor" />
  </Icon>
);
export const IconMap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3-7 3z" />
    <path d="M8 3v15M16 6v15" />
  </Icon>
);
export const IconHash = (p: IconProps) => (
  <Icon {...p}><path d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" /></Icon>
);
export const IconPrint = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 9V2h12v7" />
    <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
    <rect x="6" y="14" width="12" height="8" />
  </Icon>
);
export const IconReadingMode = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    <path d="M16 5l.5 1.5L18 7l-1.5.5L16 9l-.5-1.5L14 7l1.5-.5z" />
  </Icon>
);
export const IconSplit = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="8" height="16" rx="1" />
    <rect x="13" y="4" width="8" height="16" rx="1" />
  </Icon>
);
export const IconSwap = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 7h13M16 3l4 4-4 4" />
    <path d="M17 17H4M8 13l-4 4 4 4" />
  </Icon>
);
export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
    <path d="M7 10l5 5 5-5M12 15V3" />
  </Icon>
);
export const IconFilePdf = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M9 14h1a1.5 1.5 0 010 3H9v-3zM9 17v2" />
    <path d="M13 14h1.5a1.5 1.5 0 011.5 1.5v0a1.5 1.5 0 01-1.5 1.5H13v-3z" />
  </Icon>
);
export const IconRefresh = (p: IconProps) => (
  <Icon {...p}>
    <path d="M23 4v6h-6M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
  </Icon>
);
