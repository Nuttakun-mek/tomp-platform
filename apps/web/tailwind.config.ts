import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#142033",
        operation: "#0f766e",
        route: "#2563eb",
        caution: "#b45309",
        surface: "#ffffff",
        canvas: "#f4f7fb",
        border: "#d8e2ee",
        success: "#0f766e",
        warning: "#b45309",
        danger: "#b91c1c",
        info: "#2563eb",
        muted: "#667085"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        panel: "0 18px 50px rgba(15, 23, 42, 0.09)"
      },
      fontFamily: {
        sans: ["Inter", "Noto Sans Thai", "ui-sans-serif", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
