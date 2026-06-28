import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17202a",
        signal: "#0f766e",
        route: "#2563eb",
        alert: "#b45309"
      }
    }
  },
  plugins: []
};

export default config;
