import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/providers/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--bg-canvas)",
        sidebar: "var(--bg-sidebar)",
        card: "var(--bg-card)",
        elevated: "var(--bg-elevated)",
        borderSubtle: "var(--border-subtle)",
        borderStrong: "var(--border-strong)",
        accent: {
          DEFAULT: "#7657F6",
          hover: "#6746EB",
          secondary: "#A78BFA",
          muted: "rgba(118, 87, 246, 0.14)",
        },
        status: {
          success: "#22C58B",
          warning: "#F5B942",
          error: "#F16B75",
        },
        slate: {
          750: "#28324A",
          850: "#14192B",
          925: "#0D1020",
          950: "#090B16",
        },
        brand: {
          50: "#f3f1ff",
          100: "#e8e3ff",
          200: "#d4cbff",
          300: "#b8a6ff",
          400: "#A78BFA",
          500: "#7657F6",
          600: "#6746EB",
          700: "#5636D1",
          800: "#462CA8",
          900: "#3A2687",
          950: "#211457",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        heading: ["var(--font-heading)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        panel: "0 1px 2px rgba(0, 0, 0, 0.25), 0 8px 24px -8px rgba(0, 0, 0, 0.4)",
        modal: "0 20px 50px -12px rgba(0, 0, 0, 0.65)",
      },
    },
  },
  plugins: [],
};

export default config;
