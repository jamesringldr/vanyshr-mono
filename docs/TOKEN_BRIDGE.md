# Token Bridge Part A: Library Theme Wiring

**Status:** Complete  
**Date:** 2026-09-17  
**Scope:** Konsta 5.4.0 + shadcn/Radix theme vars wired to Vanyshr design tokens  
**Contract:** DESIGN.md §12.4

## Overview

All library theme variables (`--k-*` for Konsta, Tailwind `@theme` for shadcn) are derived from the 93 core Vanyshr design tokens in `packages/ui/src/styles/tokens.css` via `var()` references only. No literal rgb/hex values in bridge assignments (§10a violation).

## Token-by-Token Mapping

### Spacing / Sizing

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--space-1` | `--spacing` | `4px` | Base unit for calculations |
| `--size-label` | `--text-xs` | `11px` | Label/small text |
| `--size-caption` | `--text-sm` | `12px` | Caption/hint text |
| `--size-body` | `--text-md` | `14px` | Body/running text |
| `--size-heading` | `--text-lg` | `15px` | Section heading |
| `--size-title` | `--text-xl` | `22px` | Panel/card title |
| `--size-display` | `--text-display-*` | `30px` | Display/hero title |

### Typography

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--font-ui` | `--font-body` | System UI stack | UI text, body copy |
| `--font-display` | `--font-display` | System display stack | Display/title roles |
| `--font-mono` | `--font-mono` | System monospace stack | Data, codes, timestamps |

### Depth (radius, shadow)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--radius-sm` | `--radius-sm`, `--radius-md` | `8px` | Input fields, buttons |
| `--radius-md` | `--radius-md` | `12px` | Cards, sheets |
| `--radius-lg` | `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-3xl` | `18px` | Large containers |
| `--radius-pill` | `--radius-full` | `999px` | Pills, avatars, toggles |
| `--shadow-1` | `--shadow-xs`, `--shadow-sm` | Soft 1px elevation | Raised controls, cards at rest |
| `--shadow-2` | `--shadow-md`, `--shadow-lg` | Soft 4px elevation | Popovers, menus, hover |
| `--shadow-3` | `--shadow-xl`, `--shadow-2xl`, `--shadow-3xl` | Soft 10px elevation | Dialogs, sheets, overlays |

### Color: Primary (hero cyan)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-primary` | `--color-primary`, `--k-color-primary`, `--k-color-md-primary` | `#14abfe` (dark) | Primary action, active state |
| `--color-primary-hover` | `--color-primary-hover`, `--k-color-md-primary-hover` | `#3bb8fe` (dark) | Hover state on primary |
| `--color-primary-active` | `--color-primary-active` | `#0b8fd9` (dark) | Pressed/active state |
| `--color-primary-muted` | `--color-primary-muted`, `--k-color-md-primary-container` | `#14abfe33` (dark) | Soft primary background |
| `--color-primary-on` | `--color-primary-on`, `--k-color-md-on-primary` | `#0b0d10` | Ink on cyan fills |
| `--color-primary-text` | `--color-primary-text`, `--k-color-md-on-primary-container` | `#14abfe` (dark) | Cyan text on dark UI |

### Color: Secondary

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-secondary` | `--color-secondary`, `--k-color-secondary`, `--k-color-md-secondary` | `#0b8fd9` (dark) | Secondary action, badge |
| `--color-secondary-on` | `--color-secondary-on` | `#f5f5f5` | Text/icons on secondary fill |

### Color: Accent (signal orange)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-accent` | `--color-accent`, `--k-color-accent`, `--k-color-md-tertiary` | `#ff6924` | High-interest callout, CTA |
| `--color-accent-hover` | `--color-accent-hover` | `#ff7f45` (dark) | Hover on accent |
| `--color-accent-active` | `--color-accent-active` | `#e55a18` (dark) | Pressed on accent |
| `--color-accent-muted` | `--color-accent-muted`, `--k-color-md-tertiary-container` | `#ff692433` | Soft accent background |
| `--color-accent-on` | `--color-accent-on`, `--k-color-md-on-tertiary` | `#0b0d10` | Ink on orange fills |
| `--color-accent-text` | `--color-accent-text` | `#ff6924` (dark) | Orange text on dark UI |

### Color: Surfaces

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-bg-app` | `--color-bg-app`, `--color-bg-primary`, `--k-color-bg-primary`, `--k-color-md-background` | `#1a1a1a` | Screen canvas, page bg |
| `--color-bg-surface` | `--color-bg-surface`, `--color-bg-secondary`, `--k-color-bg-secondary`, `--k-color-md-surface` | `#2a2a2a` | Cards, sheets, list rows |
| `--color-bg-elevated` | `--color-bg-elevated`, `--color-bg-surface-secondary`, `--k-color-bg-tertiary` | `#3a3a3a` | Tooltips, dropdowns, floating |
| `--color-bg-overlay` | `--color-bg-overlay` | `#000000a6` | Semi-opaque overlay, modal backdrop |
| `--color-bg-inverse` | `--color-bg-inverse`, `--color-white` | `#fafafa` | Light mode surface when dark mode bg |

### Color: Text

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-text-primary` | `--color-text-primary`, `--k-color-text-primary`, `--k-color-md-on-background` | `#f5f5f5` (dark) | Headings, body, primary icons |
| `--color-text-secondary` | `--color-text-secondary`, `--k-color-text-secondary` | `#9aa3ad` (dark) | Captions, placeholders, secondary icons |
| `--color-text-tertiary` | `--color-text-tertiary`, `--k-color-text-tertiary` | `#6b7280` (dark) | De-emphasized metadata |
| `--color-text-disabled` | `--color-text-disabled` | `#5c5c5c` | Disabled text/controls |
| `--color-text-inverse` | `--color-text-inverse`, `--color-black` | `#070f1c` | Navy ink (light mode) |

### Color: Borders

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-border` | `--color-border`, `--k-color-border`, `--color-border-primary`, `--k-color-md-outline` | `#4a4a4a` | Default dividers, outlines |
| `--color-border-subtle` | `--color-border-subtle`, `--k-color-border-subtle`, `--color-border-secondary`, `--k-color-md-outline-variant` | `#4a4a4a80` | Hairlines inside cards |
| `--color-border-strong` | `--color-border-strong`, `--color-border-tertiary` | `#6b6b6b` | Emphasized outlines |
| `--color-border-focus` | `--color-border-focus`, `--color-focus-ring` | `#14abfe` | Focus ring outline |
| `--color-ring-focus` | — | `#14abfe66` | Focus ring glow/shadow |

### Color: State & Interaction

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-state-hover` | `--color-state-hover` | `#ffffff0f` | Hover wash (translucent white) |
| `--color-state-active` | `--color-state-active` | `#ffffff14` | Pressed/active wash |
| `--color-state-selected` | `--color-state-selected` | `#14abfe22` | Selected row/item wash |
| `--color-state-disabled-bg` | `--color-state-disabled-bg`, `--color-disabled` | `#2a2a2a` | Disabled element background |
| `--color-state-disabled-fg` | `--color-state-disabled-fg`, `--color-border-disabled` | `#5c5c5c` | Disabled text/border |

### Color: Status/Semantic

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-status-success` | `--color-status-success`, `--color-success`, `--k-color-md-surface-success` | `#3d9b6e` | Success fills, bold text |
| `--color-status-success-muted` | `--color-status-success-muted` | `#3d9b6e33` | Soft success badge/banner |
| `--color-status-success-on` | `--color-status-success-on` | `#0b0d10` | Text/icons on success fill |
| `--color-status-warn` | `--color-status-warn`, `--color-warning`, `--color-accent-risk` | `#d97706` | Warning fills, bold text |
| `--color-status-warn-muted` | `--color-status-warn-muted` | `#d9770633` | Soft warning badge/banner |
| `--color-status-warn-on` | `--color-status-warn-on` | `#0b0d10` | Text/icons on warning fill |
| `--color-status-danger` | `--color-status-danger`, `--color-error`, `--k-color-md-error` | `#e5484d` | Error fills, bold text |
| `--color-status-danger-muted` | `--color-status-danger-muted`, `--k-color-md-error-container` | `#e5484d33` | Soft error badge/banner |
| `--color-status-danger-on` | `--color-status-danger-on`, `--k-color-md-on-error` | `#f5f5f5` | Text/icons on error fill |
| `--color-status-info` | `--color-status-info` | `#14abfe` | Info fills, bold text (cyan) |
| `--color-status-info-muted` | `--color-status-info-muted` | `#14abfe33` | Soft info badge/banner |
| `--color-status-info-on` | `--color-status-info-on` | `#0b0d10` | Text/icons on info fill |

### Color: Brand (raw palette)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-brand-cyan` | `--color-brand-cyan`, `--color-brand-primary1` | `#14abfe` | Hero cyan (also primary) |
| `--color-brand-orange` | `--color-brand-orange`, `--color-brand-primary2` | `#ff6924` | Signal orange (also accent) |
| `--color-brand-navy` | `--color-brand-navy`, `--color-brand-primary3`, `--color-brand-dark`, `--color-brand-ink`, `--color-navy-hero` | `#070f1c` | Ink navy |
| `--color-brand-cyan-on-light` | — | `#0077cc` | Cyan text on light mode (DESIGN.md implicit) |
| `--color-brand-orange-on-light` | — | `#b84300` | Orange text on light mode (DESIGN.md implicit) |

### Motion (optional for CSS-in-JS)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--duration-instant` | `--duration-instant` | `50ms` | Press feedback, focus ring |
| `--duration-fast` | `--duration-fast` | `120ms` | Color, chip state, hover |
| `--duration-base` | `--duration-base` | `200ms` | Panel open, tabs, menus |
| `--duration-slow` | `--duration-slow` | `320ms` | Dialogs, sheets |
| `--duration-slower` | `--duration-slower` | `500ms` | Page-level reveal |
| `--ease-linear` | `--ease-linear` | `linear` | Progress, spinners |
| `--ease-standard` | `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default state changes |
| `--ease-emphasized` | `--ease-emphasized` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Overshoot for lifts |
| `--ease-accelerate` | `--ease-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | Elements leaving |
| `--ease-decelerate` | `--ease-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | Elements entering |

## Light Mode Toggle

Both dark and light modes are controlled by the `.light` class on the root element:

```css
:root {
  /* Dark mode (default) — Vanyshr tokens as defined */
  --color-primary: #14abfe;
  --color-text-primary: #f5f5f5;
  --color-bg-app: #1a1a1a;
  /* ... */
}

.light {
  /* Light mode — Vanyshr tokens override to light values */
  --color-primary: #14abfe;
  --color-text-primary: #070f1c;
  --color-bg-app: #fafafa;
  /* ... */
}
```

**No other dark-mode mechanism is used:**
- ❌ Tailwind `dark:` variant
- ❌ `prefers-color-scheme` media query
- ❌ Library-specific `dark` prop
- ✅ `.light` class toggle on `:root`

## Bridge Assignments: No Literal Values

All theme.css `@theme` assignments reference Vanyshr tokens via `var()`. Grep verification:

```bash
# Should return 0 matches (no rgb, hex, or named colors in bridge)
grep -E '(rgb|#[0-9a-f]|hsl|red|blue|green)' packages/ui/src/styles/theme.css | grep -v 'var('
```

## Verification Steps

1. **No undefined references:** `var()` audit passes (all `--color-*`, `--size-*`, `--space-*`, etc. exist in tokens.css)
2. **Type safety:** `pnpm type-check` passes on all 8 packages (apps/app, packages/ui, packages/services, packages/shared, etc.)
3. **No literal values in bridge:** Theme.css bridge assignments are pure `var()` references
4. **Light/dark toggle works:** `.light` class switches the full app without `dark:` variants or `prefers-color-scheme`

## Files Changed

- `packages/ui/src/styles/tokens.css` — Moved bridge aliases to `:root` (available in both modes)
- `packages/ui/src/styles/theme.css` — Refactored to use var() refs only, added Konsta --k-* vars
- `docs/TOKEN_BRIDGE.md` — This document (token-by-token mapping)

## References

- **Design Bible:** DESIGN.md §12 (Component library stack) & §12.4 (Token bridge contract)
- **Token Source:** docs/tokens.json (93 core + 67 bridge aliases, locked 2026-09-17)
- **Konsta:** konsta 5.4.0, Material Design 3 color pattern
- **Shadcn:** Radix + Tailwind v4 @theme (no separate dark mode mechanism)
