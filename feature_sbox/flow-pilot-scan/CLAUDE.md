# flow: pilot-scan

## Goal
Create a pilot-scan flow variant that tests NPD scraper integration, new views, and reorganized onboarding sequence before merging into the baseline quickscan flow.

## Rationale
The baseline quickscan flow is stable and used by existing users. The pilot-scan flow allows us to:
1. Validate the newly added NPD scraper in production-like conditions
2. Test UX improvements (new views, reorganized onboarding) with pilot users
3. Gather metrics before rolling changes into the main flow

This isolates experimental changes from the critical baseline.

## Success Criteria
- [ ] NPD scraper integrated into pilot flow scraper sequence
- [ ] New views implemented and functional
- [ ] Onboarding sequence reorganized per spec
- [ ] Pilot flow routable from UI (separate from baseline)
- [ ] End-to-end pilot scan completes successfully
- [ ] Results aggregation works with NPD data
- [ ] Performance metrics captured and validated

## Scope
- **What changes**: 
  - Scraper orchestration sequence (add NPD to pipeline)
  - Onboarding UI/flow sequence (reorganize steps)
  - New result views (whatever the pilot views are)
  - Flow routing logic (distinguish pilot vs. baseline)
  
- **Key files to modify/create**: 
  - `packages/services/orchestration/` — scraper sequence logic
  - `apps/app/src/pages/` — pilot flow pages/views
  - `apps/app/src/components/` — new views/components
  - Flow state management (if needed)
  - Database: new `flow_type` column or similar to track pilot vs baseline

- **Dependencies**: 
  - NPD scraper service (packages/services/npd/ or similar)
  - Existing scraper infrastructure (FPS, ZabaSearch, etc.)
  - Supabase (schema updates if needed)
  
- **Related work**: 
  - Quickscan baseline flow (existing)
  - NPD scraper implementation (separate feature/backend work)

## Current Status
[Not started] Awaiting implementation

## Blockers / Notes
- Confirm NPD scraper is production-ready before integrating
- Clarify onboarding sequence changes (read from spec / existing docs)
- Define "new views" scope (dashboard? detail pages? filters?)

---

See `CLAUDE-app.md` for holistic app context and architecture.
See `feature_roadmap.md` for task breakdown and integration checklist.
See `journal.md` for decision log.
