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
/* Sacred Saffron color scales (v1.22.0) */
--color-primary-500: #C65D1A;  /* Sacred Saffron */
--color-primary-600: #A94E12;
--color-warm-50: #FFFDF5;      /* Turmeric Gold */
--color-warm-500: #D4A017;

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
```

### Reading Mode Tokens

Reading mode uses specialized tokens for an immersive, manuscript-inspired experience.

**Surface Gradient Tokens** (v1.22.0):

```css
/* Light mode - Parchment warmth */
--reading-surface-base: #FDF8F3;
--reading-surface-mid: #FAF4EC;
--reading-surface-end: #F7EFE5;
--reading-surface-highlight: #FFF8E8;

/* Dark mode - Warm charcoal (diya-lit) */
.dark {
  --reading-surface-base: #1A1614;
  --reading-surface-mid: #151210;
  --reading-surface-end: #0F0D0C;
  --reading-surface-highlight: #252220;
}
```

**CSS Classes** (applied at component level):

| Class | Purpose |
|-------|---------|
| `.reading-container` | Parchment gradient background with vignette overlay |
| `.reading-sanskrit` | Enhanced Sanskrit text with dark mode golden glow |
| `.reading-pada` | Verse quarter-line separation |
| `.verse-ornament` | Decorative verse number badge |
| `.reading-separator` | Traditional danda (॥) separator between sections |

**Example Usage**:

```tsx
<div className="reading-container">
  <div className="reading-sanskrit">
    {sanskritLines.map(line => (
      <p className="reading-pada">{line}</p>
    ))}
  </div>
  <span className="verse-ornament">॥ 2.47 ॥</span>
  <div className="reading-separator">
    <span className="reading-separator-line" />
    <span className="reading-separator-symbol">॥</span>
    <span className="reading-separator-line" />
  </div>
</div>
```

**Design Principles**:
- Light mode feels like reading aged parchment
- Dark mode feels like reading by lamplight (दिया)
- Sanskrit text is the visual hero with generous line-height (2.2×)
- Minimal chrome — the verse is the experience

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
/* v1.22.0: Defaults use Sacred Saffron / Turmeric Gold */
--logo-bg-start: var(--interactive-primary);  /* Sacred Saffron gradient */
--logo-bg-end: var(--color-primary-500);
--logo-petal-outer: var(--color-warm-100);    /* Turmeric Gold petals */
--logo-petal-inner: var(--color-warm-200);
--logo-sun-glow: var(--color-warm-300);
--logo-sun-core: #991B1B;                     /* Deep red center */
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

## Browser Support

The theming system uses modern CSS features:

| Feature | Minimum Version |
|---------|-----------------|
| CSS Custom Properties | All modern browsers (not IE11) |
| `color-mix()` function | Chrome 111+, Safari 16.2+, Firefox 113+ |
| CSS `oklch()` colors | Chrome 111+, Safari 15.4+, Firefox 113+ |

For older browser support, consider polyfills or fallback values. The application gracefully degrades on unsupported browsers but may lose theme customization features.

## Migration Status

As of v1.22.0:

- ✅ **Colors**: 100% tokenized (Sacred Saffron palette)
- ✅ **Border Radius**: 100% tokenized (0 hardcoded)
- ✅ **Shadows**: 100% tokenized (0 hardcoded)
- ✅ **Motion**: Transitions tokenized
- ✅ **Reading Mode**: Specialized tokens and CSS classes
- ✅ **Theme Consistency**: All 4 themes with 950 shades
- ⚪ **Typography**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Spacing**: Tokens defined, using Tailwind responsive syntax
- ⚪ **Layout**: Tokens defined, structural constants

## Theming Outliers

Some components can't use CSS variables directly due to technical constraints. Here's how to handle them:

### Canvas/Image Generation

Components that render to Canvas API (like `ImageCardGenerator.ts`) can't use CSS variables because Canvas requires hex color strings.

**Solution**: Use `canvasThemeColors.ts` to bridge CSS variables to hex values:

```typescript
import { getCanvasThemeColors } from "../lib/canvasThemeColors";

// Get current theme colors as hex
const colors = getCanvasThemeColors();
ctx.fillStyle = colors.sanskrit;  // Returns hex like "#4A1F06"
```

The bridge function reads computed CSS variable values and converts them to hex. It includes Sacred Saffron fallbacks for edge cases.

### Color Preview Swatches

Components that display theme colors as previews (like `ThemeSelector.tsx`) need inline styles:

```typescript
// Read from theme config, not CSS variables
const colors = getThemePreviewColors(theme);
<div style={{ backgroundColor: colors.primary }} />
```

### Animation Colors

Custom animations in `index.css` use RGB color values for `rgb()` syntax compatibility:

```css
/* Sacred Saffron / Turmeric Gold animation colors */
--color-amber-400: 230 184 48;    /* #E6B830 - shimmer */
--color-orange-400: 224 123 60;   /* #E07B3C - glow */
```

### Status Indicators

Status components use semantic tokens that work across all themes:

```css
/* Use these for success/warning/error states */
--status-success-bg, --status-success-text, --status-success-border
--status-warning-bg, --status-warning-text, --status-warning-border
--status-error-bg, --status-error-text, --status-error-border
```

### Guidelines for New Outliers

When adding components with theming constraints:

1. **Prefer CSS variables** wherever technically possible
2. **Document the constraint** in the component file
3. **Use Sacred Saffron values** for any hardcoded fallbacks
4. **Add to this section** if it's a new pattern
