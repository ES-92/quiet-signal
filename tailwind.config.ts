import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f7f4ef',
        ink: '#1f1e1c',
        graphite: '#5f5b55',
        line: '#ddd6cb',
        moss: '#52624b',
        clay: '#a65f3f'
      },
      fontFamily: {
        serif: ['Iowan Old Style', 'Palatino Linotype', 'Palatino', 'Georgia', 'serif'],
        sans: ['Aptos', 'Segoe UI', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
} satisfies Config
