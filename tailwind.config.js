/** @type {import('tailwindcss').Config} */
// Couleurs définies via variables CSS (voir :root dans src/index.css) pour
// permettre un thème sombre par défaut tout en gardant les modificateurs
// d'opacité Tailwind (ex: bg-clay/5, border-line/60).
const v = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: v('--bg'),
        navy: v('--navy'),
        copper: { DEFAULT: v('--copper'), dark: v('--copper-dark') },
        sage: { DEFAULT: v('--sage'), dark: v('--sage-dark') },
        sand: v('--sand'),
        clay: v('--clay'),
        plum: v('--plum'),
        card: v('--card'),
        line: v('--line'),
        muted: v('--muted'),
        ink: v('--ink'),
      },
      borderRadius: {
        xl2: '14px',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(0,0,0,.35)',
        lift: '0 6px 24px rgba(0,0,0,.5)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Noto Sans', 'Helvetica', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
