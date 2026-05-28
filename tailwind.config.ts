import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--color-paper) / <alpha-value>)',
        ink: 'rgb(var(--color-ink) / <alpha-value>)',
        graphite: 'rgb(var(--color-graphite) / <alpha-value>)',
        line: 'rgb(var(--color-line) / <alpha-value>)',
        moss: 'rgb(var(--color-moss) / <alpha-value>)',
        clay: 'rgb(var(--color-clay) / <alpha-value>)'
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        sans: ['Aptos', 'Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
