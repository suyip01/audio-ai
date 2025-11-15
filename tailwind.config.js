/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        barPulse: {
          '0%, 100%': { opacity: '0.4', transform: 'scaleY(0.6)' },
          '50%': { opacity: '1', transform: 'scaleY(1)' },
        },
      },
      animation: {
        barPulse: 'barPulse 1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
