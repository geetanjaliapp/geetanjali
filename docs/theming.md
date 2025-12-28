---
layout: default
title: Theming
description: CSS token architecture and theme customization in Geetanjali.
---

# Theming

This document covers the technical implementation of Geetanjali's theming system. For design principles and component patterns, see [Design Language](./design.md).

Geetanjali uses a four-layer token architecture: three CSS custom property layers plus TypeScript theme configs. This enables 4 built-in themes, automatic dark mode support, and consistent styling across the application.

## Token Architecture

```
primitives.css  →  Raw values (colors, spacing scale, font sizes)
        ↓
semantic.css    →  Meaningful names (--text-primary, --radius-card)
        ↓
derived.css     →  State tokens (hover, focus, disabled) + .dark overrides
        ↓
themes.ts       →  Theme configs (injected as CSS at runtime)
```

### Layer 1: Primitives

Raw design values with no semantic meaning. Never used directly in components.

```css
/* Color scales */
--color-orange-600: #ea580c;
--color-amber-50: #fffbeb;

/* Spacing scale */
--spacing-4: 1rem;
--spacing-8: 2rem;

/* Font sizes */
--font-size-sm: 0.875rem;
--font-size-base: 1rem;
```

### Layer 2: Semantic Tokens

Meaningful names that map to primitives. Used throughout components.

```css
/* Colors */
--text-primary: var(--color-neutral-900);
--surface-warm: var(--color-amber-50);
--interactive-primary: var(--color-primary-600);

/* Gradient buttons (hero CTAs) */
--interactive-gradient-from: var(--color-primary-500);
--interactive-gradient-to: var(--color-red-500);

/* Shapes */
--radius-button: var(--radius-lg);      /* 8px */
--radius-card: var(--radius-xl);        /* 12px */
--shadow-card: var(--shadow-md);

/* Motion */
--transition-color: color var(--duration-150) var(--ease-in-out);
```

### Layer 3: Derived Tokens

State-specific tokens for interactive elements and dark mode base overrides.

```css
/* derived.css - State tokens */
--interactive-primary-hover: var(--color-primary-700);
--interactive-primary-active: var(--color-primary-800);
--interactive-primary-disabled-bg: var(--color-neutral-200);

/* Dark mode overrides */
.dark {
  --text-primary: var(--color-neutral-100);
  --surface-warm: var(--color-neutral-800);
}
```

### Layer 4: Theme Configs

Built-in themes are defined in TypeScript and injected as CSS at runtime. This allows themes to override any primitive or semantic token.

```typescript
// themes.ts - Theme overrides semantic tokens
{
  colors: {
    primary: { 600: "#7c3aed" },  // Serenity uses violet
    warm: { 50: "#faf5ff" },
  }
}
```

## Token Categories

### Fully Tokenized (Theme-Dependent)

| Category | Tokens | Usage |
|----------|--------|-------|
| **Colors** | 337 | All surfaces, text, borders, status indicators |
| **Border Radius** | 13 | `--radius-button`, `--radius-card`, `--radius-modal` |
| **Shadows** | 25 | `--shadow-card`, `--shadow-modal`, `--shadow-button` |
| **Motion** | 15 | `--transition-color`, `--transition-all` |

### Intentionally Not Migrated (Layout Constants)

| Category | Reason |
|----------|--------|
| **Typography sizes** | Tailwind's responsive syntax (`sm:text-lg`) is more valuable |
| **Spacing gaps** | Layout constants don't change between themes |
| **Max-widths** | Structural page containers |

## Using Tokens in Components

Tokens are accessed via Tailwind's arbitrary value syntax. For component patterns and copy-pasteable examples, see [Design Language Quick Reference](./design.md#quick-reference).

### Syntax

```tsx
// Semantic tokens (colors, radius, shadows)
className="bg-[var(--surface-warm)] rounded-[var(--radius-card)]"

// Tailwind utilities (typography, spacing) - responsive
className="text-sm sm:text-base gap-2 sm:gap-4"
```

### Key Rules

1. **Use semantic tokens** (`--surface-*`, `--text-*`) not primitives (`--color-amber-50`)
2. **No `dark:` prefixes** for colors — the token system handles dark mode
3. **Typography and spacing** use Tailwind responsive syntax, not tokens

### Component Token Naming

```css
/* Component-specific tokens follow pattern: --{component}-{property} */
--radius-button: var(--radius-lg);
--radius-card: var(--radius-xl);
--radius-modal: var(--radius-2xl);
--radius-input: var(--radius-lg);
--radius-badge: var(--radius-full);

--shadow-button: var(--shadow-sm);
--shadow-card: var(--shadow-md);
--shadow-modal: var(--shadow-xl);
```

### Domain-Specific Tokens

```css
/* Sanskrit text */
--text-sanskrit-primary: var(--color-warm-900);
--text-sanskrit-muted: var(--color-warm-700);

/* Badges and chips */
--badge-warm-bg: var(--color-warm-100);
--chip-selected-bg: var(--color-warm-200);  /* More prominent than badge */

/* Reading mode */
--surface-reading: var(--color-reading-50);
--text-reading-primary: var(--color-neutral-800);
```

## Logo Theming

The logo features an orange gradient background circle that provides contrast against warm surface colors (amber-50, cream). The lotus petals and sun elements sit on top of this background.

The logo supports two usage modes:

### 1. Static SVG

```html
<img src="/logo.svg" alt="Geetanjali" />
```

The static SVG uses fixed orange gradient background (#ea580c → #f97316) with cream petals.

### 2. Themeable React Component

```tsx
import { LogoIcon } from "../components/icons";

// Uses CSS variables for full theme control
<LogoIcon size={64} themed={true} />
```

Logo CSS variables (can be overridden per theme):

```css
--logo-bg-start: #ea580c;     /* Background gradient start */
--logo-bg-end: #f97316;       /* Background gradient end */
--logo-petal-outer: #FFF8E7;  /* Outer lotus petals */
--logo-petal-inner: #FFEDD5;  /* Inner lotus petals */
--logo-sun-glow: #FCD34D;     /* Sun outer glow */
--logo-sun-core: #991B1B;     /* Sun center core */
```

## Available Themes

| Theme | ID | Personality | Typography |
|-------|-----|-------------|------------|
| **Geetanjali** | `default` | Temple lamp glow, ancient manuscript warmth | Mixed |
| **Sutra** | `sutra` | Ink on paper, scholarly clarity | Serif |
| **Serenity** | `serenity` | Twilight violet, contemplative calm | Mixed |
| **Forest** | `forest` | Sacred grove, morning dew freshness | Sans |

Each theme provides light and dark mode variants with theme-specific contrast overrides for proper dark mode personality.

### Dark Mode Implementation

Dark mode is activated by adding `.dark` class to `<html>`. The token system automatically resolves to dark values—no `dark:` prefixes needed in components.

**Technical approach**:
- Base dark overrides live in `semantic.css` (`.dark {}` selector)
- Theme-specific dark adjustments use `modeColors.dark.contrast` in themes.ts
- `color-mix(in srgb, ...)` blends theme warmth into neutral surfaces

For dark mode design principles, see [Design Language: Theme Parity](./design.md#the-four-pillars).

## Adding a New Theme

Themes are defined entirely in TypeScript. No CSS changes needed.

1. **Define theme in `src/config/themes.ts`**:

```typescript
export const myTheme: ThemeConfig = {
  id: "my-theme",
  name: "My Theme",
  description: "Theme personality description",
  defaultFontFamily: "serif", // or "sans", "mixed"
  colors: {
    primary: { 500: "#...", 600: "#...", 700: "#..." },
    warm: { 50: "#...", 100: "#..." },
  },
  modeColors: {
    dark: {
      contrast: {
        textPrimary: "#...",      // Semantic overrides for dark mode
        surfacePage: "#...",
        badgeWarmBg: "#...",
      }
    }
  }
};
```

2. **Add to `THEMES` array** in the same file.

The `modeColors.dark.contrast` object allows semantic-level overrides when color scale mappings don't produce readable results in dark mode.

## File Locations

| File | Purpose |
|------|---------|
| `src/styles/tokens/primitives.css` | Raw design values |
| `src/styles/tokens/semantic.css` | Meaningful token names |
| `src/styles/tokens/derived.css` | Theme overrides |
| `src/config/themes.ts` | Theme definitions |
| `src/contexts/ThemeContext.tsx` | Theme state management |
| `public/logo.svg` | Transparent logo (static) |
| `src/components/icons.tsx` | LogoIcon (themeable) |

## Migration Status

As of v1.16.0:

- ✅ **Colors**: 100% tokenized
- ✅ **Border Radius**: 100% tokenized (0 hardcoded)
- ✅ **Shadows**: 100% tokenized (0 hardcoded)
- ✅ **Motion**: Transitions tokenized
- ⚪ **Typography**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Spacing**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Layout**: Tokens defined, structural constants
