# QS Search Sequence Flow Redesign

## What
Streamline the quickscan user flow to reduce interaction steps, improve result clarity, and create a cleaner overall UX.

## Why
Current users experience friction in the search flow due to unnecessary steps and unclear result presentation. Optimizing this flow improves user satisfaction and conversion rates.

## How (Development)
1. Read `CLAUDE.md` for targeted context
2. Read `CLAUDE-app.md` once for app architecture
3. Check `feature_roadmap.md` for work breakdown
4. Design improved flow in `src/`, create mockups or wireframes as needed
5. Implement in apps/app and packages/services/orchestration as appropriate
6. Test with end-to-end flow validation
7. Log decisions in `journal.md` as you go
8. Update `feature_roadmap.md` with progress

## Integration (when ready)
See `feature_roadmap.md` → "Integration Checklist"

## Status
Not started on this flow's own scope — but see `journal.md` (2026-08-08): backend orchestration/matching groundwork already exists on `dev/quickscan-search-ui` (unmerged).

## Quick Reference
- **Mockups/Design**: `src/` (design docs, wireframes)
- **Implementation**: `src/` (React components, orchestration changes)
- **Tests**: `tests/` (flow tests, integration tests)
- **Decisions**: `journal.md` (append-only log)
