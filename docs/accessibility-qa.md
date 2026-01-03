# Accessibility QA Checklist

This document provides manual testing procedures for accessibility validation. Use alongside automated axe-core tests in CI.

---

## Quick Reference

| Test | Tool | Frequency | Automated |
|------|------|-----------|-----------|
| axe-core violations | CI | Every PR | Yes |
| VoiceOver | macOS/iOS | Each release | No |
| NVDA | Windows | Each release | No |
| Keyboard-only | Any | Each release | No |

---

## Automated Testing (CI)

Our CI runs `vitest-axe` tests on critical components:

- Modal
- MobileDrawer
- UserMenu
- ChapterSelector
- ShareModal
- SyncStatusIndicator

**Run locally:**
```bash
npm run test:run -- "a11y"
```

**Known Limitations:**
- ChapterSelector uses `role="grid"` with button children (keyboard nav works, semantic structure deferred)

---

## VoiceOver Testing (macOS)

### Setup

1. **Enable VoiceOver**: ⌘ + F5
2. **VoiceOver keys (VO)**: Ctrl + Option
3. **Navigate**: VO + Arrow keys
4. **Activate**: VO + Space
5. **Web rotor**: VO + U

### Critical Paths Checklist

#### Navigation
- [ ] Tab through navbar links - each announced with name
- [ ] Mobile menu button announces "Menu" or similar
- [ ] Menu items announce link text

#### Modals & Drawers
- [ ] **Open modal**: Focus moves INTO modal
- [ ] **Tab in modal**: Focus stays trapped in modal
- [ ] **Escape**: Modal closes
- [ ] **After close**: Focus returns to trigger element
- [ ] Modal announced as "dialog"

#### Chapter Selector (Reading Mode)
- [ ] Opens as dialog
- [ ] Current chapter announced with "current"
- [ ] Arrow keys navigate grid
- [ ] Enter selects chapter

#### Audio Player
- [ ] Play/pause button state announced
- [ ] Volume slider accessible
- [ ] Progress can be adjusted

#### Sync Status
- [ ] Status changes announced (via `role="status"`)
- [ ] "Syncing", "Synced", "Offline" states clear

---

## NVDA Testing (Windows)

### Setup

1. **Download**: https://nvaccess.org
2. **Enable**: Ctrl + Alt + N
3. **Browse mode**: NVDA + Space (toggles)
4. **Navigate**: Tab, arrows
5. **Element list**: NVDA + F7

### Checklist

Same as VoiceOver checklist above. Key differences:

- NVDA uses "browse mode" vs "focus mode"
- Toggle with NVDA + Space when forms don't respond
- Check both modes for each interactive element

---

## Keyboard-Only Testing

### Requirements

Test without mouse - Tab, Enter, Space, Arrow keys, Escape only.

#### Global
- [ ] All interactive elements reachable via Tab
- [ ] Tab order matches visual order (top-to-bottom, left-to-right)
- [ ] Focus indicator visible on all elements
- [ ] No keyboard traps (except intentional modal traps)

#### Specific Components

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

#### Focus Indicators

Check these components have visible focus rings:
- [ ] Buttons (primary, secondary, ghost)
- [ ] Links
- [ ] Form inputs
- [ ] Chapter buttons
- [ ] Audio controls
- [ ] Modal close button

---

## Testing by User Journey

### 1. First Visit (Guest)

1. Land on home page
2. Tab to "Seek Guidance" CTA
3. Navigate to Verses page
4. Filter/search verses
5. Open verse detail
6. Play audio
7. Share verse

### 2. Reading Mode

1. Open reading mode
2. Navigate between verses (prev/next)
3. Open chapter selector
4. Select different chapter
5. Use audio controls
6. Open Dhyanam

### 3. Account Flow

1. Open user menu
2. Navigate menu items
3. Go to Settings
4. Change preferences
5. Log out

---

## Common Issues & Fixes

| Issue | Check | Fix |
|-------|-------|-----|
| Missing focus ring | Inspect `:focus-visible` | Add `focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]` |
| Icon button no label | Check `aria-label` | Add `aria-label="Action name"` |
| Modal focus escape | Tab rapidly | Implement `useFocusTrap` |
| Status not announced | Check `role` | Add `role="status"` or `aria-live` |
| Contrast too low | Run axe-core | Adjust token colors |

---

## Release Checklist

Before each release, verify:

- [ ] All axe-core CI tests pass
- [ ] VoiceOver tested on at least one critical path
- [ ] Keyboard-only navigation works for main flows
- [ ] No new WCAG 2.1 AA violations

---

## Resources

- [WCAG 2.1 Quick Reference](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://dequeuniversity.com/rules/axe/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [VoiceOver User Guide](https://support.apple.com/guide/voiceover/welcome/mac)
- [NVDA User Guide](https://www.nvaccess.org/files/nvda/documentation/userGuide.html)
