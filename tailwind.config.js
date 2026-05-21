/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#fff5f6',
          100: '#ffeef0',
          200: '#ffd6db',
          300: '#ffadb7',
          400: '#ff7587',
          500: '#ff4d64',
          600: '#e6a4a8', // Tom de rosa queimado da logo
          700: '#d18c90',
          800: '#b06d71',
          900: '#8c5255',
        },
        gold: {
          50: '#fffbf2',
          100: '#fef5e1',
          200: '#fce6b5',
          300: '#f9d17f',
          400: '#f5b545',
          500: '#d4af37', // Dourado metálico
          600: '#b8922e',
          700: '#947225',
          800: '#75591e',
          900: '#5c4518',
        }
      },
    },
  },
  plugins: [],
}
