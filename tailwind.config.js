/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'vazirmatn': ['Vazirmatn', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

