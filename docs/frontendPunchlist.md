# Frontend punchlist — Vanyshr self-scan flow

_Living document maintained by `frontend-auditor`. Resolved by `frontend-engineer`. Human-set statuses (`in-progress`, `wont-fix`, `false-positive`, `deferred`) are never overwritten by re-runs._

- **Last audit**: 2026-09-05
- **Surface**: web (React + Vite + TailwindCSS v4)
- **Evidence**: source-only (no running UI)
- **Design source of truth**: `docs/BRAND_GUIDELINES.md` + `packages/ui/src/styles/theme.css`
- **Scope**: `/self-scan` entry → splash → loading → `/self-scan/report`

## Status legend
- `open` — auditor-identified, not yet acted on
- `in-progress` — engineer is working it
- `resolved` — implemented and verified
- `wont-fix` — accepted, human rationale required
- `false-positive` — not a real tell, human rationale required
- `deferred` — real, not this pass

---

## Open

## In progress

## Resolved

### [P1] [HIGH] Primary CTA text color overridden to `text-white` — brand spec requires `text-brand-ink` — `id: FEA-002`
- **Status**: resolved-per-spec-change
- **Tell**: tokens
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/entry.tsx:160`
- **What's wrong**: `scanUi.primaryBtn` (defined in `chrome.ts`) correctly sets `text-brand-ink` (#1A1A1A) on `bg-accent-primary` (#14ABFE). The call site at `entry.tsx:160` appends `text-white`, overriding brand-ink with white — yielding ~2.5:1 contrast on the brand fill (WCAG AA minimum is 4.5:1). The brand-ink spec gives ~6.9:1.
- **Rationale**: The entry page CTA ("Scan now") is the highest-leverage button in the self-scan funnel. White text on a bright blue button is both off-brand and a contrast failure. A broken CTA on the first screen reads as unprofessional before any data processing begins.
- **Directions**: Remove `text-white` from `entry.tsx:160`. The `scanUi.primaryBtn` class already sets the correct `text-brand-ink`; nothing else needed. Verify that `text-brand-ink` renders as dark ink on the button in browser.
- **Resolution** (2026-09-29): White labels on accent buttons accepted 2026-09-25.
- **Date identified**: 2026-09-05
- **Notes**: `chrome.ts:scanUi.primaryBtn` is correct — the bug is the override at the call site.

---

### [P1] [HIGH] Report "Start Vanyshing" CTA and error-state "Start over" button use `text-white` on `bg-accent-primary` — `id: FEA-003`
- **Status**: resolved-per-spec-change
- **Tell**: tokens
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/report.tsx:108,224`
- **What's wrong**: Two separate buttons on the report page — the error-state "Start over" link (`:108`) and the primary "Start Vanyshing" CTA (`:224`) — both apply `text-white` directly on `bg-accent-primary`. Same 2.5:1 contrast failure as FEA-002, plus neither uses `scanUi.primaryBtn` so they're outside the design system entirely.
- **Rationale**: The report page CTA is the payoff of the entire scan funnel — "Start Vanyshing" is the conversion point. An off-brand, low-contrast button here directly undermines trust at the moment the user is deciding to sign up.
- **Directions**: (1) For the "Start Vanyshing" button at `:224`: replace the bespoke class string with `scanUi.primaryBtn` from `chrome.ts` (add `import { scanUi } from "./chrome"`). Remove `text-white`. The rounded corner may need adjusting — see FEA-004. (2) For the error-state "Start over" at `:108`: same — use `scanUi.primaryBtn` (or `scanUi.secondaryBtn` if the error state warrants lower emphasis). Remove `text-white`.
- **Resolution** (2026-09-29): White labels on accent buttons accepted 2026-09-25.
- **Date identified**: 2026-09-05

---

### [P1] [HIGH] Report page menu button has `outline-none` with no focus-visible ring — `id: FEA-004`
- **Status**: resolved
- **Tell**: states
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/report.tsx:135`
- **What's wrong**: The header menu button at `:135` sets `outline-none` and only has `hover:bg-white/10`. There is no `focus-visible:` style. Keyboard users navigating the report page cannot see focus on this control — it is the only persistent navigation element in the entire report view.
- **Rationale**: Removing focus without replacement is an accessibility failure. For a privacy-focused product whose users may be security-conscious (and more likely to use keyboard navigation), this is also a trust tell.
- **Directions**: Add `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary` to the button's class. Remove the bare `outline-none` (or replace with `focus:outline-none` so the browser default only suppresses on click, not on keyboard). Match the pattern already in `scanUi.ghostBtn`.
- **Date identified**: 2026-09-05
- **Notes**: `scanUi.ghostBtn` in `chrome.ts` already has the correct pattern — the report.tsx menu button predates `chrome.ts` and wasn't updated.

---

### [P1] [MEDIUM] Primary button missing `active:` (pressed) state — `id: FEA-005`
- **Status**: resolved-by-this-change
- **Tell**: states
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/chrome.ts:8-15` (scanUi.primaryBtn definition)
- **What's wrong**: `scanUi.primaryBtn` defines hover, focus-visible, and disabled states but no `active:` state. On tap/click, the button gives no physical feedback before the action fires. On mobile (the primary surface for self-scan), there is zero visual confirmation the tap registered.
- **Rationale**: A non-responding primary button reads as broken, especially on mobile. This is particularly damaging on the "Scan now" button — users tap it to start the scan and see nothing change until the drawer animates up.
- **Directions**: Add `active:scale-[0.97] active:bg-accent-hover` to `scanUi.primaryBtn` in `chrome.ts`. The scale creates the physical feel; the color reinforces it. Apply similarly to `scanUi.secondaryBtn`.
- **Resolution** (2026-09-29): Resolved by this change: `active:scale-[0.97] active:bg-accent-hover` added to `scanUi.primaryBtn` and `scanUi.secondaryBtn`.
- **Date identified**: 2026-09-05

---

### [P2] [HIGH] Mixed radii on report page — four distinct values with no documented roles — `id: FEA-006`
- **Status**: resolved
- **Tell**: radius
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/report.tsx:108,211,224`; `apps/app/src/pages/self-scan/chrome.ts:8` (scanUi.primaryBtn)
- **What's wrong**: The report page uses at least four distinct corner radii on interactive/container elements with no documented role differentiation:
  - `rounded-lg` (8px) — `scanUi.primaryBtn` spec (the correct control radius)
  - `rounded-xl` (12px) — error-state "Start over" button (`:108`)
  - `rounded-2xl` (16px) — "Start Vanyshing" CTA button (`:224`)
  - `rounded-t-[28px]` (28px, **arbitrary value**) — CTA footer container (`:211`)
  All four appear in the same page. `BRAND_GUIDELINES.md` does not document a radius role scale — it's implied by the token system but not stated.
- **Rationale**: Inconsistent radii read as unfinished. The most damaging mix here is the CTA button (`rounded-2xl`) differing from the standard button radius (`rounded-lg`) — they appear on the same page, making one look like a design mistake vs the other.
- **Directions**: (1) Replace `rounded-2xl` on the "Start Vanyshing" button (`:224`) with `rounded-lg` to match `scanUi.primaryBtn`. (2) Replace `rounded-xl` on the error-state "Start over" button (`:108`) with `rounded-lg`. (3) Replace `rounded-t-[28px]` on the footer container (`:211`) with `rounded-t-2xl` (16px) — the container and button don't need to share a radius, but the container should use a named value from the scale, not an arbitrary. (4) File a one-line radius role table in `BRAND_GUIDELINES.md`: e.g. `control: rounded-lg (8px)`, `card: rounded-xl (12px)`, `sheet/drawer: rounded-t-2xl (16px)`.
- **Date identified**: 2026-09-05

---

### [P2] [MEDIUM] Report CTA footer shadow uses undocumented one-off rgba — `id: FEA-007`
- **Status**: resolved
- **Tell**: shadows
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/report.tsx:211`
- **What's wrong**: `shadow-[0_0_40px_rgba(20,171,254,0.18)]` — one-off arbitrary Tailwind shadow using a hardcoded hex that matches `--color-brand-500` (#14ABFE). Not a token, not in the shadow scale, not a named value.
- **Rationale**: The pre-commit hook only catches `bg-[#...]`/`text-[#...]`-style arbitrary colors — this slipped through as an rgba value in a shadow. It's the same drift the token system exists to prevent.
- **Directions**: Extract this as a CSS variable in `theme.css` — e.g. `--shadow-brand-glow: 0 0 40px color-mix(in srgb, var(--color-brand-500) 18%, transparent)` — then reference it with a Tailwind arbitrary shadow: `shadow-[var(--shadow-brand-glow)]`. Or declare it as a Tailwind shadow theme extension. Either way, the rgba value leaves the component file.
- **Date identified**: 2026-09-05

---

### [P2] [MEDIUM] `status-container.tsx` uses bare palette class `bg-gray-950` instead of a semantic alias — `id: FEA-008`
- **Status**: resolved-by-this-change
- **Tell**: tokens
- **Surface**: web
- **Location**: `apps/app/src/pages/self-scan/status-container.tsx:55`
- **What's wrong**: The status terminal card uses `bg-gray-950` directly. `BRAND_GUIDELINES.md` notes that `gray-950` is "Deepest panel / sidebar background" — a role, but without an app-shell semantic alias (the app-shell token set maps `bg-bg-page` → `gray-900`, with no `bg-bg-deepest` alias). This makes the card depend on the raw palette token rather than a semantic one.
- **Rationale**: Medium — `gray-950` is a documented palette token and not a hardcoded hex. But without a semantic alias, a future theme change that shifts the deepest surface value requires hunting all `bg-gray-950` usages rather than updating one token. Filing while it's one usage.
- **Directions**: Add `--bg-deepest: var(--color-gray-950)` to the app-shell tokens section of `packages/ui/src/styles/theme.css` and expose it as a Tailwind class `bg-bg-deepest`. Then replace `bg-gray-950` in `status-container.tsx:55` with `bg-bg-deepest`.
- **Resolution** (2026-09-29): Resolved by this change: added `--color-bg-deepest: var(--color-gray-950)` to theme.css (exposed as `bg-bg-deepest`) and replaced `bg-gray-950` at `status-container.tsx:76`.
- **Date identified**: 2026-09-05

## Won't fix / False positive / Deferred

### [SYS] [HIGH] Font family not migrated — code renders Ubuntu, brand spec targets IBM Plex — `id: FEA-001`
- **Status**: wont-fix
- **Tell**: font
- **Surface**: web
- **Location**: `packages/ui/src/styles/theme.css` (declares `--font-body: Ubuntu`); `apps/app/src/pages/self-scan/report.tsx:97,122` (`font-ubuntu` class explicit)
- **What's wrong**: `BRAND_GUIDELINES.md` v6.0 declares IBM Plex Sans (interface), IBM Plex Mono (labels/data), and Space Grotesk (terminal/log) as the three-family system. `theme.css` still declares Ubuntu as `--font-body`/`--font-display`. Every screen in the flow renders Ubuntu instead of the specified typeface. The brand doc itself acknowledges this as known debt and calls it a "not-yet-started phase."
- **Rationale**: Font is the loudest single trust signal after color. Ubuntu reads as a placeholder font — it is not IBM Plex. The mismatch between the spec and the rendered screen means every branded interaction is off-brand. Filing as SYS because it blocks every font-related engineering decision downstream.
- **Directions**: (1) Add IBM Plex Sans (weights 400 + 600) and IBM Plex Mono (weights 400 + 500) via `@fontsource` or a `<link>` to Google Fonts. (2) Update `--font-body` → `IBM Plex Sans` and `--font-display` → `IBM Plex Sans` in `theme.css`. (3) Add `--font-mono` → `IBM Plex Mono` in `theme.css` and wire it to the `.font-terminal` utility (currently Space Grotesk per `BRAND_GUIDELINES.md`; verify intent with James before changing). (4) Remove all `font-ubuntu` classes from `self-scan/report.tsx` — they override the theme and will need to be removed anyway once the CSS var is changed. Do not change fonts in `packages/ui` shared components without a broader sweep.
- **Resolution** (2026-09-29): Brand moved to system fonts; the IBM Plex migration no longer applies.
- **Date identified**: 2026-09-05
- **Notes**: `BRAND_GUIDELINES.md` explicitly documents this gap and confirms `theme.css` is the authority — the fix is in `theme.css` first, doc second.

## Recent annotations

_2026-09-05: Initial audit of self-scan flow (entry → splash → loading → report). Source-only evidence. 8 items filed. Font migration (FEA-001) is explicitly documented debt in BRAND_GUIDELINES.md — filing as SYS blocker because it affects every rendered screen._

_2026-09-29: Closed out all 8 items. FEA-001 won't fix (brand moved to system fonts). FEA-002/003 resolved per spec change (white labels accepted 2026-09-25). FEA-004/006/007 already resolved. FEA-005/008 resolved in this change._
