import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        operation: "#0f766e",
        route: "#2563eb",
        caution: "#b45309",
        surface: "#ffffff",
        canvas: "#f6f8fb",
        border: "#dbe3ee",
        success: "#0f766e",
        warning: "#b45309",
        danger: "#b91c1c",
        info: "#2563eb"
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
