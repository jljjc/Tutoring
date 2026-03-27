import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0f1117",
        surface: "#1a1d27",
        "surface-raised": "#22263a",
        border: "#2e3150",
        primary: "#6366f1",
        "primary-hover": "#4f46e5",
        accent: "#f59e0b",
        "text-primary": "#f1f5f9",
        muted: "#94a3b8",
        danger: "#ef4444",
        success: "#10b981",
      },
    },
  },
  plugins: [],
};
export default config;
