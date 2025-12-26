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
--interactive-primary: var(--color-orange-600);

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

## Logo Theming

The logo supports two usage modes:

### 1. Static SVG (Transparent Background)

```html
<img src="/logo.svg" alt="Geetanjali" />
```

The logo has a transparent background and adapts to any surface color.

### 2. Themeable React Component

```tsx
import { LogoIcon } from "../components/icons";

// Uses CSS variables for full theme control
<LogoIcon size={64} themed={true} />
```

Logo CSS variables (can be overridden per theme):

```css
--logo-petal-outer: #FFF8E7;  /* Outer lotus petals */
--logo-petal-inner: #FFEDD5;  /* Inner lotus petals */
--logo-sun-glow: #FCD34D;     /* Sun outer glow */
--logo-sun-core: #991B1B;     /* Sun center core */
```

## Available Themes

| Theme | ID | Description |
|-------|-----|-------------|
| **Geetanjali** | `default` | Warm amber inspired by ancient manuscripts |
| **Serenity** | `serenity` | Twilight temple, rose/mauve tones |
| **Forest** | `forest` | Sacred grove, emerald/sage tones |
| **High Contrast** | `high-contrast` | Maximum readability |

Each theme provides both light and dark mode variants.

## Adding a New Theme

1. **Define theme colors** in `src/config/themes.ts`:

```typescript
export const myTheme: ThemeConfig = {
  id: "my-theme",
  name: "My Theme",
  colors: {
    primary: "#...",
    warm: "#...",
    // ...
  }
};
```

2. **Add CSS overrides** in `derived.css`:

```css
[data-theme="my-theme"] {
  --interactive-primary: #...;
  --surface-warm: #...;
  /* Override only what differs from default */
}

[data-theme="my-theme"].dark {
  --text-primary: #...;
  /* Dark mode overrides */
}
```

3. **Register the theme** in the theme selector.

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
