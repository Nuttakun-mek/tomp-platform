import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#132238",
        "ink-soft": "#42526b",
        operation: "#0b756b",
        command: "#12304a",
        route: "#2563eb",
        caution: "#b7791f",
        surface: "#ffffff",
        canvas: "#eef4f8",
        border: "#d8e3ef",
        success: "#0f766e",
        warning: "#b7791f",
        danger: "#b91c1c",
        pilot: "#6d28d9",
        muted: "#667085"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        panel: "0 22px 70px rgba(15, 23, 42, 0.1)",
        command: "0 18px 55px rgba(18, 48, 74, 0.18)"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
