/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Palette chaleureuse reprise de l'ancien thème, adoucie
        bg: '#faf5ef',
        navy: '#2c2420',
        copper: { DEFAULT: '#b87333', dark: '#9a5f2a' },
        sage: { DEFAULT: '#6b8f5e', dark: '#4a7040' },
        sand: '#d4a054',
        clay: '#c45c5c',
        plum: '#8b6b8a',
        card: '#ffffff',
        line: '#e0d6cc',
        muted: '#7a6e63',
        ink: '#3d3430',
      },
      borderRadius: {
        xl2: '14px',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(44,36,32,.08)',
        lift: '0 6px 24px rgba(44,36,32,.14)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
