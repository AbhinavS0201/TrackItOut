/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // TrackItOut Official Primary Palette
        'midnight-navy': '#071B3A',
        'royal-navy': '#103B78',
        'electric-blue': '#397FE8',
        'aqua-teal': '#8DE4E8',

        // TrackItOut Official Pastel Palette
        'pastel-lavender': '#C9B8FF',
        'pastel-blue': '#B9D5FF',
        'pastel-mint': '#A9EDE5',
        'pastel-purple': '#E5DFFF',

        // Background & Text Defaults
        'app-bg': '#F4F7FC',
        'app-card': '#FFFFFF',
        'main-text': '#17243B',
        'muted-text': '#64748B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(7, 27, 58, 0.08)',
        'glass-lg': '0 16px 48px 0 rgba(7, 27, 58, 0.14)',
        'glass-hover': '0 12px 40px 0 rgba(57, 127, 232, 0.18)',
        'glass-glow': '0 0 24px rgba(57, 127, 232, 0.35)',
        'aqua-glow': '0 0 24px rgba(141, 228, 232, 0.45)',
        'pastel-glow': '0 0 24px rgba(201, 184, 255, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        deep: '24px',
      },
      borderRadius: {
        '2.5xl': '20px',
        '3xl': '24px',
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'waveform': 'waveform 1.2s ease-in-out infinite',
        'float': 'float 4s ease-in-out infinite',
      },
      keyframes: {
        waveform: {
          '0%, 100%': { height: '8px' },
          '50%': { height: '28px' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' },
        }
      }
    },
  },
  plugins: [],
}
