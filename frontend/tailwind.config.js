/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        merceria: {
          50: '#fdf4f5',
          100: '#fbe8eb',
          200: '#f7d5db',
          300: '#f0b3be',
          400: '#e5879a',
          500: '#d75d77',
          600: '#c1415f',
          700: '#a2324e',
          800: '#872c43',
          900: '#73293c',
          950: '#41121e',
        }
      }
    },
  },
  plugins: [],
}
