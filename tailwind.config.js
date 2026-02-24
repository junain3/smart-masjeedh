/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        masjid: {
          50: "#f8fafc",
          100: "#e2f3ec",
          500: "#059669",
          600: "#047857",
          700: "#065f46",
          800: "#064e3b",
          900: "#022c22"
        }
      }
    }
  },
  plugins: []
};

