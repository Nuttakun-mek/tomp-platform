import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102033",
        "ink-soft": "#4a5f77",
        "ink-faint": "#7688a0",
        operation: "#087b73",
        "operation-deep": "#045f59",
        "operation-soft": "#e2f3f1",
        command: "#0c2234",
        "command-soft": "#173b58",
        route: "#2563eb",
        "route-soft": "#e8f0ff",
        caution: "#b66a00",
        surface: "#ffffff",
        canvas: "#f3f7fa",
        "canvas-strong": "#edf3f7",
        border: "#dbe5ee",
        success: "#14835b",
        warning: "#b66a00",
        danger: "#ba2f2a",
        pilot: "#6b4fd6",
        muted: "#667085",
        "status-ready": "#0f7a55",
        "status-watch": "#b26a00",
        "status-risk": "#b42318",
        "status-active": "#1d5fd7"
      },
      boxShadow: {
        soft: "0 12px 34px rgba(16, 32, 51, 0.07)",
        panel: "0 24px 74px rgba(16, 32, 51, 0.1)",
        command: "0 22px 64px rgba(14, 37, 56, 0.28)",
        lift: "0 16px 42px rgba(16, 32, 51, 0.12)"
      },
      borderRadius: {
        card: "12px",
        panel: "20px",
        command: "26px"
      },
      spacing: {
        "page-x": "clamp(1rem, 2.5vw, 2rem)",
        "page-y": "clamp(1.25rem, 3vw, 2.5rem)"
      },
      fontFamily: {
        sans: ["var(--font-thai)", "Noto Sans Thai", "Sarabun", "Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
