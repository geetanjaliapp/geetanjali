/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
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
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
