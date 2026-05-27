import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        atlas: {
          ink: "#07111f",
          muted: "#5c6b82",
          blue: "#1f6fff",
          cyan: "#64d9ff",
          violet: "#8b7cff",
          surface: "rgba(255,255,255,0.72)"
        }
      },
      boxShadow: {
        glass: "0 24px 80px rgba(24, 62, 132, 0.16)"
      },
      backdropBlur: {
        glass: "28px"
      }
    }
  },
  plugins: []
};

export default config;

