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
       * Typography System (v1.11.0)
       * - Headings: Spectral (classical serif)
       * - Body: Source Sans 3 (clean sans-serif)
       * - Sanskrit: Noto Serif Devanagari (proper glyph rendering)
       * - Mono: System monospace (code/IDs)
       */
      fontFamily: {
        heading: ['Spectral', 'Georgia', 'serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        sanskrit: ['"Noto Serif Devanagari"', 'serif'],
        serif: ['Spectral', 'Georgia', 'serif'], // Override default serif
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
       * Prose/Typography Plugin Customization
       * Subtle styling for markdown content that matches app design:
       * - Bold: amber-800 for warmth (matches Sanskrit text color family)
       * - Italics: inherit color, use serif font for verse quotes
       * - Paragraphs: comfortable spacing
       */
      typography: {
        DEFAULT: {
          css: {
            // Bold text - warm amber for emphasis, matching app palette
            'strong': {
              color: 'rgb(146 64 14)', // amber-800
              fontWeight: '600',
            },
            // Italic text - serif font for verse quotes
            'em': {
              fontFamily: 'Spectral, Georgia, serif',
              fontStyle: 'italic',
            },
            // Paragraph spacing
            'p': {
              marginTop: '0.75em',
              marginBottom: '0.75em',
            },
            // Remove default link styling (handled by app)
            'a': {
              color: 'inherit',
              textDecoration: 'none',
            },
          },
        },
        // Dark mode typography (v1.12.0)
        invert: {
          css: {
            'strong': {
              color: 'rgb(253 230 138)', // amber-200 for dark mode
              fontWeight: '600',
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
