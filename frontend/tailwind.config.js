/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          900: '#0B0F19',
          800: '#111827',
          700: '#1F293D',
          600: '#374151',
        },
        audit: {
          supported: '#10B981',
          contradicted: '#EF4444',
          unsupported: '#F59E0B',
          unverifiable: '#8B5CF6',
          ambiguous: '#64748B',
        },
      },
    },
  },
  plugins: [],
};
