# Vanyshr Design System

**Primary Font:** Ubuntu
**Status:** Unified Technical Source of Truth for React/Tailwind Implementation
**Theme:** Dark Only (MVP/Pilot — light mode removed)
**Last Updated:** February 20, 2026 — v4.0 Charcoal Night

---

## 1. Typography (Ubuntu)

| Name | Size | Weight | Tailwind Class | Usage |
|:---|:---|:---|:---|:---|
| **Display** | 32px | 700 (Bold) | `text-4xl font-bold tracking-tighter font-ubuntu` | Hero titles |
| **Heading 1** | 24px | 700 (Bold) | `text-2xl font-bold font-ubuntu` | Page titles |
| **Heading 2** | 20px | 500 (Medium) | `text-xl font-medium font-ubuntu` | Section headings |
| **Body Large** | 16px | 400 (Regular) | `text-base font-normal font-ubuntu` | Main body text |
| **Body Small** | 12px | 400 (Regular) | `text-xs font-normal font-ubuntu` | Helper text, captions, fine print |
| **Label** | 11px | 500 (Medium) | `text-[11px] font-medium tracking-wide uppercase font-ubuntu` | Tags, category labels |

**Logo Match:** Ubuntu Bold 700 + `tracking-tighter` (−0.05em) for "vanyshr" wordmark.

---

## 2. Color Tokens (Charcoal Night — Dark Only)

All tokens are defined on `:root`. No `[data-theme]` switching for MVP.

| Token | Value | WCAG on `#022136` | Usage |
|:---|:---|:---|:---|
| `--bg-page` | `#022136` | — | Main app background |
| `--bg-surface` | `#2D3847` | depth via shadow/border | Cards, panels |
| `--bg-surface-secondary` | `#2D3847` | depth via shadow/border | Nested cards, modals |
| `--brand-primary` | `#00BFFF` | 7.72:1 ✅ AA | CTAs, links, interactive, sticky border |
| `--accent-hover` | `#00D4FF` | 8.59:1 ✅ AA | Hover state for primary elements |
| `--accent-risk` | `#FF8A00` | 6.93:1 ✅ AA | Risk words only — "Exposed", threat states |
| `--brand-dark` | `#022136` | 
| `--text-primary` | `#FFFFFF` | 16.38:1 ✅ AAA | Headlines, primary body |
| `--text-secondary` | `#B8C4CC` | 9.21:1 ✅ AA | Supporting body copy |
| `--text-tertiary` | `#7A92A8` | 5.07:1 ✅ AA | Captions, fine print, reassurance |
| `--border-subtle` | `#2A4A68` | — | Card borders, dividers |
| `--border-brand` | `#00BFFF` | — | Sticky CTA top border, focus rings |
| `--success` | `#00D4AA` | 7.41:1 ✅ AA | Removal confirmed, clean scan |
| `--warning` | `#FFB81C` | 8.54:1 ✅ AA | Caution states |
| `--error` | `#FF5757` | 5.27:1 ✅ AA | Errors, critical failures |
| `--disabled` | `#4A5568` | — | Disabled UI elements |

> **`--accent-risk` rule:** `#FF8A00` is for risk/exposure/threat words only. Never adjacent to `--brand-primary` (`#00BFFF`) — they share only 1.11:1 contrast against each other.

> **Removed token:** `--text-secondary: #476B84` — this value was 2.91:1 on dark backgrounds (WCAG FAIL). All instances must be replaced with `--text-secondary: #B8C4CC`.

---

## 3. Spacing System

**Base unit: 4px.** All spacing is a multiple of 4.

```css
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
```

### Tailwind Equivalents

| Token | Tailwind | Value |
|---|---|---|
| `--space-2` | `gap-2 / p-2` | 8px |
| `--space-3` | `gap-3 / p-3` | 12px |
| `--space-4` | `gap-4 / p-4` | 16px |
| `--space-5` | `gap-5 / p-5` | 20px |
| `--space-6` | `gap-6 / p-6` | 24px |
| `--space-8` | `gap-8 / p-8` | 32px |

### Page Layout (Mobile-First)

```
Horizontal page padding:   px-6  (24px each side)
Nav height:                h-14  (56px)
Hero top padding:          pt-8  (32px below nav)
Between hero elements:     gap-5 (20px)
Between page sections:     gap-8 (32px)
Card internal padding:     p-6   (24px)
Sticky CTA internal:       py-5 px-6 (20px / 24px)
```

---

## 4. Component Implementation Patterns

### Sticky CTA Footer

```jsx
<div className="
  fixed bottom-0 left-0 right-0
  bg-[#022136]
  border-t-2 border-[#00BFFF]
  backdrop-blur-md
  shadow-[0_-8px_24px_rgba(0,0,0,0.45)]
  py-5 px-6
  flex flex-col gap-3
  z-50
">
  <div className="text-center">
    <p className="text-white font-bold text-base">
      See Exactly What Data is Exposed
    </p>
    <p className="text-white font-bold text-base">
      Run a{' '}
      <span className="text-[#00BFFF] underline font-bold">FREE</span>
      {' '}QuickScan
    </p>
  </div>
  <p className="text-[#7A92A8] text-xs text-center">
    No Credit Card or Sign Up Required
  </p>
  <button className="
    w-full h-[52px] rounded-xl
    bg-[#00BFFF] text-[#022136]
    font-bold text-base
    hover:bg-[#00D4FF]
    active:bg-[#0099CC] active:text-white
    transition-colors duration-150
  ">
    Run a QuickScan Now
  </button>
</div>
```

> Note: "No Credit Card or Sign Up Required" uses `--text-tertiary` (`#7A92A8`) — this is reassurance copy, not a risk word. Do not use `--accent-risk` here.

### Standard Input

```jsx
<div className="relative">
  <input
    type="email"
    className="
      h-[52px] w-full rounded-xl
      border border-[#2A4A68]
      focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF]
      px-12 py-3 text-sm
      bg-[#2D3847]
      text-white placeholder:text-[#7A92A8]
      font-ubuntu
      outline-none transition-colors duration-150
    "
    placeholder="Enter your email"
  />
  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A92A8]" />
</div>
```

### Risk Highlight (Semantic — Threat Words Only)

```jsx
{/* Use ONLY for words communicating risk/exposure/threat */}
<span className="text-[#FF8A00] italic">Exposed</span>
```

### Brand Highlight (CTA / Feature / Positive)

```jsx
<span className="text-[#00BFFF]">FREE</span>
```

### Card / Surface

```jsx
<div className="
  bg-[#2D3847]
  border border-[#2A4A68]
  rounded-2xl p-6
  shadow-lg
">
  {/* content */}
</div>
```

---

## 5. Hero Section Spacing (QuickScan Page)

Based on audit of current page — the hero has approximately 30–35% unused vertical real estate. Apply these specific values:

```
Nav → Tagline gap:          mt-8   (32px)
Tagline → Headline gap:     mt-3   (12px)   ← tighten from current ~24px
Headline → Cloud graphic:   mt-5   (20px)   ← tighten from current ~32px
Cloud graphic → Body copy:  mt-5   (20px)   ← tighten from current ~32px
Body copy → Sticky CTA:     mb-[88px]       (clearance for sticky footer)
Cloud graphic scale:        w-[85%] mx-auto ← scale up ~15% from current
```

---

## 6. CSS Variables — Full Block (Drop-In Replace)

```css
:root {
  /* Brand */
  --brand-primary: #00BFFF;
  --brand-dark: #022136;
  --accent-hover: #00D4FF;
  --accent-risk: #FF8A00;

  /* Semantic */
  --success: #00D4AA;
  --warning: #FFB81C;
  --error: #FF5757;
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

---

## 7. Engineering Reference

- **UI Components:** `@vanyshr/ui/components/...`
- **Constants/Types:** `@vanyshr/shared/types`
- **Tailwind Config (v4):** `apps/app/src/index.css` via `@theme` block
- **Font:** Ubuntu via Google Fonts — import in root CSS or `index.html`

**Directory Location:** `/docs/DESIGN_SYSTEM.md`