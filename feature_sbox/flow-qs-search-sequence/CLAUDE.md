# flow: qs-search-sequence

## Goal
Optimize the quickscan user search flow to reduce friction and improve clarity in the search experience.

## Rationale
Users experience unnecessary steps or delays in the current quickscan search flow. This redesign reduces friction, improves clarity, and increases conversion by streamlining the interaction model and presenting results more effectively.

## Success Criteria
- [ ] Reduce user interaction steps to accomplish a quickscan search (fewer clicks/inputs)
- [ ] Improve result clarity and presentation (actionable, scannable format)
- [ ] Create a cleaner, more intuitive overall UX
- [ ] Validate flow with user testing or feedback loop

## Scope
- **What changes**: User-facing search flow in `apps/app/` + search orchestration coordination in `packages/services/orchestration/`
- **Key files to modify/create**: 
  - Frontend: `apps/app/src/pages/search`, `apps/app/src/components/SearchFlow/`
  - Backend: `packages/services/orchestration/` (if orchestration logic changes)
  - (will be updated as work progresses)
- **Dependencies**: Existing search orchestration, result aggregation service, Trigger.dev workflows
- **Related work**: [[quickscan-orchestration]] (see memory for progress on parallel orchestration improvements)

## Current Status
[Not started, but groundwork exists] — see `journal.md` (2026-08-08 entry). Backend orchestration + matching logic for this flow was already built and tested on `dev/quickscan-search-ui` (unmerged, parked). Pull that branch forward before implementing Phase 2 from scratch.

## Blockers / Notes
- `dev/quickscan-search-ui` predates recent `staging` changes and will need rebasing before reuse.

---

See `CLAUDE-app.md` for holistic app context and architecture.
See `feature_roadmap.md` for task breakdown and integration checklist.
See `journal.md` for decision log.
