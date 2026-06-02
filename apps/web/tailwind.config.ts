import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        atlas: {
          ink: "#0f172a",
          muted: "#64748b",
          blue: "#2563eb",
          cyan: "#64d9ff",
          violet: "#8b7cff",
          surface: "rgba(255,255,255,0.72)"
        }
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
        atlas: "14px",
        "atlas-lg": "18px"
      }
    }
  },
  plugins: []
};

export default config;
