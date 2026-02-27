/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#4A90D9', light: '#6BA5E7', dark: '#3A7BC8' },
        success: { DEFAULT: '#5CB85C', light: '#7ED07E' },
        accent: { DEFAULT: '#F0AD4E', light: '#F5C882' },
        danger: { DEFAULT: '#D9534F', light: '#E8807D' },
      },
      fontFamily: {
        sans: ['Quicksand', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
