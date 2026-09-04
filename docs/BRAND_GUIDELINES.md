# Vanyshr Brand Guidelines

*Last Updated: September 4, 2026*
*Version: 6.0 — Brick Neutral / Signal Blue (Dark Mode Only)*

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

## Enforcement

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
