/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode (v1.12.0)
  theme: {
    extend: {
      /*
       * Animations (v1.13.0)
       * Smooth page transitions and UI feedback
       */
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      /*
       * Typography System (v1.16.0)
       * References CSS custom properties from tokens/primitives.css
       * Enables runtime font customization via theming system.
       *
       * Token mapping:
       * - --font-family-display: Spectral (headings, decorative)
       * - --font-family-body: Source Sans 3 (body text)
       * - --font-family-sanskrit: Noto Serif Devanagari
       * - --font-family-mono: Fira Code (code/IDs)
       */
      fontFamily: {
        heading: ['var(--font-family-display)', 'Georgia', 'serif'],
        body: ['var(--font-family-body)', 'system-ui', 'sans-serif'],
        sanskrit: ['var(--font-family-sanskrit)', 'serif'],
        serif: ['var(--font-family-display)', 'Georgia', 'serif'],
        mono: ['var(--font-family-mono)', 'ui-monospace', 'monospace'],
      },
      /*
       * Color System (v1.11.0)
       * Uses Tailwind's built-in colors with semantic roles:
       * - Surfaces: amber-50, amber-100 (warm backgrounds)
       * - Interactive: orange-600/700/800 (buttons, links)
       * - Text: gray-900/600/400, amber-900 (Sanskrit)
       * - Borders: amber-200 (default), amber-100 (subtle)
       * - Status: green (success), yellow (warning), red (error), orange (processing)
       * - Gradients: from-amber-50 via-orange-50 to-red-50 (hero)
       */
      /*
       * Prose/Typography Plugin Customization (v1.16.0)
       * Uses CSS custom properties for theme-aware styling.
       * Dark mode handled via derived.css (.dark .prose overrides)
       */
      typography: {
        DEFAULT: {
          css: {
            // Bold text - uses prose variable for dark mode support
            'strong': {
              color: 'var(--tw-prose-bold)',
              fontWeight: 'var(--font-weight-semibold, 600)',
            },
            // Italic text - uses display font for verse quotes
            'em': {
              fontFamily: 'var(--font-family-display), Georgia, serif',
              fontStyle: 'italic',
            },
            // Paragraph spacing
            'p': {
              marginTop: '0.75em',
              marginBottom: '0.75em',
            },
            // Link styling - uses semantic token for theme-aware colors
            'a': {
              color: 'var(--text-link)',
              textDecoration: 'none',
              '&:hover': {
                color: 'var(--text-link-hover)',
                textDecoration: 'underline',
              },
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
