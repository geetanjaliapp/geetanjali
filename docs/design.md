---
layout: default
title: Design Language
description: Design principles, visual language, and component patterns for Geetanjali.
---

# Geetanjali Design Language

This document defines the design principles and patterns that guide Geetanjali's user experience. It answers "what should I build and why?" For token architecture and theme implementation details, see [Theming](./theming.md).

---

## Quick Reference

### When to Use Which Button

| Intent | Style | Token | Example |
|--------|-------|-------|---------|
| Major action, navigation | Primary (orange) | `--interactive-primary` | "Get Started", "Submit" |
| In-content action | Contextual (amber) | `--interactive-contextual` | "Begin Reading", "Apply Filter" |
| Secondary option | Outline | `--interactive-secondary-*` | "Cancel", "Back" |
| Subtle action | Ghost | `--interactive-ghost-*` | "Learn more", "Skip" |

### Surface Hierarchy

| Layer | Token | Use |
|-------|-------|-----|
| Page base | `--surface-page` | Main background |
| Cards | `--surface-card` | Elevated content containers |
| Modals/dropdowns | `--surface-elevated` | Overlays |
| Warm accent | `--surface-warm` | Highlighted sections |

### Component Patterns

```tsx
// Card
className="bg-[var(--surface-card)] border border-[var(--border-default)]
           rounded-[var(--radius-card)] shadow-[var(--shadow-card)]"

// Primary Button
className="bg-[var(--interactive-primary)] text-[var(--text-on-primary)]
           hover:bg-[var(--interactive-primary-hover)]
           rounded-[var(--radius-button)]"

// Focus Ring (add to all interactive elements)
className="focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]
           focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--focus-ring-offset)]"
```

### Key Constraints

| Rule | Reason |
|------|--------|
| Never hardcode colors | Breaks theming; use semantic tokens |
| Never use `dark:` prefixes for colors | Token system handles dark mode automatically |
| Never use `gray-*` in reading components | Use `stone-*` for warmth |
| Never use orange for in-content actions | Reserve orange for primary CTAs; use amber |
| Always test in 8 combinations | 4 themes × 2 modes |

---

## Philosophy

### The Quiet Library

Geetanjali should feel like a quiet library at dusk—warm lamplight on aged paper, the hush of contemplation. The scripture is the reader; we are merely the reading lamp.

This metaphor guides every decision:

- **Warmth over sterility**: Amber undertones, not clinical whites
- **Stillness over stimulation**: Minimal motion, no notification anxiety
- **Clarity over cleverness**: Obvious interactions, no hidden gestures
- **Reverence over decoration**: Ornamentation serves the text, never competes

### The Four Pillars

1. **Mobile-First**
   Not "responsive" but "mobile-native." Most readers encounter sacred texts on personal devices during quiet moments. Desktop enhances; mobile defines.

2. **Content-Forward**
   Every pixel of UI chrome must justify its existence. The Sanskrit verse is always the visual hero. Controls fade until needed.

3. **Warm Accessibility**
   Accessibility isn't a checklist—it's hospitality. We welcome readers with visual impairments, motor difficulties, and cognitive differences with the same warmth as any guest.

4. **Theme Parity**
   Light and dark modes are equal first-class citizens. A reader in dark mode at 2 AM deserves the same contemplative warmth as someone reading at noon.

### Content Hierarchy

Visual priority, highest to lowest:

| Level | Content | Treatment |
|-------|---------|-----------|
| 1. Hero | Sanskrit verse | Largest, most prominent, warm accent |
| 2. Primary | Translation, key message | Standard body, secondary color |
| 3. Secondary | Metadata, labels | Smaller, muted, sans-serif |
| 4. Tertiary | Navigation, controls | Smallest, appears on interaction |

**Principle**: If something competes with scripture for attention, it's too loud.

---

## Visual Language

### Color Philosophy

Our palette centers on amber and orange—the colors of lamp flame, aged parchment, and sunrise. These colors evoke:

- **Continuity**: Manuscripts preserved for millennia
- **Invitation**: Welcoming warmth, not clinical distance
- **Focus**: Warm surfaces reduce eye strain during extended reading

**Color roles** (not specific values—those live in tokens):

| Role | Meaning | Examples |
|------|---------|----------|
| Primary (orange) | Action, brand, navigation | CTAs, links, highlights |
| Warm (amber) | Comfort, content, context | Backgrounds, badges, soft actions |
| Neutral | Structure, text, borders | Body text, dividers, shadows |
| Purple/Pink | Reflection, contemplation | Insights section, reflections |
| Green | Growth, progress, success | Steps completed, confirmations |
| Blue | Information, secondary paths | Follow-ups, info callouts |
| Red | Emotion, favorites, caution | Hearts, errors, destructive actions |

### Typography: Three Voices

Typography signals the nature of content:

| Voice | Font | Purpose |
|-------|------|---------|
| **Tradition** | Spectral (serif) | Headings, translations—the voice of lineage |
| **Clarity** | Source Sans Pro | Body text, UI labels—the voice of accessibility |
| **Scripture** | Noto Serif Devanagari | Sanskrit verses—the voice of the source |

**Scale**: Typography sizes follow Tailwind's responsive syntax (`text-sm sm:text-base lg:text-lg`) rather than tokens, enabling responsive adjustments at each breakpoint.

### Spacing: Breathing Room

Scripture needs space to breathe. Generous whitespace isn't wasted—it creates the visual silence that allows words to resonate.

**Principles**:
- Cards have substantial padding that increases with viewport
- Sections are separated by meaningful vertical rhythm
- Text blocks never feel cramped
- Dense grids expand as screens allow

**Pattern**: `p-3 sm:p-4 lg:p-6` for cards, `gap-3 sm:gap-4 lg:gap-6` for grids.

### Motion: Stillness

Motion should be nearly invisible—a gentle acknowledgment, not a performance.

- Transitions are short (150ms for interactions, 300ms for reveals)
- No autoplaying animations
- Shimmer effects are subtle, not distracting
- Respect `prefers-reduced-motion` via `--motion-safe-*` tokens

---

## Component Patterns

### Buttons: Navigational vs Action

**Critical distinction**: Primary CTA colors (orange) are reserved for page-level actions that drive decisions. In-content actions use softer amber tones.

#### Primary (Orange)
Page-level actions: "Get Started", "Submit", "Login"

```
Token: --interactive-primary
Visual: High contrast, draws the eye
Rule: ONE primary button per viewport
```

#### Contextual (Amber)
In-content actions: "Begin Reading", "Apply Filter", "Toggle"

```
Token: --interactive-contextual
Visual: Softer, blends with content
Rule: Use within content areas, not heroes
```

#### Secondary (Outline)
Dismissive or alternative: "Cancel", "Maybe Later"

```
Token: --interactive-secondary-*
Visual: Border only, minimal fill
Rule: Pairs with primary as the "other option"
```

#### Ghost (Text)
Subtle inline actions: "Learn more", "See details"

```
Token: --interactive-ghost-*
Visual: Text-only, hover reveals intent
Rule: For tertiary actions that shouldn't compete
```

### Cards

Cards are containers for content, not content themselves.

**Principles**:
- Warm backgrounds that create subtle elevation
- Borders that define without dominating
- Hover feedback: gentle lift, deeper shadow
- Never more visual weight than their content

**Pattern**:
```tsx
className="bg-[var(--surface-card)] border border-[var(--border-default)]
           rounded-[var(--radius-card)] shadow-[var(--shadow-card)]
           hover:shadow-[var(--shadow-card-hover)] hover:-translate-y-0.5
           transition-all duration-150"
```

### Form Inputs

**Principles**:
- Larger touch targets on mobile (py-2.5), compact on desktop (py-2)
- Clear focus states with brand-colored rings
- Placeholder text is muted, not invisible
- Error states are red but not aggressive

**Pattern**:
```tsx
className="w-full px-3 py-2.5 sm:py-2
           bg-[var(--input-bg)] border border-[var(--input-border)]
           rounded-[var(--radius-input)] text-[var(--text-primary)]
           placeholder:text-[var(--text-muted)]
           focus:ring-2 focus:ring-[var(--focus-ring)] focus:border-transparent"
```

### Loading States

Skeleton loaders match final layout structure—same heights, widths, and spacing as loaded content.

**Shimmer**: Subtle gradient animation that suggests loading without demanding attention.

```
Direction: Left to right
Speed: 1.5s per cycle
Colors: Warm tints (amber-based), not gray
```

### Navigation

| Context | Pattern |
|---------|---------|
| Mobile | Hamburger menu with slide-out drawer |
| Desktop | Inline links in header |
| Reading mode | Minimal: back button, chapter selector only |

---

## Layout Patterns

### Responsive Philosophy

Mobile is the primary context, not a fallback. Design for 375px first, then enhance.

| Breakpoint | Width | Purpose |
|------------|-------|---------|
| Base | <640px | Phone portrait—the default |
| `sm:` | 640px | Tablet, phone landscape—grid expansion |
| `lg:` | 1024px | Desktop—full navigation, larger type |

**Note**: `md:` (768px) is reserved for navigation toggle only. Avoid using it for content to maintain simplicity.

### Grid System

```
Mobile (base)     Tablet (sm:)      Desktop (lg:)
1 column          2 columns         3-4 columns
```

**Pattern**: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`

### Page Templates

#### Standard Page
```
┌──────────────────────────────────────────┐
│  [Navbar]                                │
├──────────────────────────────────────────┤
│                                          │
│    [Page Title]                          │
│    [Subtitle]                            │
│                                          │
│    ┌────────────────────────────────┐    │
│    │  [Content Area]                │    │
│    │  max-w-6xl mx-auto px-4        │    │
│    └────────────────────────────────┘    │
│                                          │
├──────────────────────────────────────────┤
│  [Footer]                                │
└──────────────────────────────────────────┘
```

#### Reading Mode
```
┌──────────────────────────────────────────┐
│  [Minimal Header]                        │
├──────────────────────────────────────────┤
│                                          │
│                    ॐ                    │
│           [Large Sanskrit Text]          │
│                  ॥ 2.47 ॥               │
│                                          │
│         [Tap for translation]            │
│                                          │
│  ← swipe →                               │
│                                          │
├──────────────────────────────────────────┤
│  [◀] [Chapter Selector] [Font] [▶]       │
└──────────────────────────────────────────┘
```

Minimal chrome. Sanskrit is the hero. Progressive disclosure.

---

## Interaction Patterns

### Gestures & Shortcuts

| Action | Mobile | Desktop |
|--------|--------|---------|
| Next verse | Swipe left | → or J |
| Previous verse | Swipe right | ← or K |
| Toggle translation | Tap verse | Tap verse |
| Quick search | — | ⌘K / Ctrl+K |

### Focus Management

- `focus-visible` only—no focus rings on mouse clicks
- Logical tab order follows visual flow
- Focus trapped in modals
- Focus restored after modal close

### Transitions

| Type | Duration | Use |
|------|----------|-----|
| Quick | 150ms | Hovers, color changes |
| Normal | 200ms | Most interactions |
| Reveal | 300ms | Panel opens, accordions |

All use `ease-in-out` for natural motion.

---

## Accessibility Commitments

These are requirements, not suggestions.

### Contrast (WCAG 2.1 AA)

| Element | Minimum Ratio |
|---------|---------------|
| Normal text | 4.5:1 |
| Large text (18px+) | 3:1 |
| UI components | 3:1 |
| Focus indicators | 3:1 |

Token comments document actual ratios. Dark mode tokens are tuned separately.

### Touch Targets

- Minimum 44×44px on mobile
- Adequate spacing between adjacent targets
- Larger targets for frequently-used actions

### Screen Readers

- Semantic HTML (proper headings, landmarks, lists)
- ARIA labels on all icon-only buttons
- Logical reading order matches visual order
- Live regions for dynamic content

### Motion Sensitivity

- Respect `prefers-reduced-motion`
- No content conveyed only through animation
- Pause/stop controls for any looping motion
- Tokens handle reduced motion automatically

---

## Theme Compatibility

### The Parity Principle

Every component must work correctly across:
- 4 built-in themes (Geetanjali, Sutra, Serenity, Forest)
- 2 modes each (light and dark)
- = **8 combinations to test**

### Token-First Development

Components use semantic tokens exclusively. No hardcoded colors.

```tsx
// ✅ Correct
className="bg-[var(--surface-warm)] text-[var(--text-primary)]"

// ❌ Wrong - hardcoded values
className="bg-amber-50 text-gray-900"

// ❌ Wrong - dark: prefixes bypass token system
className="bg-amber-50 dark:bg-gray-800"
```

### The No-Prefix Rule

**Never use `dark:` prefixes for colors.**

The token system handles dark mode automatically. When `.dark` class is on `<html>`, all CSS variables resolve to their dark values. Adding `dark:` prefixes:
1. Duplicates logic (dark handling in CSS *and* component)
2. Breaks theme overrides (themes can't control component-level classes)
3. Creates maintenance burden (two places to update)

**For implementation details**: See [Theming Documentation](./theming.md)

---

## Creating New Components

### Pre-Development Questions

Before writing code, answer:

1. **What content does this serve?**
   Scripture > translation > metadata > UI. Know your place in the hierarchy.

2. **Is this an action or navigation?**
   Actions use contextual (amber) styling. Navigation uses primary (orange).

3. **What's the ONE most important thing?**
   If you can't identify it, the component is too complex.

4. **Does it need to work on mobile?**
   Always yes. Start there.

### Implementation Checklist

Before marking complete:

- [ ] Uses semantic tokens (`--surface-*`, `--text-*`, `--border-*`)
- [ ] No `dark:` prefixes for colors
- [ ] Focus states use `--focus-ring` tokens
- [ ] Touch targets are 44×44px minimum on mobile
- [ ] Text contrast meets WCAG AA (4.5:1)
- [ ] Tested in all 8 theme/mode combinations
- [ ] Skeleton loader matches final layout
- [ ] Transitions use token-based motion values
- [ ] Works without JavaScript (progressive enhancement)

### Review Criteria

A component is ready when:

1. It looks intentional in every theme (not just "works")
2. Keyboard navigation is logical
3. Screen reader announces it sensibly
4. It follows the content hierarchy
5. It doesn't compete with scripture for attention

---

## Implementation Notes

### Font Loading

Google Fonts with `font-display: swap` to prevent FOIT:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="...Spectral|Source+Sans+3|Noto+Serif+Devanagari" rel="stylesheet">
```

### Tailwind Configuration

Font utilities reference CSS variables for theme flexibility:

```js
fontFamily: {
  heading: ['var(--font-family-display)', 'Georgia', 'serif'],
  body: ['var(--font-family-body)', 'system-ui', 'sans-serif'],
  sanskrit: ['var(--font-family-sanskrit)', 'serif'],
}
```

### File Locations

| File | Purpose |
|------|---------|
| `src/styles/tokens/*.css` | Token definitions |
| `src/config/themes.ts` | Theme configurations |
| `src/contexts/ThemeContext.tsx` | Theme state management |
| `docs/theming.md` | Token architecture reference |
