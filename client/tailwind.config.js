/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Space Grotesk Variable"', "sans-serif"],
        mono: ['"JetBrains Mono Variable"', "monospace"],
      },
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        line: "var(--line)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        brand: "var(--brand)",
        "on-brand": "var(--on-brand)",
        up: "var(--up)",
        down: "var(--down)",
      },
    },
  },
  plugins: [],
};
