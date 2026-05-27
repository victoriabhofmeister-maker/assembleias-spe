/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
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
        sans: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};
