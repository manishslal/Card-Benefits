/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: ['class', 'media'], // Support both class and system preference
  theme: {
    extend: {
      // Custom colors using CSS variables from design-tokens.css
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          light: 'var(--color-primary-light)',
        },
        secondary: {
          DEFAULT: 'var(--color-secondary)',
          light: 'var(--color-secondary-light)',
        },
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
        },
        error: {
          DEFAULT: 'var(--color-error)',
          light: 'var(--color-error-light)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          light: 'var(--color-info-light)',
        },
        gray: {
          50: 'var(--color-gray-50)',
          100: 'var(--color-gray-100)',
          200: 'var(--color-gray-200)',
          300: 'var(--color-gray-300)',
          400: 'var(--color-gray-400)',
          500: 'var(--color-gray-500)',
          600: 'var(--color-gray-600)',
          700: 'var(--color-gray-700)',
          900: 'var(--color-gray-900)',
        },
        bg: {
          DEFAULT: 'var(--color-bg)',
          secondary: 'var(--color-bg-secondary)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          secondary: 'var(--color-text-secondary)',
        },
      },

      // Custom spacing using CSS variables
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)',
        '4xl': 'var(--space-4xl)',
      },

      // Custom shadows using CSS variables
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },

      // Custom border radius using CSS variables
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        full: 'var(--radius-full)',
      },

      // Custom transition durations
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },

      // Custom easing functions
      transitionTimingFunction: {
        'ease-bounce': 'var(--ease-bounce)',
      },

      // Custom max-widths
      maxWidth: {
        'container-md': 'var(--max-width-md)',
        'container-lg': 'var(--max-width-lg)',
        container: 'var(--max-width)',
      },

      // Typography sizes as utility classes
      fontSize: {
        h1: ['var(--text-h1)', { lineHeight: 'var(--leading-tight)', fontWeight: 'var(--font-weight-700)' }],
        h2: ['var(--text-h2)', { lineHeight: 'var(--leading-tight)', fontWeight: 'var(--font-weight-700)' }],
        h3: ['var(--text-h3)', { lineHeight: 'var(--leading-snug)', fontWeight: 'var(--font-weight-600)' }],
        h4: ['var(--text-h4)', { lineHeight: 'var(--leading-snug)', fontWeight: 'var(--font-weight-600)' }],
        h5: ['var(--text-h5)', { lineHeight: 'var(--leading-compact)', fontWeight: 'var(--font-weight-600)' }],
        h6: ['var(--text-h6)', { lineHeight: 'var(--leading-compact)', fontWeight: 'var(--font-weight-500)' }],
        'body-lg': ['var(--text-body-lg)', { lineHeight: '1.6' }],
        'body-md': ['var(--text-body-md)', { lineHeight: '1.6' }],
        'body-sm': ['var(--text-body-sm)', { lineHeight: '1.5' }],
        caption: ['var(--text-caption)', { lineHeight: '1.4', letterSpacing: 'var(--tracking-wide)' }],
        label: ['var(--text-label)', { lineHeight: '1.4', fontWeight: 'var(--font-weight-600)', letterSpacing: '0.01em' }],
        'mono-md': ['var(--text-mono-md)', { lineHeight: '1.6' }],
        'mono-sm': ['var(--text-mono-sm)', { lineHeight: '1.5', letterSpacing: '0.01em' }],
      },

      // Font families
      fontFamily: {
        primary: 'var(--font-primary)',
        heading: 'var(--font-heading)',
        mono: 'var(--font-mono)',
      },

      // Custom animations
      animation: {
        'fade-in': 'fadeIn var(--duration-base) var(--ease-out)',
        'slide-up': 'slideUp var(--duration-base) var(--ease-bounce)',
        'slide-down': 'slideDown var(--duration-base) var(--ease-bounce)',
        'scale-in': 'scaleIn var(--duration-base) var(--ease-out)',
        'shimmer': 'shimmer 2s infinite',
        'in': 'slideInFromBottom 500ms ease-out',
      },

      // Keyframes
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        slideInFromBottom: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },

      // Custom touch target sizes for accessibility
      minHeight: {
        touch: 'var(--touch-target-min)',
      },
      minWidth: {
        touch: 'var(--touch-target-min)',
      },
    },
  },
  plugins: [],
};
