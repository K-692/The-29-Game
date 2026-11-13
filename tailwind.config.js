/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        table: {
          felt: '#0b522c',
          dark: '#07361d',
          light: '#0e6737',
          border: '#1f7a46',
          gold: '#d4af37',
        },
      },
      boxShadow: {
        'card': '0 8px 16px -2px rgba(0, 0, 0, 0.4), 0 3px 6px -2px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 16px 32px -4px rgba(0, 0, 0, 0.5), 0 6px 12px -2px rgba(0, 0, 0, 0.4)',
        'felt': 'inset 0 0 100px rgba(0, 0, 0, 0.6)',
      },
    },
  },
  plugins: [],
}
