# Vanyshr Brand Guidelines

*Last Updated: September 12, 2026*
*Version: 6.1 — Brick Neutral / Signal Blue (Dark Mode Only)*

> **Source of truth:** `packages/ui/src/styles/theme.css` defines every color
> value used in the app. This doc describes and explains those tokens — it
> does not restate hex as if it were independently authoritative. If this
> doc and `theme.css` ever disagree, `theme.css` is right; file a fix here.
>
> A pre-commit hook (`.githooks/pre-commit`, wired via `core.hooksPath`)
> blocks new hardcoded hex/Tailwind-arbitrary-value colors (`bg-[#...]`)
> outside `theme.css` — use a token class instead. See "Enforcement" below.

---

## Design philosophy

Stated once, applies everywhere: **brick neutrals with signal blue as the
single brand accent.** One brand hue, not a multi-color system. Status is
communicated with outline chips, never filled backgrounds. Borders are
hairline white-on-dark (`10%` opacity), not solid gray panels.

Previous versions of this doc (v5.0 and earlier) described a "Deep Navy"
palette (`#0B1B2B` background, `#112538` surfaces). That palette is
retired — v6.0 replaces it everywhere it was implemented.

### Composition archetype

One line, before any token: this is a **single-column, mobile-first
application shell** — not a marketing grid. `sm:`/`md:` are the only
breakpoints in real use across `apps/app` (no `lg:`/`xl:` usage found in the
actual pages); don't design against a desktop-grid mental model. Content
width is the app-shell container, not full-bleed. Framing is flat —
hairline borders and elevation steps (§ Color Palette → Neutrals), not
glass/blur/skeuomorphic surfaces.

---

## Color Palette

### Brand — single accent

| Token (`theme.css`) | Value | Role |
|---|---|---|
| `--color-brand-500` | `#14ABFE` | Resting state — buttons, links, CTAs, focus rings |
| `--color-brand-600` | `#0B8FD9` | Hover/pressed state (darkens on hover, not brightens) |
| `--color-brand-ink` | `#1A1A1A` | Text/icon color for content sitting on the solid brand fill |
| `--color-navy-hero` | `#0A1628` | Reserved — hero-only surface, not a general background |

Full `--color-brand-25` … `--color-brand-950` scale exists in `theme.css`
(tint/shade of the same hue) for components that need more than these two
steps — e.g. filled badges. Prefer resting/hover/ink above for anything new.

### Neutrals — collapsed anchors, not an interpolated ramp

| Token | Value | Role |
|---|---|---|
| `--color-gray-950` | `#1E1E1E` | Deepest panel / sidebar background |
| `--color-gray-900` | `#282828` | Page background — the base |
| `--color-gray-800` | `#333333` | Card / control background |
| `--color-gray-700`/`600` | `#404040` | Elevated surface, hover-lightened cards |
| `--color-gray-300`/`400`/`500` | `#A3A3A3` | Secondary/tertiary/muted text — deliberately the same value |
| `--color-gray-100`/`200` | `#E0DEDC` | Rare warm off-white text — use sparingly |
| `--color-white` / `--color-gray-25`/`50` | `#FFFFFF` | Primary text |

These are **collapsed on purpose** — the 12 named Tailwind steps (`gray-25`
… `gray-950`) exist for class-name compatibility, but several share the
same literal value rather than forming a smooth ramp. Don't expect
`gray-400` to look different from `gray-300`; they're intentionally equal.

### Semantic

| Token | Value | Role |
|---|---|---|
| `--color-success-500` | `#3DDC97` | Confirmed / positive states |
| `--color-warning-500` | `#FF5E1F` | Warning **and** general accent — the guide gives one non-brand hue for both |
| `--color-error-500` | `#E5484D` | Errors, destructive actions |

Full 12-step scales exist for each (tint/shade of the base, derived — not
independently specified) for components needing more than the base step.

### Borders

Hairline, used pervasively: `rgb(255 255 255 / 0.10)` (`--color-border-primary`
and friends). Not a solid gray. Disabled borders drop to `0.06` opacity.

### App-shell flat tokens

Page-level code in `apps/app` (self-scan, pilot-scan, auth, onboarding)
reaches for a flatter, shorter vocabulary rather than the full Untitled-UI-
derived names above. These live in `theme.css`'s "APP-SHELL TOKENS" section
as aliases onto the primitives above — same values, different, shorter names:

| Class | Aliases to |
|---|---|
| `bg-bg-page` / `text-text-primary` | `--color-gray-900` / `--color-white` |
| `bg-bg-surface` / `bg-bg-surface-secondary` | `--color-gray-800` / `--color-gray-700` |
| `bg-accent-primary` / `bg-accent-hover` | `--color-brand-500` / `--color-brand-600` |
| `text-text-secondary` / `text-text-tertiary` | `--color-gray-300` (same value, different name for the role) |
| `border-border-subtle` | `--color-border-primary` |
| `bg-success` / `bg-warning` / `bg-error` | `--color-success-500` / `--color-warning-500` / `--color-error-500` |
| `bg-disabled` | `--color-gray-700` |
| `text-brand-ink` | `--color-brand-ink` |

`packages/ui/src/styles/globals.css`'s plain `:root` vars (`var(--bg-page)`,
etc. — for code that isn't using a Tailwind class) are aliases onto these
same tokens, not independent values.

---

## Component rules

- **Status chips are outline-only, never filled.** This is a stated rule,
  not a style preference. `badges.tsx`/`badge-groups.tsx`/`featured-icon.tsx`
  still use filled brand-tint badges from the old system — known debt, not
  yet fixed.
- **Primary buttons**: `bg-accent-primary` at rest, `hover:bg-accent-hover`
  on hover (darkens, doesn't brighten), text/icon in `text-brand-ink`
  (dark ink on the bright fill — not white).
- **Secondary buttons**: dark surface (`bg-bg-surface`, hover
  `bg-bg-surface-secondary`), white text. Not a light/white pill — that
  was a leftover from the old system and has been converted where found.

---

## Component library

**BoardUI is the required component source going forward — structure only.**
Migration happens page-by-page, in place, as each page gets touched; there's
no separate bulk-migration effort. Live catalog of what's actually been
adopted: `docs/COMPONENTS.md` — update it as each page migrates. The
existing `packages/ui/src/components` tree is the legacy set being
replaced, not a reference for how a component should look.

- **Workflow**: before hand-building any component, check
  `mcp__boardui__list_components`. Read source/props with `get_component`,
  get a working snippet with `get_usage_examples`, then write it in with
  `install_components`. The installed `boardui` agent skill (`Skill` tool)
  carries the full catalog, theming, and page patterns for deeper reference.
- **Colors stay ours — the one rule that matters.** BoardUI ships its own
  opinionated palette/typography/shadows (its own `theme.css`). Do not
  install that. Restyle every BoardUI component against *this* doc's token
  classes (`bg-bg-page`, `text-accent-primary`, `border-border-subtle`,
  etc.) instead of BoardUI's own semantic tokens
  (`bg-background-primary-default`, `text-text-primary`, etc.). BoardUI is
  adopted for structure/variants/accessibility (React Aria, `cva`-driven
  variants) — never for its color system. (A full palette swap was
  trial-run on 2026-09-10 and reverted — see `packages/ui/src/styles/theme.css`
  git history around commit `ade0abe` if curious why this rule exists.)
- **Icons stay Tabler — same override pattern as color.** BoardUI's usage
  examples show `@remixicon/react`; swap to `@tabler/icons-react` on
  install. See "Icons" below.
- **Why BoardUI**: mitigates component variation drift — the original
  problem — without a CLI step (installs straight from the MCP connection)
  and it's Tailwind v4-native, matching this stack exactly.

---

## Typography

### Font families

| Role | Family | Used for |
|---|---|---|
| Interface | **IBM Plex Sans** | Display, title, heading, body — all general UI text |
| Labels / data | **IBM Plex Mono** | Field labels, data values, record IDs, captions |
| Terminal / log output | **Space Grotesk**, lowercase | Reserved — status-log-style lines only, not general UI |

> **Not yet applied to code.** `theme.css` still declares `--font-body` /
> `--font-display` as Ubuntu — this table describes the target from the
> design guide; the font migration is a separate, not-yet-started phase.

### Type scale (target, from the design guide)

| Role | Size / weight / tracking |
|---|---|
| Display | 40px · 600 · `-0.03em` · line-height 1.05 |
| Title | 28px · 600 · `-0.02em` |
| Heading | 18px · 600 |
| Body | 15px · 400 · line-height 1.6 |
| Caption | 13px · 400 · muted |
| Label (mono) | 11px · uppercase · `0.14em` tracking |
| Data (mono) | 14px · 500 |

---

## Spacing System

Unchanged from v5.0 — still current.

### Base Unit
All spacing uses a **4px base unit**. All values are multiples of 4.

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

---

## Layout

Single-column app shell, mobile-first. Confirmed against real usage in
`apps/app/src` — `sm:` accounts for the large majority of responsive
prefixes in use, `md:` a smaller remainder, and `lg:`/`xl:`/`2xl:` are not
used anywhere in current pages. Don't introduce a desktop-grid layout
without checking this is still true.

| Token (`theme.css`) | Value | Role |
|---|---|---|
| `--breakpoint-xxs` | `320px` | Smallest supported viewport |
| `--breakpoint-xs` | `600px` | Must stay matched to Sonner's own breakpoint (see `theme.css` comment) |
| `sm` (Tailwind default) | `640px` | Primary responsive breakpoint — most `sm:` usage in the app targets this |
| `md` (Tailwind default) | `768px` | Secondary breakpoint — used sparingly |
| `--max-width-container` | `1280px` | Container cap where one applies |

- **lg/xl/2xl are declared by Tailwind's defaults but not exercised anywhere
  in `apps/app` today.** Don't design a component that only looks right at
  those widths — this is a mobile/tablet-first product.
- **No custom grid system.** Layout is flex/stack-based (single column,
  occasionally two-up at `sm:`/`md:`), not a named column grid.

---

## Icons

**`@tabler/icons-react`** ([tabler/tabler-icons](https://github.com/tabler/tabler-icons))
is the icon set going forward — a deliberate switch away from the app's
current `@untitledui/icons`/`@appica/icons-react` mix, adopted alongside the
BoardUI migration. Outline/stroke-based icons, default 24px, `stroke-width`
prop for weight (default `2`) — a different rendering model than Untitled
UI's filled/mixed set, so icons aren't a drop-in swap; treat replacement as
part of each page's migration pass, not a global find-replace.

**Overrides BoardUI's own default.** BoardUI's own convention ships icons
from `@remixicon/react` — same override pattern already established for
color (BRAND_GUIDELINES → Component library: use BoardUI for structure,
never its own token/icon defaults). Install `@tabler/icons-react`
alongside BoardUI's components and use Tabler icons in place of whatever
icon BoardUI's usage examples show.

### Sizing scale

| Token | Size | Usage |
|---|---|---|
| `sm` | 16px | `<IconName size={16} />` |
| `md` | 20px | `<IconName size={20} />` |
| `lg` | 24px | `<IconName size={24} />` (Tabler's own default) |
| `xl` | 28px | `<IconName size={28} />` |

Not yet wired to a CSS attribute-selector pattern (the old `data-icon`
trick was specific to Untitled UI's icon components) — whoever migrates a
page's icons first should decide whether to keep sizing via the `size` prop
directly or introduce an equivalent wrapper convention, and note the
decision here.

---

## Motion

**Motion intensity: subtle.** Confirmed by usage — `transition-colors`
(139 occurrences) overwhelmingly dominates every other transition property
combined; `transition-transform` appears only 6 times across the codebase.
Default to a color/background transition for any new interactive state;
treat a transform/scale-based hover as the exception, not the norm.

| Aspect | Value | Where |
|---|---|---|
| Dominant durations | `100ms`, `150ms`, `200ms` | Buttons use `duration-100`; most other components cluster at `150`/`200` |
| Dominant easing | `ease-linear` (buttons), `ease-out`/`ease-in-out` elsewhere | See `button.tsx` for the linear pattern; don't mix easings within one component family |
| Hover-property taxonomy | **color, background, shadow** — not transform/scale | `transition-colors` is the default; reach for `transition-all` only when multiple color-adjacent properties change together |
| Scroll-driven reveals | Not currently used in `apps/app` | If added, name the technique here so a second, competing pattern doesn't get introduced later |
| Reduced motion | Not yet audited | Flagged as open — see Known debt |

---

## States

Pattern taken directly from `button.tsx` / `button-utility.tsx` — the most
mature state implementation in the codebase. New interactive components
should match this, not invent their own:

| State | Pattern |
|---|---|
| Hover | Color/background shift via `hover:bg-*_hover` / `hover:text-*_hover` tokens — never a transform |
| Focus | `focus-visible:outline-2 focus-visible:outline-offset-2`, outline color from `outline-brand` / `outline-focus-ring` — always `focus-visible`, never bare `focus:` (keyboard-only ring) |
| Disabled | `disabled:cursor-not-allowed` + `disabled:text-fg-disabled` (or `_subtle` for icons) + `disabled:bg-disabled` + `disabled:shadow-xs` + `disabled:ring-disabled_subtle` — all five, not a partial subset |
| Loading | No established pattern yet — see `loading-indicator` component for the closest existing primitive; don't invent a new spinner style |
| Error | Border/text switch to `error` tokens (`--color-error-*`) — see Color Palette → Semantic |

---

## Enforcement

### Mechanical (hook-enforced)

1. **`theme.css` is the only file allowed to define a raw color value.**
   Everything else (`globals.css`, `index.css`, component code) references
   a token — never a literal hex.
2. **A pre-commit hook enforces this mechanically.** `.githooks/pre-commit`
   (wired via `git config core.hooksPath .githooks`, applies to every
   worktree of this repo) scans the *added* lines of a staged diff for
   Tailwind arbitrary-value hex (`bg-[#...]`, `text-[#...]`, etc.) outside
   `theme.css` and blocks the commit if it finds one. Pre-existing hex debt
   elsewhere in the repo is grandfathered — it only stops *new* violations.
   Genuine one-off exception (e.g. an SVG `fill` prop that isn't a Tailwind
   class)? `DESIGN_TOKEN_OVERRIDE=1 git commit ...`
3. **This doc explains the tokens; it doesn't replace them.** When the
   palette changes, update `theme.css` first, then this doc to match —
   never the reverse.

### Judgment (agent self-checked — no hook can catch these)

- Don't introduce a new accent color outside brand/semantic without a
  genuine new semantic state to justify it.
- Don't reach for `transition-all`/transform-based hovers by default — this
  system is subtle-intensity, color/background first (see Motion).
- Don't invent a new component when an existing one in `packages/ui`
  already covers the case with a different prop/variant — check
  `mcp__boardui__list_components` and the existing `base`/`application`
  directories first.
- Don't build a new interactive component's disabled/focus/hover states
  from scratch — match the pattern in `button.tsx` (see States).

---

## Known debt (not yet fixed)

- ~96 files across `apps/app`/`packages/ui` still have hardcoded hex
  predating this system (grandfathered by the pre-commit hook — new
  violations are blocked, these aren't retroactively flagged).
  Concentrated in `AdminInviteGate.tsx`, `BetaModal.tsx`, most of
  onboarding/auth/pricing pages.
- Filled status badges (`badges.tsx`, `badge-groups.tsx`,
  `featured-icon.tsx`) conflict with the "outline only" rule.
- Font migration to IBM Plex Sans/Mono + Space Grotesk not started —
  `theme.css` still declares Ubuntu.
- `--color-alpha-white`/`--color-alpha-black` and ~0 remaining unused hue
  scales were removed from `theme.css` in the v6.0 rework; if a future
  need for a multi-hue palette (charts, integrations icons) comes up,
  re-add scales deliberately rather than reviving the old blanket set.
- `prefers-reduced-motion` has not been audited anywhere in the codebase —
  open, not yet scoped.
- No loading-state convention beyond the existing `loading-indicator`
  primitive — spinners/skeletons haven't been standardized.
- A stray `--color-scratch-test: rgb(1 2 3);` sat outside the `@theme{}`
  block in `theme.css` (invalid top-level CSS) — fixed in this doc's pass
  (2026-09-12), but the same line is still live in `staging`/`main` as of
  this writing since this worktree hasn't merged back yet.
