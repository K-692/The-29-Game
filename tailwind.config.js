/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Brand palette taken from the app logo: deep felt green, warm cream, card red.
      colors: {
        felt: {
          950: '#0b1f15',
          900: '#10291c',
          800: '#153524',
          700: '#1b432e', // logo background
          600: '#225438',
          500: '#2c6a47',
          400: '#3f8560',
        },
        cream: {
          50: '#fcfaf3',
          100: '#f5f0e1', // logo "29"
          200: '#e9e1c9',
          300: '#d8ccaa',
          400: '#b9ab84',
        },
        suit: {
          red: '#c9432f', // logo hearts / diamonds
          redDark: '#a5321f',
        },
        table: {
          felt: '#0b522c',
          dark: '#07361d',
          light: '#0e6737',
          border: '#1f7a46',
          gold: '#d4af37',
        },
      },
      fontFamily: {
        // System serif to echo the logo's "29" without needing internet fonts on a LAN.
        display: ['"Iowan Old Style"', '"Palatino Linotype"', 'Palatino', 'Georgia', '"Times New Roman"', 'serif'],
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 10px 30px -12px rgba(5, 20, 12, 0.55)',
        'card': '0 8px 16px -2px rgba(0, 0, 0, 0.4), 0 3px 6px -2px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 16px 32px -4px rgba(0, 0, 0, 0.5), 0 6px 12px -2px rgba(0, 0, 0, 0.4)',
        'felt': 'inset 0 0 100px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}

