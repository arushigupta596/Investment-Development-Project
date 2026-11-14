/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // colours are CSS variables so a company theme can replace them at sign-in (see src/lib/brand.ts)
        ido: Object.fromEntries(['primary', 'navy', 'teal', 'sky', 'muted', 'slate', 'mist', 'line'].map((k) => [k, `rgb(var(--ido-${k}) / <alpha-value>)`])),
      },
      fontFamily: { sans: ['"Avenir Next"', '"Nunito Sans"', 'system-ui', 'sans-serif'] },
      letterSpacing: { tightish: '-0.02em' },
    },
  },
  plugins: [],
}
