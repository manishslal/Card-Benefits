/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class', // Enable dark mode via class toggle
  theme: {
    extend: {
      // Custom colors using CSS variables from design-tokens.css
      colors: {
        primary: {
          50: 'var(--color-primary-50)',
          500: 'var(--color-primary-500)',
          600: 'var(--color-primary-600)',
          700: 'var(--color-primary-700)',
          900: 'var(--color-primary-900)',
        },
        success: {
          50: 'var(--color-success-50)',
          500: 'var(--color-success-500)',
          600: 'var(--color-success-600)',
        },
        alert: {
          50: 'var(--color-alert-50)',
          500: 'var(--color-alert-500)',
          600: 'var(--color-alert-600)',
        },
        danger: {
          50: 'var(--color-danger-50)',
          500: 'var(--color-danger-500)',
          600: 'var(--color-danger-600)',
        },
        accent: {
          500: 'var(--color-accent-500)',
        },
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
          tertiary: 'var(--color-text-tertiary)',
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
        base: 'var(--transition-base)',
        slow: 'var(--transition-slow)',
      },
      // Custom max-widths
      maxWidth: {
        container: 'var(--max-width-container)',
        tablet: 'var(--max-width-tablet)',
        mobile: 'var(--max-width-mobile)',
      },
      // Typography sizes as utility classes
      fontSize: {
        h1: ['var(--font-h1)', { lineHeight: '1.2', fontWeight: 'var(--font-weight-bold)' }],
        h2: ['var(--font-h2)', { lineHeight: '1.3', fontWeight: 'var(--font-weight-bold)' }],
        h3: ['var(--font-h3)', { lineHeight: '1.4', fontWeight: 'var(--font-weight-semibold)' }],
        'body-lg': ['var(--font-body-lg)', { lineHeight: '1.5', fontWeight: 'var(--font-weight-normal)' }],
        'body-md': ['var(--font-body-md)', { lineHeight: '1.5', fontWeight: 'var(--font-weight-normal)' }],
        'body-sm': ['var(--font-body-sm)', { lineHeight: '1.5', fontWeight: 'var(--font-weight-normal)' }],
        label: ['var(--font-label)', { lineHeight: '1.5', fontWeight: 'var(--font-weight-semibold)' }],
      },
    },
  },
  plugins: [],
};
