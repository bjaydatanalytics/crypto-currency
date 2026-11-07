import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      /**
       * Every colour resolves through a CSS variable rather than a literal.
       *
       * The marketing site and admin run on the dark lime palette defined at
       * `:root`; the customer panel re-declares the same variables in light
       * blue under `[data-panel]`. Because the class names never change, a
       * shared primitive like `<Card>` or `<Button>` renders correctly in both
       * without a single conditional — see `app/globals.css` for the values.
       *
       * The `<alpha-value>` placeholder is what keeps `bg-accent/12` and
       * `text-muted/70` working, so these stay space-separated RGB triplets.
       */
      colors: {
        /* Backgrounds */
        base: {
          DEFAULT: 'rgb(var(--c-base) / <alpha-value>)',
          900: 'rgb(var(--c-base-900) / <alpha-value>)',
          800: 'rgb(var(--c-base-800) / <alpha-value>)',
          700: 'rgb(var(--c-base-700) / <alpha-value>)',
        },
        /* Cards */
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          raised: 'rgb(var(--c-surface-raised) / <alpha-value>)',
        },
        /* Lime in the dark theme, blue in the panel */
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          bright: 'rgb(var(--c-accent-bright) / <alpha-value>)',
          dim: 'rgb(var(--c-accent-dim) / <alpha-value>)',
        },
        /**
         * Legible text on an accent fill — black on lime, white on blue.
         * Replaces the hardcoded `text-black` that only held in the dark theme.
         */
        'on-accent': 'rgb(var(--c-on-accent) / <alpha-value>)',
        /** Primary body and heading text. White on dark, near-black in the panel. */
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        /**
         * The faint wash used for inset rows, chips and secondary buttons.
         * Was `bg-white/[0.03]`, which turns invisible on a light background.
         */
        elevate: 'rgb(var(--c-elevate) / <alpha-value>)',
        line: 'var(--c-line)',
        positive: 'rgb(var(--c-positive) / <alpha-value>)',
        negative: 'rgb(var(--c-negative) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        /** Fixed deep navy. Identical in both themes — used for the 401k banner. */
        navy: {
          DEFAULT: '#16233F',
          deep: '#0E1A33',
          soft: '#1E3156',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        /* Accent-tinted, so the lime glow does not follow the blue panel */
        glow: '0 0 40px -12px var(--c-glow)',
        'glow-sm': '0 0 20px -8px var(--c-glow-sm)',
        card: 'var(--c-shadow-card)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px)',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'pulse-glow': {
          '0%, 100%': { opacity: '0.5' },
          '50%': { opacity: '1' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2s infinite',
        'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
      },
    },
  },
  plugins: [],
}

export default config
