---
layout: default
title: Theming
description: CSS token architecture and theme customization in Geetanjali.
---

# Theming

Geetanjali uses a three-tier CSS custom property (token) architecture for complete theme customization. This enables multiple color themes, dark mode support, and consistent styling across the application.

## Token Architecture

```
primitives.css  →  Raw values (colors, spacing scale, font sizes)
        ↓
semantic.css    →  Meaningful names (--text-primary, --radius-card)
        ↓
derived.css     →  Theme overrides (.dark, [data-theme="serenity"])
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

### Layer 3: Theme Overrides

Theme-specific overrides that remap semantic tokens.

```css
.dark {
  --text-primary: var(--color-neutral-100);
  --surface-warm: var(--color-neutral-800);
}

[data-theme="serenity"] {
  --interactive-primary: var(--color-rose-600);
  --surface-warm: var(--color-stone-50);
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

### Tailwind Arbitrary Value Syntax

```tsx
// Colors - always use semantic tokens
className="text-[var(--text-primary)] bg-[var(--surface-warm)]"

// Border radius - use semantic tokens
className="rounded-[var(--radius-card)]"

// Shadows - use semantic tokens
className="shadow-[var(--shadow-card)]"

// Transitions - use semantic tokens
className="transition-[var(--transition-color)]"

// Typography - use Tailwind (responsive)
className="text-sm sm:text-base lg:text-lg"

// Spacing - use Tailwind (responsive)
className="gap-2 sm:gap-4"
```

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

Each theme provides light and dark mode variants with theme-specific contrast overrides for proper dark mode personality (e.g., Geetanjali dark uses amber-tinted neutrals, not pure grays).

### Dark Mode Design

Dark mode follows a "quiet library" aesthetic:
- **Soft text**: `neutral-200` for primary text, not harsh white
- **Themed backgrounds**: Each theme tints its dark surfaces (amber for Geetanjali, purple for Serenity)
- **Color-mix**: `color-mix(in srgb, ...)` blends theme warmth into neutral surfaces

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

As of v1.18.0:

- ✅ **Colors**: 100% tokenized
- ✅ **Border Radius**: 100% tokenized (0 hardcoded)
- ✅ **Shadows**: 100% tokenized (0 hardcoded)
- ✅ **Motion**: Transitions tokenized
- ⚪ **Typography**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Spacing**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Layout**: Tokens defined, structural constants
