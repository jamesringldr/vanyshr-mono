# pilot-scan Flow

## What
Create a pilot-scan flow variant that tests NPD scraper integration, new views, and reorganized onboarding before rolling changes into the baseline quickscan flow.

## Why
- **NPD Integration**: Validate the newly added NPD scraper in production conditions
- **UX Improvements**: Test new views and reorganized onboarding with pilot users
- **Risk Isolation**: Keep baseline stable while experimenting with enhancements

## How (Development)
1. Read `CLAUDE.md` for targeted context (goal, success criteria, scope)
2. Read `CLAUDE-app.md` once for app architecture overview
3. Check `feature_roadmap.md` for detailed work breakdown
4. Implement in `src/`, test in `tests/`
5. Log decisions in `journal.md` as you go
6. Update `feature_roadmap.md` with progress

## Integration (when ready)
When the pilot-scan flow is ready to integrate:
1. Merge database schema changes (flow_type column, if needed)
2. Wire scraper orchestration logic (conditional NPD inclusion)
3. Route pilot flow in frontend pages
4. Test end-to-end in staging (Vercel preview)
5. See `feature_roadmap.md` → "Integration Checklist" for full checklist

## Status
**Not started** — Ready for implementation

---

## Quick Reference

**Goal**: NPD integration + new views + reorganized onboarding
**Scope**: Scraper orchestration, onboarding UI, new result views
**Key files**: 
- `packages/services/orchestration/` — scraper sequencing
- `apps/app/src/pages/` — flow pages & onboarding
- `apps/app/src/components/` — new result views
- `supabase/migrations/` — schema updates

**See also**: `journal.md` for decisions, `feature_roadmap.md` for tasks
