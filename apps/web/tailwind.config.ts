import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f1f33",
        "ink-soft": "#40546d",
        operation: "#08766f",
        "operation-soft": "#e4f5f2",
        command: "#0d2438",
        "command-soft": "#153b5b",
        route: "#1d5fd7",
        "route-soft": "#e7efff",
        caution: "#b26a00",
        surface: "#ffffff",
        canvas: "#edf3f7",
        "canvas-strong": "#dfe9f0",
        border: "#d5e0ec",
        success: "#0f7a55",
        warning: "#b26a00",
        danger: "#b42318",
        pilot: "#6d28d9",
        muted: "#667085",
        "status-ready": "#0f7a55",
        "status-watch": "#b26a00",
        "status-risk": "#b42318",
        "status-active": "#1d5fd7"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        panel: "0 22px 70px rgba(15, 23, 42, 0.11)",
        command: "0 18px 55px rgba(13, 36, 56, 0.22)",
        lift: "0 14px 40px rgba(15, 31, 51, 0.12)"
      },
      borderRadius: {
        panel: "18px",
        command: "22px"
      },
      spacing: {
        "page-x": "clamp(1rem, 2.5vw, 2rem)",
        "page-y": "clamp(1.25rem, 3vw, 2.5rem)"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
