/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        xs: ['0.875rem', { lineHeight: '1.25rem' }],
        sm: ['1rem', { lineHeight: '1.5rem' }],
        base: ['1.125rem', { lineHeight: '1.75rem' }],
        lg: ['1.25rem', { lineHeight: '1.75rem' }],
        xl: ['1.375rem', { lineHeight: '1.875rem' }],
        '2xl': ['1.625rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
      },
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
