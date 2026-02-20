# Vanyshr Brand Guidelines

*Last Updated: February 20, 2026*
*Version: 4.0 - Charcoal Night Palette (Dark Mode Only — MVP/Pilot)*

---

## Color Palette

### Brand Core

| Token | Value | Role |
|---|---|---|
| **Brand Primary (Azure)** | `#00BFFF` | Buttons, links, CTAs, interactive elements, sticky CTA border |
| **Brand Dark** | `#022136` | Deep navy — logo color, used for `--brand-dark` token only |
| **Page Background** | `#022136` | Main app background — replaces old `#022136` bg role |
| **Accent Risk** | `#FF8A00` | **Semantic only** — risk words, exposure states, threat highlights (e.g. "Exposed") |
| **Accent Hover** | `#00D4FF` | Hover state for primary interactive elements |

> ⚠️ **Amber `#FF8A00` usage rule:** This color is reserved exclusively for words and UI states that communicate risk, exposure, or threat. Do not use it for positive states, feature names, benefit copy, or decorative emphasis. If you are unsure whether a use case qualifies, it does not.

> ⚠️ **Amber + Azure adjacency rule:** Never place `#FF8A00` and `#00BFFF` as adjacent text in the same line or sentence. They have a 1.11:1 contrast ratio against each other and will visually vibrate without legible separation.

---

### Semantic Colors

| Role | Value | Usage |
|---|---|---|
| **Success** | `#00D4AA` | Teal-green — removal confirmed, scan clean, positive states |
| **Warning** | `#FFB81C` | Golden amber — cautionary states, non-critical alerts |
| **Error** | `#FF5757` | Coral-red — errors, destructive actions, critical failures |
| **Info** | `#00BFFF` | Azure — informational highlights, neutral notices |
| **Disabled** | `#4A5568` | Mid-gray — disabled states on dark backgrounds |
| **Accent Risk** | `#FF8A00` | Vivid amber — risk/exposure semantic highlights only (see rule above) |

---

### Dark Theme Tokens (MVP — Only Active Theme)

> Light mode is **not implemented** for MVP/Pilot. All tokens below are the single active theme. The `[data-theme="light"]` block has been removed.

| Token | Value | Contrast on `#022136` | Usage |
|---|---|---|---|
| `--bg-page` | `#022136` | — | Main app background |
| `--bg-surface` | `#2D3847` | 1.17:1 (depth via border/shadow) | Cards, panels, content containers |
| `--bg-surface-secondary` | `#2D3847` | 1.09:1 (nested depth) | Nested cards, modals, secondary panels |
| `--brand-primary` | `#00BFFF` | 7.72:1 ✅ | CTAs, links, active elements, sticky border |
| `--accent-hover` | `#00D4FF` | 8.59:1 ✅ | Hover state for primary elements |
| `--accent-risk` | `#FF8A00` | 6.93:1 ✅ | Risk/exposure semantic text only |
| `--brand-dark` | `#022136` | — | Logo color reference — do not use as bg |
| `--text-primary` | `#FFFFFF` | 16.38:1 ✅ | Headlines, primary body, key labels |
| `--text-secondary` | `#B8C4CC` | 9.21:1 ✅ | Supporting body copy, descriptions |
| `--text-tertiary` | `#7A92A8` | 5.07:1 ✅ | Captions, helper text, fine print, reassurance copy |
| `--border-subtle` | `#2A4A68` | — | Subtle dividers, card outlines |
| `--border-brand` | `#00BFFF` | — | Sticky CTA top border, focus rings, active separators |

> **Previously broken token — now resolved:** `--text-secondary` was `#476B84` (2.91:1 — WCAG FAIL). Replaced with `#B8C4CC` (9.21:1 — WCAG AA Pass).

---

### Text Color Hierarchy

Use this hierarchy in order. Do not skip levels or use accent colors as general text.

1. **`#FFFFFF`** — Headlines, hero titles, primary CTA labels
2. **`#B8C4CC`** — Body copy, supporting descriptions, secondary labels
3. **`#7A92A8`** — Captions, fine print, "No Credit Card Required" type reassurance lines
4. **`#00BFFF`** — Brand accent — links, "FREE" callouts, highlighted feature names, CTA inline emphasis
5. **`#FF8A00`** — Risk accent — "Exposed", "Found", threat-state words only

---

### Sticky CTA Container

The sticky footer CTA uses border-based separation rather than a contrasting background fill, because no dark surface value achieves sufficient luminance contrast (>3:1) against `#022136` to be perceptible as a distinct layer.

```css
.sticky-cta {
  background: #022136;                          /* --bg-page — no change */
  border-top: 2px solid #00BFFF;               /* --border-brand */
  backdrop-filter: blur(12px);
  box-shadow: 0 -8px 24px rgba(0, 0, 0, 0.45);
}
```

The top border carries the separation signal. The shadow creates perceived elevation on slide-up. No new color token is required.

---

## Typography

### Font Family
- **Primary**: Ubuntu (Google Fonts) — migrated from Inter
- **Monospace**: Roboto Mono (code/technical content)

### Font Weights
- **Light**: 300
- **Regular**: 400
- **Medium**: 500
- **Semi-Bold**: 600
- **Bold**: 700

### Logo Matching
For the brand name "vanyshr," use **Ubuntu Bold (700)** with `tracking-tighter` (−0.05em) to match the logo's tight kerning.

---

## Spacing System

### Base Unit
All spacing uses a **4px base unit**. All values are multiples of 4.

### Mobile-First Scale (Primary — MVP is mobile-first PWA)

| Token | Value | Usage |
|---|---|---|
| `--space-1` | `4px` | Icon padding, micro gaps |
| `--space-2` | `8px` | Inline element gaps, tight label spacing |
| `--space-3` | `12px` | Input internal padding, compact component gaps |
| `--space-4` | `16px` | Standard section padding, card internal padding |
| `--space-5` | `20px` | Section gaps on mobile |
| `--space-6` | `24px` | Card padding, between-component gaps |
| `--space-8` | `32px` | Section breaks, hero element spacing |
| `--space-10` | `40px` | Large section separation |
| `--space-12` | `48px` | Hero top padding, major layout breaks |

### Page Layout (Mobile)

```
Page horizontal padding:  24px (--space-6) left and right
Nav height:               56px
Hero section top padding: 32px below nav
Between major sections:   32–40px
Sticky CTA height:        auto (min 80px)
Sticky CTA internal pad:  20px top/bottom, 24px left/right
```

### Hero Section Spacing Recommendations

Looking at the current screenshot, approximately 30–35% of vertical space between the nav and the cloud graphic is unused white space that is not doing layout work. Recommended changes:

- **Reduce gap between tagline ("AI Powered Data Privacy") and headline** from current ~24px to **12px**
- **Reduce gap between headline and cloud graphic** from current ~32px to **20px**
- **Reduce gap between cloud graphic and body copy** from current ~32px to **20px**
- **Add a visible divider or breathing room marker** between body copy and sticky CTA — currently the transition is abrupt with no spatial signal
- **Icon orbit graphic**: Consider scaling up by ~15% — the graphic currently feels small relative to the viewport width, leaving horizontal real estate unused on both sides

These changes will tighten the above-fold content into a more intentional layout without feeling cluttered, and will push more of the hero content into viewport without scrolling on standard mobile screens (375–390px width).

---

## Button Styles

| State | Background | Text | Border |
|---|---|---|---|
| Default | `#00BFFF` | `#022136` | none |
| Hover | `#00D4FF` | `#022136` | none |
| Active/Pressed | `#0099CC` | `#FFFFFF` | none |
| Disabled | `#4A5568` | `#7A92A8` | none |
| Secondary (outline) | transparent | `#00BFFF` | `2px solid #00BFFF` |

---

## Implementation Notes

### CSS Variables — Dark Mode Only (MVP)

```css
:root {
  /* Brand Core */
  --brand-primary: #00BFFF;
  --brand-dark: #022136;
  --accent-hover: #00D4FF;
  --accent-risk: #FF8A00;

  /* Semantic */
  --success: #00D4AA;
  --error: #FF5757;
  --warning: #FFB81C;
  --info: #00BFFF;
  --disabled: #4A5568;

  /* Backgrounds */
  --bg-page: #022136;
  --bg-surface: #2D3847;
  --bg-surface-secondary: #2D3847;

  /* Text */
  --text-primary: #FFFFFF;
  --text-secondary: #B8C4CC;
  --text-tertiary: #7A92A8;

  /* Borders */
  --border-subtle: #2A4A68;
  --border-brand: #00BFFF;

  /* Spacing */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
}
```

> **Removed:** `[data-theme="light"]` and `[data-theme="dark"]` blocks. All values are now set on `:root` directly. Light mode theming to be reintroduced post-MVP if required.

### Material-UI Theme Integration

```typescript
const theme = {
  palette: {
    primary: {
      main: '#00BFFF',
      dark: '#0099CC',
      light: '#00D4FF',
    },
    success: {
      main: '#00D4AA',
    },
    warning: {
      main: '#FFB81C',
    },
    error: {
      main: '#FF5757',
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#B8C4CC',
      disabled: '#7A92A8',
    },
    background: {
      default: '#022136',
      paper: '#2D3847',
    },
  },
};
```

---

## Brand Consistency

### Do's
- ✅ Use `#00BFFF` for all primary actions, CTAs, links, and interactive brand elements
- ✅ Use `#FF8A00` exclusively for risk/exposure/threat semantic words
- ✅ Use `#B8C4CC` for supporting body copy — never `#476B84` (fails WCAG on dark bg)
- ✅ Use `#7A92A8` for fine print, reassurance copy, captions
- ✅ Use `--border-brand` (`#00BFFF`) top border on sticky CTA for layer separation
- ✅ Maintain 4px-base spacing system throughout

### Don'ts
- ❌ Don't use `#476B84` for any text — it fails WCAG AA on all current backgrounds
- ❌ Don't place `#FF8A00` and `#00BFFF` adjacent in the same text line
- ❌ Don't use `#FF8A00` for positive states, feature copy, or decorative emphasis
- ❌ Don't use colors outside the defined palette
- ❌ Don't implement light mode components — dark only for MVP

---

## Examples

### QuickScan Hero Page
- **Tagline** ("AI Powered Data Privacy"): `#00BFFF` — `text-xs font-medium tracking-wide uppercase`
- **Headline** ("Your Personal Data Is"): `#FFFFFF` — Display style
- **Risk word** ("Exposed"): `#FF8A00` italic — same Display size
- **Body copy** ("Data Brokers harvest..."): `#B8C4CC` — Body Large
- **Threat emphasis** ("Scammers, Spammers & Stalkers"): `#FFFFFF` bold italic
- **Sticky CTA headline**: `#FFFFFF` bold
- **Sticky CTA "FREE" inline**: `#00BFFF`
- **Sticky CTA fine print** ("No Credit Card or Sign Up Required"): `#7A92A8`
- **CTA Button**: `#00BFFF` background, `#022136` text

### Navigation
- **Active Links**: `#00BFFF` text
- **Inactive Links**: `#B8C4CC` text, `#00BFFF` on hover
- **Background**: `#022136`