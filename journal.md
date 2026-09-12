# Worktree Journal

## Purpose
Redefine the app's design system and create a design bible with hard guardrails so future agents build consistently within the established visual language.

## Punchlist
- [x] Audit current UI — colors/typography/spacing already captured in BRAND_GUIDELINES.md v5.0/v6.0 (pre-dates this journal's tracking)
- [x] Define brand tokens (color palette, typography scale, spacing) — v6.0, `theme.css`
- [x] Add radius, motion, layout, icon, and states tokens/sections (this pass, 2026-09-12) — previously undocumented despite being enforced/used in code
- [x] Write design principles — "Design philosophy" + new "Composition archetype" (this pass)
- [ ] Codify component rules (do/don't for each pattern in use) — button rules exist; broader pass pending BoardUI migration
- [x] Write the Design Bible doc — `docs/BRAND_GUIDELINES.md` (this repo uses that name, not `DESIGN_BIBLE.md`)
- [x] Create agent-facing guardrails file — `CLAUDE.md` § Component Library, plus `.githooks/pre-commit` design-token guard (mechanical enforcement)
- [ ] Add visual reference / Figma/Artifact link to the bible — not yet done
- [ ] Validate: walk through an existing screen and confirm every element maps to a token — pending page-by-page migration

## Notes

**2026-09-12 — Playbook-driven pass, docs only, no app code touched.**
Cross-referenced against `Vanyshr-mono` (production/staging) to ground new
sections in real usage rather than invented defaults:
- Confirmed `theme.css` is currently byte-identical between this worktree
  and `staging` — no drift yet.
- Found and fixed a stray `--color-scratch-test: rgb(1 2 3);` sitting
  outside the `@theme{}` block in `theme.css` (invalid top-level CSS). This
  same line is still live in `staging`/`main` — needs the same fix when
  this branch merges back.
- Fixed a stale doc reference in `.githooks/pre-commit` (pointed at a
  `design.md` that doesn't exist; corrected to `docs/BRAND_GUIDELINES.md`).
- Added missing BRAND_GUIDELINES.md sections grounded in real code:
  Layout (confirmed `sm:`/`md:` are the only breakpoints actually used in
  `apps/app` — no `lg:`/`xl:` usage found), Motion (confirmed
  `transition-colors` dominates 139:6 over `transition-transform` — motion
  intensity is "subtle" by evidence, not assertion), States (pattern lifted
  directly from `button.tsx`'s focus/disabled/hover implementation).
- Anti-patterns split into mechanical (hook-enforced) vs. judgment
  (agent-self-checked, not regex-able) tiers, per the updated
  `DesignBiblePlaybook.md` (`design-sandbox/docs/`).
- **Icon library changed mid-session: `@untitledui/icons` → `@tabler/icons-react`**
  (user decision, https://github.com/tabler/tabler-icons). This also
  overrides BoardUI's own default icon set (`@remixicon/react`) — same
  override pattern already established for color. Documented in both
  BRAND_GUIDELINES.md and CLAUDE.md. Not yet installed or used anywhere in
  the app — sizing/wiring convention is an open question logged in
  `docs/COMPONENTS.md`.
- Created `docs/COMPONENTS.md` — explicitly **not** an inventory of the
  existing `packages/ui` components (that tree is legacy, being replaced,
  not a reference). It's a page-by-page BoardUI adoption tracker, currently
  empty by design. User will migrate pages manually, one at a time, against
  the updated BRAND_GUIDELINES.md — this session does not touch app code.
- Deferred, tracked as follow-up: patch `frontend-engineer`/`role-frontend-engineer`
  in the Maiztro library with a bail-if-no-design-doc gate — that's a
  one-time change at the library level, not scoped to this worktree.
