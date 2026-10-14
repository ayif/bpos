import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Warm restaurant-inspired orange brand scale.
        brand: {
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          300: "#fdba74",
          400: "#fb923c",
          500: "#f97316",
          600: "#ea580c",
          700: "#c2410c",
          800: "#9a3412",
          900: "#7c2d12",
        },
        // Soft pastel stat-card backgrounds + matching icon colors, used
        // only by the dashboard's four stat tiles.
        stat: {
          violetBg: "#ece9fd",
          violetIc: "#7c6fe0",
          skyBg: "#e3f5fc",
          skyIc: "#2aa7d6",
          amberBg: "#fcf1e0",
          amberIc: "#e79a2e",
          mintBg: "#e4f9ee",
          mintIc: "#22b378",
        },
        // Cooler, more professional neutral scale, swapped in for the
        // default Tailwind `gray` so every existing text-gray-*/bg-gray-*
        // class across the app picks it up automatically.
        gray: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
      },
      boxShadow: {
        soft: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        card: "0 2px 10px -4px rgb(15 23 42 / 0.09)",
        nav: "0 5px 12px -5px rgb(249 115 22 / 0.38)",
        fab: "0 12px 24px -8px rgb(249 115 22 / 0.48)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};
export default config;
