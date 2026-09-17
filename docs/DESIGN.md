# Vanyshr design system

Agent-facing bible. Values live in the token file; values change only via spec from Igor (applied by Claude in the repo);
rules live here. If a value disagrees, the token file wins. If a rule disagrees, this file wins.

- Token file: `packages/ui/src/styles/tokens.css`
- Components: `docs/COMPONENTS.md`

## 0 Quick Reference

**Composition:** Mobile-only PWA. Single-column app shell: per-screen top navbar (Konsta), scrollable content, bottom tab bar (Konsta). No desktop layouts.

**Hard rules:** No raw hex, rgb(), or rgba() in component files. No arbitrary px for spacing. No font families outside 3 Type. When a component exists in the catalog, use it. Read 12 Component library stack before importing ANY component — each surface has exactly one owning library. One icon package only (`lucide-react`). Konsta owns all screen overlays. Touch targets ≥ 44px. When ambiguous, stop and ask.

**Color:** `--color-primary` (+ `-hover`, `-active`, `-muted`, `-on`, `-text`, `-border`), `--color-secondary`, `--color-accent` (+ `-hover`, `-active`, `-muted`, `-on`, `-text`), `--color-bg-app`, `--color-bg-surface`, `--color-bg-elevated`, `--color-bg-overlay`, `--color-text-primary`, `--color-text-secondary`, `--color-text-tertiary`, `--color-border` (+ `-subtle`, `-strong`, `-focus`), `--color-state-hover`, `--color-state-active`, `--color-state-selected`, `--color-status-success`, `--color-status-warn`, `--color-status-danger`, `--color-status-info` (each + `-muted`, `-on`; success/warn/danger + `-border`; danger + `-hover`), `--color-brand-cyan`, `--color-brand-orange`, `--color-brand-navy`

Token file: `packages/ui/src/styles/tokens.css`. Catalog: `docs/COMPONENTS.md`.

**Components:** Stack — chrome → Konsta UI (React) · content → shadcn + Radix · viz → Recharts · icons → Lucide. See 11 Components and 12 Component library stack.

## 1 Principles

1. Named tokens only. Components never invent a color, space, or type size.
2. If a component exists in COMPONENTS.md, use it. Do not rebuild it.
3. The §12 ownership map decides which library a component comes from. Never cross it.
4. When this file does not cover a case, stop and ask. Do not freelance.

## 2 Color

This block must match the token file. Edit values via spec from Igor, not by hand here.

```css
/* Vanyshr design tokens — color locked 2026-09-17
   Hero #14ABFE · Accent #FF6924 · Navy #070F1C
   Dark chrome: #1A1A1A / #2A2A2A / #3A3A3A / #4A4A4A
   :root = dark (app default). .light = light overrides (same token names).
   Type: system stacks (default set 2026-09-17 — change via spec from Igor, not by hand).
*/

:root {
  /* ── Brand (raw) ── */
  --color-brand-cyan: #14abfe;
  --color-brand-orange: #ff6924;
  --color-brand-navy: #070f1c;
  --color-brand-cyan-on-light: #0077cc;
  --color-brand-orange-on-light: #b84300;

  /* Compat with old brand-primary* slots */
  --color-brand-primary1: var(--color-brand-cyan);
  --color-brand-primary2: var(--color-brand-orange);
  --color-brand-primary3: var(--color-brand-navy);
  --color-brand-primary4: #fafafa;

  /* ── Primary (hero cyan) ── */
  --color-primary: #14abfe;
  --color-primary-hover: #3bb8fe;
  --color-primary-active: #0b8fd9;
  --color-primary-muted: #14abfe33;
  --color-primary-on: #0b0d10; /* ink on cyan fills — never white */
  --color-primary-text: #14abfe; /* colored text on dark UI */
  --color-primary-border: #14abfe66; /* badge border on primary-muted */

  /* ── Secondary / accent ── */
  --color-secondary: #0b8fd9;
  --color-secondary-on: #f5f5f5;
  --color-accent: #ff6924;
  --color-accent-hover: #ff7f45;
  --color-accent-active: #e55a18;
  --color-accent-muted: #ff692433;
  --color-accent-on: #0b0d10; /* ink on orange fills */
  --color-accent-text: #ff6924;

  /* ── Surfaces (true grey ladder) ── */
  --color-bg-app: #1a1a1a;
  --color-bg-surface: #2a2a2a;
  --color-bg-elevated: #3a3a3a;
  --color-bg-overlay: #000000a6;
  --color-bg-inverse: #fafafa;

  /* ── Text ── */
  --color-text-primary: #f5f5f5;
  --color-text-secondary: #9aa3ad;
  --color-text-tertiary: #6b7280;
  --color-text-disabled: #5c5c5c;
  --color-text-inverse: #070f1c;
  --color-text-link: var(--color-primary-text);
  --color-text-on-primary: var(--color-primary-on);
  --color-text-on-accent: var(--color-accent-on);

  /* ── Borders / focus ── */
  --color-border: #4a4a4a;
  --color-border-subtle: #4a4a4a80;
  --color-border-strong: #6b6b6b;
  --color-border-focus: #14abfe;
  --color-ring-focus: #14abfe66;

  /* ── Interactive washes ── */
  --color-state-hover: #ffffff0f;
  --color-state-active: #ffffff14;
  --color-state-selected: #14abfe22;
  --color-state-disabled-bg: #2a2a2a;
  --color-state-disabled-fg: #5c5c5c;

  /* ── Semantic ── */
  --color-status-success: #3d9b6e;
  --color-status-success-muted: #3d9b6e33;
  --color-status-success-on: #0b0d10;
  --color-status-success-border: #3d9b6e66;
  --color-status-warn: #d97706;
  --color-status-warn-muted: #d9770633;
  --color-status-warn-on: #0b0d10;
  --color-status-warn-border: #d9770666;
  --color-status-danger: #e5484d;
  --color-status-danger-hover: #e96368;
  --color-status-danger-muted: #e5484d33;
  --color-status-danger-on: #f5f5f5;
  --color-status-danger-border: #e5484d66;
  --color-status-info: #14abfe;
  --color-status-info-muted: #14abfe33;
  --color-status-info-on: #0b0d10;

  /* ── Space ── */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-8: 48px;

  /* ── Depth ── */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 18px;
  --radius-pill: 999px;
  --border-width: 1px;
  --shadow-1: 0 1px 3px rgba(0, 0, 0, 0.18);
  --shadow-2: 0 4px 12px rgba(0, 0, 0, 0.2);
  --shadow-3: 0 10px 28px rgba(0, 0, 0, 0.28);

  /* ── Motion ── */
  --duration-instant: 50ms;
  --duration-fast: 120ms;
  --duration-base: 200ms;
  --duration-slow: 320ms;
  --duration-slower: 500ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-emphasized: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
  --ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
  --ease-linear: linear;

  /* ── Type ── */
  --size-display: 30px;
  --size-title: 22px;
  --size-heading: 15px;
  --size-body: 14px;
  --size-caption: 12px;
  --size-label: 11px;
  --size-data: 13px;
  --font-ui: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
}

/* Light mode — same names, navy ink, on-light text ramps for cyan/orange */
.light {
  --color-primary: #14abfe;
  --color-primary-hover: #0b8fd9;
  --color-primary-active: #0077cc;
  --color-primary-muted: #14abfe1f;
  --color-primary-on: #0b0d10;
  --color-primary-text: #0077cc;
  --color-primary-border: #14abfe4d;

  --color-secondary: #0077cc;
  --color-secondary-on: #fafafa;
  --color-accent: #ff6924;
  --color-accent-hover: #e55a18;
  --color-accent-active: #b84300;
  --color-accent-muted: #ff69241f;
  --color-accent-on: #0b0d10;
  --color-accent-text: #b84300;

  --color-bg-app: #fafafa;
  --color-bg-surface: #ffffff;
  --color-bg-elevated: #f0f0f0;
  --color-bg-overlay: #070f1c99;
  --color-bg-inverse: #1a1a1a;

  --color-text-primary: #070f1c;
  --color-text-secondary: #5c6570;
  --color-text-tertiary: #8a939e;
  --color-text-disabled: #b0b0b0;
  --color-text-inverse: #f5f5f5;
  --color-text-link: #0077cc;
  --color-text-on-primary: #0b0d10;
  --color-text-on-accent: #0b0d10;

  --color-border: #e0e0e0;
  --color-border-subtle: #eeeeee;
  --color-border-strong: #c4c4c4;
  --color-border-focus: #0077cc;
  --color-ring-focus: #14abfe55;

  --color-state-hover: #070f1c0a;
  --color-state-active: #070f1c12;
  --color-state-selected: #14abfe1a;
  --color-state-disabled-bg: #f0f0f0;
  --color-state-disabled-fg: #b0b0b0;

  --color-status-success: #2f7d58;
  --color-status-success-muted: #2f7d581f;
  --color-status-success-on: #ffffff;
  --color-status-success-border: #2f7d584d;
  --color-status-warn: #b45309;
  --color-status-warn-muted: #b453091f;
  --color-status-warn-on: #ffffff;
  --color-status-warn-border: #b453094d;
  --color-status-danger: #c53d42;
  --color-status-danger-hover: #ad363a;
  --color-status-danger-muted: #c53d421f;
  --color-status-danger-on: #ffffff;
  --color-status-danger-border: #c53d424d;
  --color-status-info: #0077cc;
  --color-status-info-muted: #0077cc1f;
  --color-status-info-on: #ffffff;

  --shadow-1: 0 1px 3px rgba(7, 15, 28, 0.08);
  --shadow-2: 0 4px 12px rgba(7, 15, 28, 0.1);
  --shadow-3: 0 10px 28px rgba(7, 15, 28, 0.14);
}
```

### Core Colors

| Seed token | Dark | Light |
|---|---|---|
| `--color-primary` | #14abfe | #14abfe |
| `--color-primary-hover` | #3bb8fe | #0b8fd9 |
| `--color-primary-active` | #0b8fd9 | #0077cc |
| `--color-primary-on` | #0b0d10 | #0b0d10 |
| `--color-primary-text` | #14abfe | #0077cc |
| `--color-primary-border` | #14abfe66 | #14abfe4d |
| `--color-secondary` | #0b8fd9 | #0077cc |
| `--color-accent` | #ff6924 | #ff6924 |
| `--color-accent-hover` | #ff7f45 | #e55a18 |
| `--color-accent-active` | #e55a18 | #b84300 |
| `--color-accent-on` | #0b0d10 | #0b0d10 |
| `--color-accent-text` | #ff6924 | #b84300 |
| `--color-bg-app` | #1a1a1a | #fafafa |
| `--color-bg-surface` | #2a2a2a | #ffffff |
| `--color-bg-elevated` | #3a3a3a | #f0f0f0 |
| `--color-text-primary` | #f5f5f5 | #070f1c |
| `--color-text-secondary` | #9aa3ad | #5c6570 |
| `--color-text-tertiary` | #6b7280 | #8a939e |
| `--color-border` | #4a4a4a | #e0e0e0 |
| `--color-border-strong` | #6b6b6b | #c4c4c4 |
| `--color-status-success` | #3d9b6e | #2f7d58 |
| `--color-status-success-border` | #3d9b6e66 | #2f7d584d |
| `--color-status-warn` | #d97706 | #b45309 |
| `--color-status-warn-border` | #d9770666 | #b453094d |
| `--color-status-danger` | #e5484d | #c53d42 |
| `--color-status-danger-hover` | #e96368 | #ad363a |
| `--color-status-danger-border` | #e5484d66 | #c53d424d |
| `--color-status-info` | #14abfe | #0077cc |

### Brand Palette

Raw brand colors. `--color-primary` and `--color-secondary` are picked from these, not freehand. `--color-brand-primary1–4` are compat aliases — prefer the named brand tokens.

| Token | Name | Dark | Light |
|---|---|---|---|
| `--color-brand-cyan` | Hero cyan | #14abfe | #14abfe |
| `--color-brand-orange` | Signal orange | #ff6924 | #ff6924 |
| `--color-brand-navy` | Ink navy | #070f1c | #070f1c |
| `--color-brand-cyan-on-light` | Cyan text on light | — | #0077cc |
| `--color-brand-orange-on-light` | Orange text on light | — | #b84300 |

### Usage

| Seed token | What it controls |
|---|---|
| `--color-primary` | Primary fills (buttons, active tabs, selected states). Text/icons on it use `--color-primary-on` (ink — never white). |
| `--color-primary-hover` / `-active` | Press/hover states of primary fills. Never swap hue on interaction. |
| `--color-primary-muted` | Soft primary backgrounds (selected rows, info banners). |
| `--color-primary-border` | Border/ring on a `--color-primary-muted` badge — one step stronger than the muted fill. Added 2026-09-17 (bible amendment). |
| `--color-primary-text` | Cyan *text* on dark UI. On light UI it becomes `#0077cc` automatically. |
| `--color-secondary` | Secondary actions, active indicators. |
| `--color-accent` | Sparingly: high-interest callouts, key CTAs. Same hover/active/on discipline as primary. |
| `--color-bg-app` | Screen canvas. `--color-bg-surface`: cards, sheets, list rows. `--color-bg-elevated`: tooltips, dropdowns, anything floating above surface. |
| `--color-text-primary` | Headings, body, primary icons. `--color-text-secondary`: captions, placeholders. `--color-text-tertiary`: de-emphasized metadata. |
| `--color-border` | Default borders/dividers. `-subtle` for hairlines inside cards, `-strong` for emphasized outlines. |
| `--color-state-hover` / `-active` / `-selected` | Interaction washes — translucent overlays, never hue swaps. |
| `--color-status-*` | Base = fills and bold text. `-muted` = soft badge/banner backgrounds. `-on` = text/icons sitting on the base fill. `-border` (success/warn/danger) = border/ring on a `-muted` badge. `--color-status-danger-hover` = press/hover of danger fills (same hue, same discipline as `--color-primary-hover`). Never use the base fill for large backgrounds. Added `-border`/`-hover` 2026-09-17 (bible amendment). |

## 3 Type

Named roles, never bare pixel sizes in components. Use `var(--size-body)`, not `16px`.

Families: **system stacks** (default set 2026-09-17 — native-feel PWA, no webfont download; change via spec from Igor if a brand face is chosen).

| Role | Size token | Size | Weight | Where used |
|---|---|---|---|---|
| display | `--size-display` | 30px | 600 | Hero / empty-state title |
| title | `--size-title` | 22px | 600 | Panel titles |
| heading | `--size-heading` | 15px | 600 | Section heads |
| body | `--size-body` | 14px | 400 | Running copy |
| caption | `--size-caption` | 12px | 400 | Helper text |
| label | `--size-label` | 11px | 500 | Field labels |
| data | `--size-data` | 13px | 500 | IDs, counts, timestamps |

- `--font-ui`: UI text. `--font-display`: display/title roles. `--font-mono`: data, codes, timestamps.

## 4 Space

Base unit: **4px** · density **Compact**. Do not invent off-scale gaps.

| Token | Value | Use |
|---|---|---|
| `--space-1` | 4px | Tight icon gaps |
| `--space-2` | 8px | Control padding, inline gaps |
| `--space-3` | 12px | Compact stacks |
| `--space-4` | 16px | Panel padding, section gap |
| `--space-5` | 24px | Group separation |
| `--space-6` | 32px | Page-level blocks |
| `--space-8` | 48px | Major region gaps |

## 5 Layout

**Composition:** Mobile-only PWA. Design baseline 390px. Single column; the app fills the viewport.

- Screen structure: top navbar (Konsta) → scrollable content → bottom tab bar (Konsta). No sidebars, no multi-column app chrome, no desktop layouts.
- No wide-viewport treatment. This is an installed mobile PWA — the phone viewport is the only viewport. Opened in a desktop browser, it renders the same single-column phone UI. No caps, no sidebars, no breakpoints.
- Safe areas: pad the tab bar, navbar, and sheets with `env(safe-area-inset-*)`. Fixed chrome that ignores the notch is a 10a violation.
- Touch targets: every interactive element ≥ 44×44px. No exceptions.
- Primary actions live in the thumb zone (bottom half of the screen); destructive actions are never adjacent to primary actions.
- Touch-first: no hover-dependent UI. Hover states are decorative progressive enhancement only — never required to discover a function.

## 6 Depth

Radius style **Rounded**, shadow style **Soft**, border width **1px**.

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 8px | Chips, small fills |
| `--radius-md` | 12px | Inputs, buttons |
| `--radius-lg` | 18px | Cards, sheets |
| `--radius-pill` | 999px | Pills, toggles, avatars |

| Token | Value | Use |
|---|---|---|
| `--shadow-1` | 0 1px 3px rgba(0, 0, 0, 0.18) | Raised controls, cards at rest |
| `--shadow-2` | 0 4px 12px rgba(0, 0, 0, 0.2) | Popovers, menus, hovered cards |
| `--shadow-3` | 0 10px 28px rgba(0, 0, 0, 0.28) | Dialogs, sheets |

## 7 Motion

| Token | Value | Use |
|---|---|---|
| `--duration-instant` | 50ms | Press feedback, focus ring |
| `--duration-fast` | 120ms | Color, chip state, hover |
| `--duration-base` | 200ms | Panel open, tabs, menus |
| `--duration-slow` | 320ms | Dialogs, sheets |
| `--duration-slower` | 500ms | Page-level reveal |
| `--ease-standard` | cubic-bezier(0.2, 0, 0, 1) | Default for state changes |
| `--ease-emphasized` | cubic-bezier(0.34, 1.56, 0.64, 1) | Overshoot for lifts and pops |
| `--ease-decelerate` | cubic-bezier(0.05, 0.7, 0.1, 1) | Elements entering |
| `--ease-accelerate` | cubic-bezier(0.3, 0, 0.8, 0.15) | Elements leaving |
| `--ease-linear` | linear | Progress, spinners |

Honor `prefers-reduced-motion: reduce`.

**Intensity:** restrained — one animated property per transition; no competing animations on the same interaction.

**Hover properties allowed:** `color` and `background-color` only, decorative — never load-bearing (see 5 Layout).

## 8 Icons

Icon library: `lucide`. Exactly one icon package in the repo.

- Import: `import { House, ChartColumn } from "lucide-react"`
- Sizing: Tailwind `size-*` classes — `size-4` (16px) inline with text, `size-5` (20px) chrome and tab bar, `size-6` (24px) feature icons.
- Stroke width 2 (default). Icons inherit `currentColor` — never hardcode an icon color; use text tokens.
- `phosphor-react`, `@phosphor-icons/react`, heroicons are banned (10a). No emoji-as-icons.

## 9 States

Hover, focus, active, disabled, loading, and error are token assignments, not per-component inventions.

- Hover: `--color-state-hover` wash. Never swap hue on hover.
- Pressed/active: `--color-state-active` wash.
- Selected: `--color-state-selected` wash + `--color-primary-text` label.
- Focus: 2px `--color-border-focus` outline + `--color-ring-focus` glow. Visible on every interactive element.
- Disabled: `--color-text-disabled` on `--color-state-disabled-bg`.
- Semantic: base token for fills and bold text, `-muted` for soft badge/banner backgrounds, `-on` for text/icons on the base fill. Never use a base status fill for a large background.
- Loading: skeleton blocks in `--color-bg-elevated` with shimmer for content; spinner only for blocking actions.

## 10 Anti-patterns

Two tiers. 10a is mechanical (hook-enforceable). 10b is agent judgment — not regex-checkable.

### 10a Mechanical (hook-enforced)

NEVER in component files:

- Raw hex
- `rgb()` / `rgba()` with literal values
- CSS color names
- Arbitrary utility values (`text-[#666]`, `p-[13px]`)
- Inline `style` carrying color or spacing values
- Font sizes in px not on the type scale
- New font families not named in 3 Type
- Icon imports from any package other than `lucide-react`
- Assignment to `--k-*` custom properties outside the generated token file
- Fixed chrome (tab bar, navbar, sheets) that ignores `env(safe-area-inset-*)`
- Interactive elements smaller than 44px

### 10b Judgment (agent self-checked)

- Do not add a second accent without a new semantic state.
- Do not invent a component when COMPONENTS.md already covers the case.
- Do not exceed the motion intensity in 7 Motion without a stated reason.
- Do not use a Konsta component for a content-surface job (cards, tables, forms) or a shadcn component for a chrome job (tab bar, sheets, nav). Check the §12 ownership map first.
- Do not introduce a second icon package because "this one icon looks better." One icon library per project.
- Do not work around a library boundary by wrapping a component from the wrong library to "make it fit." Use the owning library's component or stop and ask.
- Do not invent chart colors — use the §13 series palette.
- Do not add a font. The stacks in 3 Type are the whole type system.

## 11 Components

Stack: chrome → Konsta UI (React) · content → shadcn + Radix · viz → Recharts · icons → Lucide.

Catalog: `docs/COMPONENTS.md` — seeded with the ownership map. Add a row when a primitive is adopted; every row names its owning library.

## 12 Component library stack

This project uses more than one component library. Each library owns specific surfaces. The boundary is deliberate: it is cheaper than hand-building native patterns on shadcn and cheaper than hand-building data components on Konsta. Cross it and both savings disappear.

**Declared stack:**

| Role | Library |
|---|---|
| Chrome — shell, nav, overlays, native patterns | Konsta UI (React) |
| Content — cards, forms, data components | shadcn + Radix |
| Data visualization | Recharts |
| Icons | Lucide (`lucide-react`) — the only icon package |

**Ownership map:**

| Surface | Owner | Notes |
|---|---|---|
| App shell, tab bar, top navbars, page transitions | Konsta | |
| Action sheets, sheet modals, alerts, any overlay covering the screen | Konsta | One overlay system per screen — never nest overlay systems |
| Segmented controls, toggles, switches, grouped lists, swipeout rows | Konsta | |
| Content cards, forms, fields, data tables, comboboxes, badges, empty states | shadcn / Radix | Use Radix primitives, not Konsta, for these |
| Charts | Recharts | Wrap in shadcn-styled containers; chart colors come from tokens, never invented |

**Hard rules:**

1. Read this section before importing any component. Import each component from its owning library only.
2. Exactly one icon library. No second icon package, no emoji-as-icons.
3. Konsta owns all screen overlays. Never render a Radix Dialog/Popover/overlay inside a Konsta sheet, or a Konsta overlay inside a Radix one.
4. Library theme variables are derived via the §12.4 token bridge, never set. Konsta's `--k-*` variables and shadcn's theme variables are mapped from tokens.css by the hand-maintained bridge. Do not assign them in component files.
5. One Tailwind version across the app. Cascade order is declared explicitly with `@layer` in the entry CSS (preflight → tokens → konsta → shadcn → utilities). Never depend on import order for who wins.
6. Dark mode has one source of truth: the `:root` / `.light` blocks in tokens.css. Both libraries' dark variants derive from it. Never add a second dark-mode mechanism.
7. When a component exists in COMPONENTS.md, use it. The catalog's Library column tells you which import to use.

### 12.4 Token bridge

Konsta's `--k-*` variables and shadcn's theme variables are derived from tokens.css by a hand-maintained mapping — not by codegen. The mapping lives in the theme files (`packages/ui/src/styles/theme.css` and the Konsta theme setup), is written once during conversion, and is read-only after that.

**Contract:**
1. Every `--k-color-*` assignment and every shadcn theme var assignment must reference a Vanyshr token (`var(--color-…)`, `var(--space-…)`). No literal values in the bridge — a literal here is a 10a violation.
2. Konsta side (verified against konsta 5.4.0): theming via Tailwind v4 `@theme`; color vars follow `--k-color-*` (`--k-color-primary`, `--k-color-md-light-*`, `--k-color-md-dark-*`), plugin at `konsta/plugin-colors.js`.
3. shadcn side: confirm the exact theme var names against `packages/ui/src/styles/theme.css` during conversion and record them in the value table.
4. One theme toggle only: the `.light` class on the root element switches the whole app to light mode. Do not use Tailwind's `dark:` variant, `prefers-color-scheme` queries, or any library `dark` prop as a styling mechanism — both libraries' light/dark variants derive from the same toggle.
5. Dark is the default (`:root`). The `.light` block overrides the same names. Never add a second dark-mode mechanism (10a).

**Value table:** the token-by-token table (which Vanyshr token feeds which `--k-*` / shadcn var) is completed during conversion against the real theme files and kept with them — the bible holds this contract, not the table.

**Fallback:** on simple pages with no dense data (marketing-style screens), Konsta alone is acceptable. The split above is the default for app screens.

## 13 Charts & data

- Categorical series palette, in order: `--color-primary`, `--color-accent`, `--color-status-success`, `--color-status-warn`, `--color-status-info`, `--color-secondary`. Cycle the palette; never invent a series color.
- Single-metric / sequential: `--color-primary` with `--color-primary-muted` fills.
- Status-colored data (gains, losses, alerts) uses the status tokens — never raw red/green hex.
- Chart text: `--size-caption` / `--size-data`, `--color-text-secondary`. Gridlines and axes: `--color-border-subtle`.
- Containers: shadcn Card on `--color-bg-surface`; tooltips on `--color-bg-elevated` with `--shadow-2`.

## 14 Forms (content)

- Fields: min-height 44px, `--radius-md`, `--color-border`, `--color-bg-surface` fill.
- Labels: `--size-label`, `--color-text-secondary`, above the field. Every field gets a Label — never placeholder-as-label.
- Errors: `--size-caption`, `--color-status-danger`, below the field; the field border goes `--color-status-danger`.
- Focus: the §9 focus ring. Required fields mark with `--color-status-danger` asterisk and `aria-required`.
- 2–4 mutually exclusive options: Konsta Segmented (§12), not a Select. 5+ options: shadcn Select.
