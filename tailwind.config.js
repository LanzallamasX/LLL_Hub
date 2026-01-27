/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lll: {
          bg: "var(--lll-bg)",
          "bg-soft": "var(--lll-bg-soft)",
          "bg-softer": "var(--lll-bg-softer)",
          border: "var(--lll-border)",

          accent: "var(--lll-accent)",
          "accent-soft": "var(--lll-accent-soft)",
          "accent-alt": "var(--lll-accent-alt)",

          text: "var(--lll-text)",
          "text-soft": "var(--lll-text-soft)",
        },
      },
    },
  },
  plugins: [],
};
