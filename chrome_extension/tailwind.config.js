export default {
  darkMode: 'class',
  content: ['./popup.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 18px 60px rgba(15, 23, 42, 0.35)'
      },
      keyframes: {
        floaty: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-6px)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' }
        },
        pulseRing: {
          '0%': { transform: 'scale(0.96)', opacity: '0.35' },
          '50%': { transform: 'scale(1.03)', opacity: '0.85' },
          '100%': { transform: 'scale(0.96)', opacity: '0.35' }
        }
      },
      animation: {
        floaty: 'floaty 5.5s ease-in-out infinite',
        shimmer: 'shimmer 1.8s linear infinite',
        pulseRing: 'pulseRing 2s ease-in-out infinite'
      }
    }
  },
  plugins: []
};