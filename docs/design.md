---
layout: default
title: Design
description: Frontend design language and UX patterns in Geetanjali.
---

# Design

The UI should feel like a quiet library, not a busy app. Warm colors, readable type, and enough space to breathe. The scripture is the star — the interface just helps you find and absorb it.

This doc covers the visual language and patterns we use across Geetanjali.

## Philosophy

Four principles guide the design:

1. **Mobile-first** — Design for phones, scale up to desktop
2. **Content-forward** — Scripture is the hero, UI is the frame
3. **Warm accessibility** — Inviting colors, readable text, clear interactions
4. **Theme parity** — Light and dark modes are equal citizens, not afterthoughts

## Visual Identity

### Color System

#### Light Mode (Default)

```
SURFACES                           INTERACTIVE
├── Base:     white, gray-50       ├── Primary:  orange-600
├── Warm:     amber-50             ├── Hover:    orange-700
└── Elevated: amber-100            └── Active:   orange-800

TEXT                               BORDERS
├── Primary:   gray-900            ├── Default:  amber-200
├── Secondary: gray-600            ├── Subtle:   amber-100
├── Muted:     gray-400            └── Focus:    orange-500
└── Sanskrit:  amber-900
```

#### Dark Mode

```
SURFACES                           INTERACTIVE
├── Base:     gray-900             ├── Primary:  orange-600
├── Warm:     gray-800             ├── Hover:    orange-500
└── Reading:  stone-900, stone-800 └── Active:   orange-400

TEXT                               BORDERS
├── Primary:   gray-100            ├── Default:  gray-700
├── Secondary: gray-300            ├── Subtle:   gray-800
├── Tertiary:  gray-400            └── Focus:    orange-500
├── Muted:     gray-500
└── Sanskrit:  amber-400, amber-200

FOCUS STATES
├── Ring:        orange-500
└── Ring offset: gray-900
```

**Stone in dark mode**: Reading-focused components (ReadingMode, VerseFocus, IntroCard, ChapterSelector) use `stone-800/900` instead of `gray-800/900` for a warmer feel that aligns with the "quiet library" philosophy.

**Text hierarchy in dark mode**: Use `gray-100` for primary content, `gray-300` for secondary labels, `gray-400` for tertiary/helper text, and `gray-500` sparingly for truly de-emphasized content. Avoid using the same gray value for both light and dark modes — dark mode typically needs one step lighter for equivalent visual weight.

#### Semantic Colors

Reserved for specific content types:

| Color | Use Case | Components |
|-------|----------|------------|
| Purple/Pink | Reflections & contemplation | ReflectionsSection, case views |
| Green | Steps, success, positive actions | StepsSection, confirmations |
| Blue | Follow-ups, secondary paths | Follow-up questions, info states |
| Red | Favorites, destructive actions | Heart icons, delete buttons |

```
REFLECTIONS (purple-pink gradient)
Light                              Dark
├── Background: purple-50/pink-50  ├── Background: purple-900/20, pink-900/20
├── Border:     purple-100         ├── Border:     purple-800
├── Icon:       purple-600         ├── Icon:       purple-400
└── Text:       purple-700         └── Text:       purple-400

STEPS (green)
Light                              Dark
├── Background: green-100          ├── Background: green-900/40
├── Border:     green-300          ├── Border:     green-700
├── Icon:       green-600          ├── Icon:       green-400
└── Text:       green-700          └── Text:       green-400

FOLLOW-UPS (blue)
Light                              Dark
├── Background: blue-50            ├── Background: blue-900/30
├── Border:     blue-100           ├── Border:     blue-800
├── Icon:       blue-600           ├── Icon:       blue-400
└── Text:       blue-700           └── Text:       blue-400

FAVORITES & ERRORS (red)
Light                              Dark
├── Filled:     red-500            ├── Filled:     red-500
├── Unfilled:   gray-400           ├── Unfilled:   gray-500
├── Error bg:   red-50             ├── Error bg:   red-900/20
└── Error text: red-600            └── Error text: red-400
```

Amber creates warmth. Orange signals action. Gray provides contrast.

### Typography

| Usage | Font | Scale |
|-------|------|-------|
| Headings | Spectral (serif) | 2xl → 4xl |
| Body | Source Sans Pro | base → lg |
| Sanskrit | Noto Serif Devanagari | base → 3xl |

```
Mobile (base)           Desktop (lg+)
─────────────           ─────────────
H1: text-2xl     →      text-4xl
H2: text-xl      →      text-2xl
Body: text-base  →      text-lg
```

### Spacing

Responsive padding scales with viewport:

```
Cards:    p-3 sm:p-4 lg:p-6
Sections: py-6 sm:py-8 lg:py-12
Gaps:     gap-3 sm:gap-4 lg:gap-6
```

## Responsive Patterns

Two primary breakpoints:

| Breakpoint | Width | Use Case |
|------------|-------|----------|
| `sm:` | 640px | Most responsive changes |
| `lg:` | 1024px | Desktop enhancements |

`md:` (768px) is reserved for navigation toggle only.

### Grid Layouts

```
Mobile          Tablet           Desktop
1 column        2 columns        3-4 columns
─────────       ─────────        ─────────
  [card]          [card][card]     [card][card][card][card]
  [card]          [card][card]     [card][card][card][card]
```

Implementation: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

### Navigation

Mobile shows hamburger menu with slide-out drawer. Desktop shows inline links.

```
Mobile                    Desktop
──────                    ───────
[Logo] [≡]                [Logo] [Read] [Verses] [Search] [Ask →]
```

## Component Patterns

### Buttons

Two-tier color system aligned with "quiet library" design philosophy:

#### Primary CTAs (Orange-600)
Page-level actions that drive navigation or major decisions.

| Use Case | Example |
|----------|---------|
| Hero buttons | "Get Started", "Explore Verses" |
| Form submissions | Login, Signup, Submit Consultation |
| Navigation CTAs | "New Consultation", "Go Home" |
| Primary filters | Featured/All/Chapter filter pills |
| Search buttons | Main search submit |

```
Light:  bg-orange-600 hover:bg-orange-700 text-white
Dark:   dark:bg-orange-600 dark:hover:bg-orange-500 text-white
Focus:  focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-900 focus:ring-orange-500

px-6 py-3 rounded-xl (hero)
px-4 py-2 rounded-lg (inline)
```

#### Contextual Actions (Amber-600)
In-content interactions that feel softer, more contemplative.

| Use Case | Example |
|----------|---------|
| Reading mode controls | "Start Reading", "Start Intro" |
| Secondary filters | Topic/principle pills |
| Clear/reset actions | "Clear filters" within content |
| Toggle switches | Translation toggle |
| Non-destructive confirms | Modal confirms (non-delete) |

```
bg-amber-600 hover:bg-amber-700 text-white
px-4 py-2 rounded-lg
```

#### Secondary (Outline)
```
bg-amber-100 text-amber-800 border border-amber-200
hover:bg-amber-200
```

#### Ghost
```
text-orange-600 hover:text-orange-700
```

Hero CTAs scale: `px-6 py-3 sm:px-8 sm:py-3.5`

### Cards

```
┌───────────────────────────────────────────┐
│  Light: bg-amber-50 border-amber-200      │
│  Dark:  dark:bg-gray-800 dark:border-gray-700
│                                           │
│  p-3 sm:p-4 rounded-xl                    │
│  hover:shadow-md hover:-translate-y-0.5   │
│  transition-all duration-150              │
└───────────────────────────────────────────┘
```

For elevated/highlighted cards:
```
Light: bg-white shadow-lg border-amber-200
Dark:  dark:bg-gray-800 dark:border-gray-700
```

### Form Inputs

```css
/* Sizing */
px-3 sm:px-4 py-2.5 sm:py-2
text-base sm:text-sm
rounded-lg

/* Light mode */
bg-white border-amber-200
text-gray-900 placeholder-gray-500

/* Dark mode */
dark:bg-gray-800 dark:border-gray-600
dark:text-gray-100 dark:placeholder-gray-400

/* Focus (both modes) */
focus:ring-2 focus:ring-orange-500 focus:border-transparent
```

Larger touch targets on mobile (py-2.5), compact on desktop (py-2).

### Loading States

Skeleton loaders match final layout structure:

```
┌──────────────────────┐   ┌──────────────────────┐
│  ████████░░░░░░░░░   │   │  ॥ 2.47 ॥            │
│  ██████████████░░░   │ → │  कर्मण्येवाधिकारस्ते         │
│  ████████░░░░░░░░░   │   │  "Focus on duty..."  │
└──────────────────────┘   └──────────────────────┘
     skeleton                   loaded
```

### Thinking Animation

Shimmer effect for AI processing:

```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
background: linear-gradient(
  90deg,
  amber-100 0%,
  amber-50 50%,
  amber-100 100%
);
background-size: 200% 100%;
animation: shimmer 1.5s infinite;
```

## Page Layouts

### Standard Page

```
┌──────────────────────────────────────────────────────┐
│  [Navbar]                                            │
├──────────────────────────────────────────────────────┤
│                                                      │
│    [Page Title]                                      │
│    [Subtitle]                                        │
│                                                      │
│    ┌────────────────────────────────────────────┐    │
│    │  [Main Content Area]                       │    │
│    │  max-w-6xl mx-auto px-4                    │    │
│    └────────────────────────────────────────────┘    │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [Footer]                                            │
└──────────────────────────────────────────────────────┘
```

### Reading Mode

```
┌──────────────────────────────────────────────────────┐
│  [Minimal Header]                                    │
├──────────────────────────────────────────────────────┤
│                                                      │
│                        ॐ                            │
│           [Large Sanskrit Text]                      │
│                  ॥ 2.47 ॥                           │
│                                                      │
│         [Tap for translation]                        │
│                                                      │
│  ← swipe →                                           │
│                                                      │
├──────────────────────────────────────────────────────┤
│  [◀] [Chapter Selector] [Font Size] [▶]              │
└──────────────────────────────────────────────────────┘
```

Minimal chrome. Sanskrit is the hero. Progressive disclosure.

## Interaction Patterns

### Navigation

| Action | Mobile | Desktop |
|--------|--------|---------|
| Next verse | Swipe left | → or J |
| Previous | Swipe right | ← or K |
| Toggle translation | Tap verse | Tap verse |
| Quick search | — | ⌘K |

### Focus Management

- `focus-visible:ring-2 focus-visible:ring-orange-500`
- Focus visible only on keyboard navigation
- Logical tab order

### Transitions

```css
transition-all duration-150    /* Quick interactions */
transition-all duration-300    /* Panel reveals */
ease-in-out                    /* Natural motion */
```

## Accessibility

- **Contrast**: All text meets WCAG AA (4.5:1 minimum)
- **Touch targets**: 44x44px minimum on mobile
- **Focus indicators**: Visible on all interactive elements
- **Screen readers**: ARIA labels and semantic HTML
- **Reduced motion**: Respects `prefers-reduced-motion`

## Dark Mode Guidelines

Dark mode is a first-class feature, not a retrofit. With the token system (v1.16.0), dark mode is handled automatically via CSS custom property overrides.

### Principles

1. **Use semantic tokens** — `--text-primary`, `--surface-warm`, not raw colors
2. **No `dark:` prefixes** — Token values change automatically in `.dark` context
3. **Shift, don't invert** — Dark mode isn't just inverted colors; tokens are tuned for visual weight
4. **Test both modes** — Verify readability and aesthetics in light and dark before shipping

### Token-Based Approach (v1.16.0)

Components use semantic tokens that automatically adapt to dark mode:

```tsx
// ✅ Correct - uses semantic tokens
className="bg-[var(--surface-warm)] text-[var(--text-primary)] border-[var(--border-default)]"

// ❌ Avoid - hardcoded colors require dark: prefixes
className="bg-amber-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
```

### Common Token Mappings

| Purpose | Token | Light Value | Dark Value |
|---------|-------|-------------|------------|
| Page background | `--surface-base` | gray-50 | gray-900 |
| Card background | `--surface-warm` | amber-50 tint | gray-800 + amber tint |
| Primary text | `--text-primary` | gray-900 | gray-100 |
| Secondary text | `--text-secondary` | gray-600 | gray-400 |
| Muted text | `--text-muted` | gray-400 | gray-600 |
| Borders | `--border-default` | gray-200 | gray-700 |
| Focus ring | `--focus-ring` | primary-500 | primary-400 |
| Focus offset | `--focus-ring-offset` | white | gray-900 |

### Status Colors

Status tokens also adapt automatically:

| Status | Token | Light | Dark |
|--------|-------|-------|------|
| Error | `--status-error-bg` | red-50 | red-900 |
| Success | `--status-success-bg` | green-50 | green-900 |
| Warning | `--status-warning-bg` | yellow-100 | yellow-900 |
| Info | `--status-info-bg` | blue-100 | blue-900/40 |

## Theming System (v1.16.0)

The design system uses a 3-tier CSS custom property architecture enabling full theming without code changes.

### Token Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  Tier 1: PRIMITIVES (frontend/src/styles/tokens/primitives.css)    │
│  └─ Raw scales: color palettes, font families, spacing, radii      │
│  └─ Customizable foundation for themes                              │
├─────────────────────────────────────────────────────────────────────┤
│  Tier 2: SEMANTIC (frontend/src/styles/tokens/semantic.css)        │
│  └─ Purpose-driven: --text-primary, --surface-elevated             │
│  └─ Light mode defaults + .dark {} overrides                        │
├─────────────────────────────────────────────────────────────────────┤
│  Tier 3: DERIVED (frontend/src/styles/tokens/derived.css)          │
│  └─ State-specific: hover, focus, disabled                          │
│  └─ Reduced motion preferences                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Using Tokens in Components

Components use semantic tokens via Tailwind's arbitrary value syntax:

```tsx
// Colors - use semantic tokens
className="bg-[var(--surface-warm)] text-[var(--text-primary)]"
className="border-[var(--border-default)]"

// Fonts - use Tailwind utilities (reference tokens internally)
className="font-serif"      // Uses --font-family-display
className="font-sanskrit"   // Uses --font-family-sanskrit
className="font-body"       // Uses --font-family-body
```

### Dark Mode

Dark mode is handled automatically via CSS token overrides. No `dark:` prefixes in components:

```css
/* semantic.css */
:root {
  --surface-warm: var(--color-warm-50);      /* Light: amber-50 */
  --text-primary: var(--color-neutral-900);  /* Light: gray-900 */
}

.dark {
  --surface-warm: color-mix(in srgb, var(--color-warm-900) 15%, var(--color-neutral-800));
  --text-primary: var(--color-neutral-100);  /* Dark: gray-100 */
}
```

### Token Categories

| Category | Primitives | Semantic | Usage |
|----------|------------|----------|-------|
| **Colors** | `--color-primary-600` | `--text-primary` | All colors |
| **Typography** | `--font-family-display` | `--font-heading` | Font styles |
| **Spacing** | `--spacing-4` | `--spacing-card` | Margins, padding |
| **Radius** | `--radius-lg` | `--radius-button` | Border radius |
| **Shadows** | `--shadow-md` | `--shadow-card` | Elevation |
| **Motion** | `--duration-200` | `--transition-normal` | Animations |

### Checklist for New Components

- [ ] Use semantic tokens (`--surface-*`, `--text-*`) not primitives
- [ ] No `dark:` prefixes - dark mode via token overrides
- [ ] Use `--focus-ring` and `--focus-ring-offset` for focus states
- [ ] Test in both light and dark themes

## Implementation Notes

### Font Loading

Google Fonts with `font-display: swap`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="...Spectral|Source+Sans+3|Noto+Serif+Devanagari" rel="stylesheet">
```

### Tailwind Config

Font utilities reference CSS custom properties for theming:

```js
fontFamily: {
  heading: ['var(--font-family-display)', 'Georgia', 'serif'],
  body: ['var(--font-family-body)', 'system-ui', 'sans-serif'],
  sanskrit: ['var(--font-family-sanskrit)', 'serif'],
  mono: ['var(--font-family-mono)', 'ui-monospace', 'monospace'],
}
```

### CSS Token Files

Located in `frontend/src/styles/tokens/`:

| File | Purpose | Customizable |
|------|---------|--------------|
| `primitives.css` | Raw design scales | Yes - theme foundation |
| `semantic.css` | Contextual tokens | Rarely - stable API |
| `derived.css` | State tokens | Rarely - stable API |
