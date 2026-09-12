# Vanyshr Component Catalog

Tracks components as they're migrated to BoardUI, page by page. This is
**not** an inventory of the existing `packages/ui` components — those are
the legacy set being replaced, not the standard to build against. Full
policy: `docs/DESIGN.md` → §11 — Component Reference ("Component library"), §8 — Icons.

## Workflow (per component, per page)

1. Check `mcp__boardui__list_components` before hand-building anything.
2. Read the component's source/props via `mcp__boardui__get_component`, a
   working example via `mcp__boardui__get_usage_examples`.
3. Install with `mcp__boardui__install_components`.
4. Restyle: swap BoardUI's own semantic token classes for this repo's
   token classes (`bg-bg-page`, `text-accent-primary`, `border-border-subtle`,
   etc. — see `DESIGN.md` → §2 — Color Tokens). Never leave BoardUI's
   own `theme.css` tokens in place.
5. Swap any icon in the usage example from `@remixicon/react` to
   `@tabler/icons-react` (see `DESIGN.md` → §8 — Icons).
6. Add a row to the table below once the component is live somewhere in the app.

## Adopted components

| Component | BoardUI source name | Restyled tokens used | Page(s) live | Notes |
|---|---|---|---|---|
| _(none yet — this worktree is docs-only; app migration happens page by page, tracked here as it lands)_ | | | | |

## Legacy components (packages/ui) — being replaced, not extended

The existing `packages/ui/src/components` tree (`base/`, `application/`,
`foundations/`, `marketing/`, `onboarding/`, `animations/`) is the
pre-BoardUI component set. Don't add new components there and don't treat
it as a reference for how a component *should* look — it's what's being
migrated away from. It stays in place and functional until each page's
migration pass replaces what it uses.

## Open questions for whoever migrates the first page

- Icon sizing convention: keep sizing via Tabler's `size` prop directly, or
  introduce a wrapper/attribute convention (the old `data-icon` CSS-selector
  trick was Untitled-UI-specific and doesn't carry over automatically)?
  Decide once, document the answer here.
- Loading/skeleton pattern: BoardUI's own loading primitives vs. the
  existing `loading-indicator` component — pick one, note it here.
