import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        operation: "#0f766e",
        route: "#2563eb",
        caution: "#b45309"
      }
    }
  },
  plugins: []
};

export default config;
