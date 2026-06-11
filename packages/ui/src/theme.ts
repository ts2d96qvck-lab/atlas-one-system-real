/**
 * Atlas design tokens — aligned with apps/web/src/app/globals.css (:root --atlas-*).
 * globals.css is the source of truth; keep these values in sync.
 */
export const atlasTheme = {
  radius: {
    sm: "10px",
    md: "14px",
    lg: "18px",
    xl: "22px"
  },
  colors: {
    ink: "#0f172a",
    muted: "#64748b",
    accent: "#2563eb",
    success: "#059669",
    warning: "#d97706",
    danger: "#e11d48",
    info: "#0284c7",
    surface: "#ffffff",
    border: "#e2e8f0"
  },
  motion: {
    ease: "cubic-bezier(0.22, 1, 0.36, 1)",
    duration: "160ms",
    durationSlow: "260ms"
  }
} as const;
