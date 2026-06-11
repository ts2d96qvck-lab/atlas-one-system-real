import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif"
        ]
      },
      colors: {
        atlas: {
          ink: "var(--atlas-ink)",
          muted: "var(--atlas-muted)",
          blue: "#2563eb",
          cyan: "#64d9ff",
          violet: "#8b7cff",
          surface: "rgba(255,255,255,0.72)",
          accent: "var(--atlas-accent)",
          success: "var(--atlas-success)",
          warning: "var(--atlas-warning)",
          danger: "var(--atlas-danger)",
          info: "var(--atlas-info)"
        }
      },
      fontSize: {
        "2xs": ["var(--atlas-text-2xs)", { lineHeight: "1.35" }]
      },
      boxShadow: {
        glass: "0 8px 32px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(15, 23, 42, 0.04)",
        "glass-lg": "0 24px 64px rgba(24, 62, 132, 0.12)"
      },
      backdropBlur: {
        glass: "24px",
        "glass-lg": "28px"
      },
      borderRadius: {
        // Aligned with --atlas-radius-* tokens in globals.css
        atlas: "var(--atlas-radius-md)",
        "atlas-lg": "var(--atlas-radius-lg)",
        "atlas-sm": "var(--atlas-radius-sm)",
        "atlas-xl": "var(--atlas-radius-xl)"
      },
      transitionTimingFunction: {
        atlas: "cubic-bezier(0.22, 1, 0.36, 1)"
      },
      transitionDuration: {
        atlas: "160ms",
        "atlas-slow": "260ms"
      },
      keyframes: {
        "atlas-fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "atlas-fade-out": { from: { opacity: "1" }, to: { opacity: "0" } },
        "atlas-slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" }
        },
        "atlas-slide-out-right": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(100%)" }
        },
        "atlas-slide-in-bottom": {
          from: { transform: "translateY(100%)" },
          to: { transform: "translateY(0)" }
        },
        "atlas-slide-out-bottom": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(100%)" }
        },
        "atlas-pop-in": {
          from: { opacity: "0", transform: "translateY(6px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" }
        }
      },
      animation: {
        "atlas-fade-in": "atlas-fade-in 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-fade-out": "atlas-fade-out 160ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-slide-in-right": "atlas-slide-in-right 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-slide-out-right": "atlas-slide-out-right 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-slide-in-bottom": "atlas-slide-in-bottom 260ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-slide-out-bottom": "atlas-slide-out-bottom 200ms cubic-bezier(0.22, 1, 0.36, 1)",
        "atlas-pop-in": "atlas-pop-in 200ms cubic-bezier(0.22, 1, 0.36, 1)"
      }
    }
  },
  plugins: []
};

export default config;
