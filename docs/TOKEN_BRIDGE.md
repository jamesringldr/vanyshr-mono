# Token Bridge Part A: Library Theme Wiring

**Status:** Complete  
**Date:** 2026-09-17  
**Scope:** Konsta 5.4.0 + shadcn/Radix theme vars wired to Vanyshr design tokens  
**Contract:** DESIGN.md §12.4

## Overview

All library theme variables (`--k-*` for Konsta, Tailwind `@theme` for shadcn) are derived from the 101 core Vanyshr design tokens in `packages/ui/src/styles/tokens.css` via `var()` references only. No literal rgb/hex values in bridge assignments (§10a violation). (Was 98 before the 2026-09-17 color consolidation: +3 — `--color-black`, `--color-brand-alternate`, `--color-brand-alternate-on`. `--color-bg-experimental` is additional but experimental/light-only, excluded from this core count.)

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
| `--size-data` | `--text-data` | `13px` | Data role — IDs, counts, timestamps (`text-data`). `.text-data` also sets `font-variant-numeric: tabular-nums` (added 2026-09-17, `@layer utilities` in theme.css — not expressible via the `--text-data` theme pair alone) |

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
| `--color-primary` | `--color-primary` | `#14abfe` (dark) | Primary action, active state |
| `--color-primary-hover` | `--color-primary-hover` | `#3bb8fe` (dark) | Hover state on primary |
| `--color-primary-active` | `--color-primary-active` | `#0b8fd9` (dark) | Pressed/active state |
| `--color-primary-muted` | `--color-primary-muted` | `#14abfe33` (dark) | Soft primary background |
| `--color-primary-on` | `--color-primary-on` | `#0b0d10` | Ink on cyan fills |
| `--color-primary-text` | `--color-primary-text` | `#14abfe` (dark) | Cyan text on dark UI |
| `--color-primary-border` | `--color-primary-border` | `#14abfe66` (dark) | Border/ring on a primary-muted badge |

### Color: Secondary

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-secondary` | `--color-secondary` | `#0b8fd9` (dark) | Secondary action, badge |
| `--color-secondary-on` | `--color-secondary-on` | `#f5f5f5` | Text/icons on secondary fill |

### Color: Accent (signal orange)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-accent` | `--color-accent` | `#ff6924` | High-interest callout, CTA |
| `--color-accent-hover` | `--color-accent-hover` | `#ff7f45` (dark) | Hover on accent |
| `--color-accent-active` | `--color-accent-active` | `#e55a18` (dark) | Pressed on accent |
| `--color-accent-muted` | `--color-accent-muted` | `#ff692433` | Soft accent background |
| `--color-accent-on` | `--color-accent-on` | `#0b0d10` | Ink on orange fills |
| `--color-accent-text` | `--color-accent-text` | `#ff6924` (dark) | Orange text on dark UI |

### Color: Brand-alternate (peer brand, added 2026-09-17)

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-brand-alternate` | `--color-brand-alternate` | `#ff6924` | Peer brand color (Cash App green/purple model) — full-bleed moments, not a sparing accent like `--color-accent`. Same hex as `--color-accent` by design; distinct semantic role. |
| `--color-brand-alternate-on` | `--color-brand-alternate-on` | `#0b0d10` | Ink on brand-alternate fills — matches `--color-accent-on` for the same hue |

### Color: Surfaces

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-bg-app` | `--color-bg-app`, `--color-bg-primary` | `#242424` | Screen canvas, page bg |
| `--color-bg-surface` | `--color-bg-surface`, `--color-bg-secondary` | `#343434` | Cards, sheets, list rows |
| `--color-bg-elevated` | `--color-bg-elevated`, `--color-bg-surface-secondary` | `#444444` | Tooltips, dropdowns, floating |
| `--color-bg-overlay` | `--color-bg-overlay` | `#000000a6` | Semi-opaque overlay, modal backdrop |
| `--color-bg-inverse` | `--color-bg-inverse`, `--color-white` | `#fafafa` | Light mode surface when dark mode bg |

### Color: Text

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-text-primary` | `--color-text-primary` | `#f5f5f5` (dark) | Headings, body, primary icons |
| `--color-text-secondary` | `--color-text-secondary` | `#9aa3ad` (dark) | Captions, placeholders, secondary icons |
| `--color-text-tertiary` | `--color-text-tertiary` | `#6b7280` (dark) | De-emphasized metadata |
| `--color-text-disabled` | `--color-text-disabled` | `#5c5c5c` | Disabled text/controls |
| `--color-text-inverse` | `--color-text-inverse` | `#070f1c` | Navy ink (light mode) |

`--color-black` is a literal `#000` in both themes (tokens.css, promoted from theme.css 2026-09-17) — black means scrim/backdrop (Konsta `bg-black/50`), never ink. Inside `.k-navbar` it is re-pointed at `--color-text-primary`, because Konsta inks the iOS navbar title with `text-black`.

`--color-bg-experimental` (`#faf9f3`, light-scope only) is a warm-paper canvas under evaluation — opt in via `.theme-experimental` on root, alongside `.light`. Not wired into any component; excluded from tokens.json's dark-only mirror.

### Color: Borders

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-border` | `--color-border`, `--color-border-primary` | `#545454` | Default dividers, outlines |
| `--color-border-subtle` | `--color-border-subtle`, `--color-border-secondary` | `#54545480` | Hairlines inside cards |
| `--color-border-strong` | `--color-border-strong`, `--color-border-tertiary` | `#757575` | Emphasized outlines |
| `--color-border-focus` | `--color-border-focus`, `--color-focus-ring` | `#14abfe` | Focus ring outline |
| `--color-ring-focus` | — | `#14abfe66` | Focus ring glow/shadow |

### Color: State & Interaction

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-state-hover` | `--color-state-hover` | `#ffffff0f` | Hover wash (translucent white) |
| `--color-state-active` | `--color-state-active` | `#ffffff14` | Pressed/active wash |
| `--color-state-selected` | `--color-state-selected` | `#14abfe22` | Selected row/item wash |
| `--color-state-disabled-bg` | `--color-state-disabled-bg`, `--color-disabled` | `#343434` (dark, amended 2026-09-17) | Disabled element background |
| `--color-state-disabled-fg` | `--color-state-disabled-fg`, `--color-border-disabled` | `#5c5c5c` | Disabled text/border |

### Color: Status/Semantic

| Token | Library Var | Maps To | Purpose |
|-------|-------------|---------|---------|
| `--color-status-success` | `--color-status-success`, `--color-success` | `#3d9b6e` | Success fills, bold text |
| `--color-status-success-muted` | `--color-status-success-muted` | `#3d9b6e33` | Soft success badge/banner |
| `--color-status-success-on` | `--color-status-success-on` | `#0b0d10` | Text/icons on success fill |
| `--color-status-success-border` | `--color-status-success-border` | `#3d9b6e66` | Border/ring on success-muted badge |
| `--color-status-warn` | `--color-status-warn`, `--color-warning`, `--color-accent-risk` | `#d97706` | Warning fills, bold text |
| `--color-status-warn-muted` | `--color-status-warn-muted` | `#d9770633` | Soft warning badge/banner |
| `--color-status-warn-on` | `--color-status-warn-on` | `#0b0d10` | Text/icons on warning fill |
| `--color-status-warn-border` | `--color-status-warn-border` | `#d9770666` | Border/ring on warn-muted badge |
| `--color-status-danger` | `--color-status-danger`, `--color-error` | `#e5484d` | Error fills, bold text |
| `--color-status-danger-muted` | `--color-status-danger-muted` | `#e5484d33` | Soft error badge/banner |
| `--color-status-danger-on` | `--color-status-danger-on` | `#f5f5f5` | Text/icons on error fill |
| `--color-status-danger-hover` | `--color-status-danger-hover` | `#e96368` | Hover/press on danger fills |
| `--color-status-danger-border` | `--color-status-danger-border` | `#e5484d66` | Border/ring on danger-muted badge |
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

### Konsta (`--k-color-*`, konsta 5.4.0)

Emitted by `theme.css` as plain custom properties in `@layer konsta { :root { … } }` — exactly the names Konsta's components and styles read. Konsta's own `styles/colors.css` is **not** imported (its color plugin parses a hex brand color and crashes on token `var()`s); the bridge replaces it. The app runs `<KonstaProvider theme="ios" dark={false}>`, so only the light slot is mapped — the tokens themselves switch on `.light`.

| Konsta var | Maps To | Dark value | Konsta use |
|------------|---------|------------|------------|
| `--k-color-primary` | `--color-primary` | `#14abfe` | Primary (both themes) |
| `--k-color-ios-primary` | `--color-primary` | `#14abfe` | iOS primary |
| `--k-color-ios-primary-tint` | `--color-primary-hover` | `#3bb8fe` | iOS primary tint |
| `--k-color-ios-primary-shade` | `--color-primary-active` | `#0b8fd9` | iOS primary shade |
| `--k-color-md-light-primary` | `--color-primary` | `#14abfe` | MD primary |
| `--k-color-md-light-on-primary` | `--color-primary-on` | `#0b0d10` | Ink on primary |
| `--k-color-md-light-primary-container` | `--color-primary-muted` | `#14abfe33` | Soft primary fill |
| `--k-color-md-light-on-primary-container` | `--color-primary-text` | `#14abfe` | Text on soft primary |
| `--k-color-md-light-secondary` | `--color-secondary` | `#0b8fd9` | MD secondary |
| `--k-color-md-light-on-secondary` | `--color-secondary-on` | `#f5f5f5` | Text on secondary |
| `--k-color-md-light-secondary-container` | `--color-primary-muted` | `#14abfe33` | Selected list item fill |
| `--k-color-md-light-on-secondary-container` | `--color-primary-text` | `#14abfe` | Selected list item text |
| `--k-color-md-light-surface` | `--color-bg-app` | `#242424` | Page canvas, sheet |
| `--k-color-md-light-on-surface` | `--color-text-primary` | `#f5f5f5` | Chrome text |
| `--k-color-md-light-surface-variant` | `--color-bg-elevated` | `#444444` | Segmented track |
| `--k-color-md-light-on-surface-variant` | `--color-text-secondary` | `#9aa3ad` | Secondary chrome text |
| `--k-color-md-light-outline` | `--color-border` | `#545454` | Outlines |
| `--k-color-md-light-outline-variant` | `--color-border-subtle` | `#54545480` | Hairline outlines |
| `--k-color-md-light-surface-1` | `--color-bg-surface` | `#343434` | Lists, blocks |
| `--k-color-md-light-surface-2` | `--color-bg-surface` | `#343434` | Navbar, toolbar |
| `--k-color-md-light-surface-3` | `--color-bg-elevated` | `#444444` | Dialog |
| `--k-color-md-light-surface-4` | `--color-bg-elevated` | `#444444` | Floating |
| `--k-color-md-light-surface-5` | `--color-bg-elevated` | `#444444` | Toast |

Konsta utility colors (Tailwind `@theme` in `theme.css`): `--color-md-light-*` → `var(--k-color-md-light-*)` and `--color-ios-primary*` → `var(--k-color-ios-primary*)`, following Konsta's own pattern. Konsta's iOS surfaces are literal hex upstream (no `--k-color-*` var), so they map straight to tokens:

| Konsta utility color | Maps To |
|----------------------|---------|
| `--color-ios-light-surface` | `--color-bg-app` |
| `--color-ios-light-surface-1`, `-1-tint`, `-2` | `--color-bg-surface` |
| `--color-ios-light-surface-1-shade`, `-3`, `-variant` | `--color-bg-elevated` |
| `--color-ios-hover-highlight` | `--color-state-hover` |

### Motion (optional for CSS-in-JS)

Utilities: `duration-instant` / `-fast` / `-base` / `-slow` / `-slower` via `--transition-duration-*` aliases in theme.css; `ease-*` utilities resolve directly (Tailwind namespace).

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
  --color-bg-app: #242424;
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
- `packages/ui/src/styles/theme.css` — Refactored to use var() refs only; Konsta `--k-color-*` vars rewired to the names Konsta 5.4.0 reads (see Konsta table)
- `docs/TOKEN_BRIDGE.md` — This document (token-by-token mapping)

## References

- **Design Bible:** DESIGN.md §12 (Component library stack) & §12.4 (Token bridge contract)
- **Token Source:** docs/tokens.json (98 core + 67 bridge aliases, locked 2026-09-17; +5 core by bible amendment 2026-09-17)
- **Konsta:** konsta 5.4.0, Material Design 3 color pattern
- **Shadcn:** Radix + Tailwind v4 @theme (no separate dark mode mechanism)
