import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Periwinkle-indigo brand scale (Modernize-style primary, was a
        // deeper violet-indigo scale).
        brand: {
          50: "#eef3ff",
          100: "#e0e9ff",
          200: "#c7d7fe",
          300: "#a3bdfd",
          400: "#7f9dfc",
          500: "#5d87ff",
          600: "#3f68f0",
          700: "#3151c9",
          800: "#2a44a3",
          900: "#253a82",
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
        card: "0 1px 2px 0 rgb(30 41 82 / 0.03), 0 14px 32px -18px rgb(30 41 82 / 0.16)",
        nav: "0 8px 18px -6px rgb(63 104 240 / 0.45)",
        fab: "0 12px 24px -8px rgb(63 104 240 / 0.55)",
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
