/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Tokens (rgba via CSS vars — trocam entre light/dark)
        bg: "rgb(var(--bg) / <alpha-value>)",
        fg: "rgb(var(--fg) / <alpha-value>)",
        line: "rgb(var(--border) / <alpha-value>)",
        card: {
          DEFAULT: "rgb(var(--card) / <alpha-value>)",
          fg: "rgb(var(--card-fg) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "rgb(var(--muted) / <alpha-value>)",
          fg: "rgb(var(--muted-fg) / <alpha-value>)",
        },
        primary: {
          DEFAULT: "rgb(var(--primary) / <alpha-value>)",
          fg: "rgb(var(--primary-fg) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          fg: "rgb(var(--accent-fg) / <alpha-value>)",
        },
        // Paleta marca (uso pontual em gradientes)
        ink: {
          50: "#f8f7f4",
          100: "#eeebe3",
          200: "#d7d2c4",
          300: "#b8b0a0",
          400: "#9a9180",
          500: "#7a7263",
          600: "#5a5447",
          700: "#3d382f",
          800: "#26231d",
          900: "#171511",
          950: "#0a0907",
        },
        gold: {
          50: "#fdf8ed",
          100: "#faedca",
          200: "#f4d891",
          300: "#edbe58",
          400: "#e6a73a",
          500: "#d68b1f",
          600: "#b96d18",
          700: "#964f17",
          800: "#7c401b",
          900: "#69361b",
        },
        // Mantém navy/* legado pra evitar quebras enquanto componentes migram
        navy: {
          50: "#f1f4fa",
          100: "#dde4f1",
          200: "#b4c3df",
          300: "#7f97c6",
          400: "#4d6cab",
          500: "#2f4f8e",
          600: "#1f3a6f",
          700: "#142a55",
          800: "#0e1f3f",
          900: "#08152c",
        },
      },
      fontFamily: {
        sans: ['"Inter Tight"', "Inter", "system-ui", "sans-serif"],
        display: ['"Fraunces"', '"Cormorant Garamond"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      boxShadow: {
        soft: "0 1px 2px rgb(var(--shadow) / 0.05), 0 4px 12px rgb(var(--shadow) / 0.04)",
        lift: "0 2px 4px rgb(var(--shadow) / 0.06), 0 12px 24px rgb(var(--shadow) / 0.08)",
        glow: "0 0 0 1px rgb(var(--accent) / 0.25), 0 8px 24px rgb(var(--accent) / 0.15)",
      },
      backgroundImage: {
        "grain":
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160' viewBox='0 0 160 160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: 0, transform: "translateY(4px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        "slide-up": {
          "0%": { opacity: 0, transform: "translateY(8px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "slide-up": "slide-up 0.35s cubic-bezier(0.16,1,0.3,1)",
      },
    },
  },
  plugins: [],
};
