---
layout: default
title: Accessibility QA
description: Manual testing procedures for accessibility validation alongside automated tests.
---

# Accessibility QA

Manual testing procedures for screen readers, keyboard navigation, and WCAG compliance. Use alongside automated axe-core tests in CI.

---

## Overview

| Test | Tool | Frequency | Automated |
|------|------|-----------|-----------|
| axe-core violations | CI | Every PR | Yes |
| VoiceOver | macOS/iOS | Each release | No |
| NVDA | Windows | Each release | No |
| Keyboard-only | Any | Each release | No |

---

## Automated Testing

CI runs `vitest-axe` tests on critical components:

- Modal
- MobileDrawer
- UserMenu
- ChapterSelector
- ShareModal
- SyncStatusIndicator

**Run locally:**

```bash
npm test -- --run "a11y"
```

**Known limitations:**

- ChapterSelector uses `role="grid"` with button children (keyboard nav works, semantic structure deferred)

---

## VoiceOver (macOS)

### Setup

| Action | Keys |
|--------|------|
| Enable VoiceOver | ⌘ + F5 |
| VoiceOver modifier (VO) | Ctrl + Option |
| Navigate | VO + Arrow keys |
| Activate | VO + Space |
| Web rotor | VO + U |

### Checklist

**Navigation**

- Tab through navbar links — each announced with name
- Mobile menu button announces "Menu" or similar
- Menu items announce link text

**Modals & Drawers**

- Open modal: focus moves INTO modal
- Tab in modal: focus stays trapped
- Escape: modal closes
- After close: focus returns to trigger element
- Modal announced as "dialog"

**Chapter Selector**

- Opens as dialog
- Current chapter announced with "current"
- Arrow keys navigate grid
- Enter selects chapter

**Audio Player**

- Play/pause button state announced
- Progress slider accessible
- Speed control announced

**Sync Status**

- Status changes announced via `role="status"`
- States clear: "Syncing", "Synced", "Offline"

---

## NVDA (Windows)

### Setup

| Action | Keys |
|--------|------|
| Download | [nvaccess.org](https://nvaccess.org) |
| Enable | Ctrl + Alt + N |
| Toggle browse/focus mode | NVDA + Space |
| Navigate | Tab, arrows |
| Element list | NVDA + F7 |

### Checklist

Same as VoiceOver above. Key differences:

- NVDA uses "browse mode" vs "focus mode"
- Toggle with NVDA + Space when forms don't respond
- Check both modes for each interactive element

---

## Keyboard-Only Testing

Test without mouse — Tab, Enter, Space, Arrow keys, Escape only.

### Global Requirements

- All interactive elements reachable via Tab
- Tab order matches visual order (top-to-bottom, left-to-right)
- Focus indicator visible on all elements
- No keyboard traps (except intentional modal traps)

### Component Shortcuts

| Component | Keys | Expected |
|-----------|------|----------|
| Navbar links | Tab | Focus each link in order |
| Mobile menu | Enter/Space | Opens drawer |
| Modal | Escape | Closes modal |
| Modal | Tab | Cycles within modal |
| Chapter grid | Arrows | Navigate 6-column grid |
| Audio player | Space | Play/pause toggle |
| Dropdown menus | Arrow Down/Up | Navigate items |
| Dropdown menus | Escape | Close menu |

### Focus Indicators

Verify visible focus rings on:

- Buttons (primary, secondary, ghost)
- Links
- Form inputs
- Chapter buttons
- Audio controls
- Modal close button

---

## User Journey Tests

### Guest Visit

1. Land on home page
2. Tab to "Seek Guidance" CTA
3. Navigate to Verses page
4. Filter/search verses
5. Open verse detail
6. Play audio
7. Share verse

### Reading Mode

1. Open reading mode
2. Navigate between verses (prev/next)
3. Open chapter selector
4. Select different chapter
5. Use audio controls
6. Open Dhyanam

### Account Flow

1. Open user menu
2. Navigate menu items
3. Go to Settings
4. Change preferences
5. Log out

---

## Common Issues

| Issue | Check | Fix |
|-------|-------|-----|
| Missing focus ring | Inspect `:focus-visible` | Add `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]` |
| Icon button no label | Check `aria-label` | Add `aria-label="Action name"` |
| Modal focus escape | Tab rapidly | Implement `useFocusTrap` |
| Status not announced | Check `role` | Add `role="status"` or `aria-live` |
| Contrast too low | Run axe-core | Adjust token colors |

---

## Release Checklist

Before each release:

- All axe-core CI tests pass
- VoiceOver tested on at least one critical path
- Keyboard-only navigation works for main flows
- No new WCAG 2.1 AA violations

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [VoiceOver User Guide](https://support.apple.com/guide/voiceover/welcome/mac)
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
