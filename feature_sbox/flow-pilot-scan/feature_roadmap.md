# pilot-scan Flow — Roadmap & Progress

## Work Breakdown

### Phase 1: Research & Design
- [ ] Validate scraper sequence requirements
  - [ ] Review NPD scraper API / integration status
  - [ ] Confirm NPD results schema compatibility with existing `search_results` table
  - [ ] Identify any rate-limiting or dependency differences
  
- [ ] Define onboarding sequence changes
  - [ ] Document baseline onboarding steps (current state)
  - [ ] Specify new pilot onboarding sequence (what changes, in what order?)
  
- [ ] Define new views
  - [ ] List all new result views (dashboard? detail? filters? comparison?)
  - [ ] Sketch UI changes vs. baseline
  
- [ ] Database schema planning
  - [ ] Determine if `flow_type` column needed on `searches` table
  - [ ] Plan any new columns or tables for pilot-specific data
  - [ ] Design migration strategy (backward compatible)

### Phase 2: Implementation
- [ ] Database schema & migrations
  - [ ] Create migration file (supabase/migrations/)
  - [ ] Add `flow_type` column (if needed) with RLS policy updates
  - [ ] Test schema in local Supabase
  
- [ ] Scraper orchestration logic
  - [ ] Add NPD to scraper sequence for pilot flow
  - [ ] Implement flow_type conditional logic (baseline vs. pilot)
  - [ ] Handle NPD result aggregation & deduplication
  - [ ] Add error handling for NPD scraper failures
  
- [ ] Frontend pages & routing
  - [ ] Create/duplicate pilot flow pages (separate from baseline)
  - [ ] Add flow selection UI ("Choose: Baseline or Pilot")
  - [ ] Implement routing logic to route to correct flow
  
- [ ] Onboarding UI refactor
  - [ ] Implement new onboarding sequence for pilot flow
  - [ ] Add any new steps or reorder existing steps per spec
  - [ ] Ensure mobile responsiveness
  
- [ ] New result views implementation
  - [ ] Implement all new view components
  - [ ] Wire into pilot flow results page
  - [ ] Style with TailwindCSS + app design system
  
- [ ] Unit & integration tests
  - [ ] Test scraper orchestration (NPD included)
  - [ ] Test flow routing logic
  - [ ] Test onboarding sequence navigation
  - [ ] Test result view rendering with sample data

### Phase 3: Polish & Validation
- [ ] Error handling & edge cases
  - [ ] Handle NPD scraper timeout / failure gracefully
  - [ ] Fallback to baseline results if pilot flow fails
  - [ ] User-facing error messages
  
- [ ] Performance validation
  - [ ] Measure orchestration time (baseline vs. pilot with NPD)
  - [ ] Check for N+1 queries in new views
  - [ ] Monitor memory usage during large result sets
  
- [ ] Documentation
  - [ ] Add inline code comments for non-obvious decisions (flow_type logic, NPD dedup, etc.)
  - [ ] Document schema changes in migration comments
  - [ ] Update feature_roadmap.md with learnings
  
- [ ] Manual end-to-end validation
  - [ ] Test full pilot flow locally: search → onboarding → orchestration → new views → results
  - [ ] Test fallback (baseline) flow to ensure it's unaffected
  - [ ] Test on multiple devices (mobile/desktop)

### Phase 4: Integration & Deployment
- [ ] Code review preparation
  - [ ] Self-review: check CLAUDE.md scope against implementation
  - [ ] Verify no `any` types; types match `packages/shared`
  - [ ] Run `npm run type-check` locally
  
- [ ] Integration testing
  - [ ] Merge feature branch to `dev/pilot-scan`
  - [ ] Deploy to Vercel preview (staging branch)
  - [ ] Smoke test in preview environment
  
- [ ] Database & migrations
  - [ ] Verify migration runs cleanly in Supabase staging
  - [ ] Test RLS policies with pilot and baseline flows
  
- [ ] Merge & deployment
  - [ ] Create PR: `dev/pilot-scan` → `staging`
  - [ ] Get code review + approval
  - [ ] Merge to `staging` (Vercel preview auto-deploys)
  - [ ] Final validation in staging
  - [ ] When ready: merge `staging` → `main` (production) via git
  - [ ] Clean up: remove feature branch & worktree
  - [ ] Remove `feature_sbox/flow-pilot-scan/` directory

---

## Integration Checklist (Phase 4)
*Complete this when feature is solid and ready to wire into production.*

- [ ] **Code & types**: No `any` types; matches shared types in `packages/shared`
- [ ] **Tests**: All unit & integration tests pass locally (`npm run test`)
- [ ] **Type safety**: `npm run type-check` passes
- [ ] **Linting**: `npm run lint` passes
- [ ] **Database**: Migrations tested in local/staging; RLS policies validated
- [ ] **Dependencies**: No new external dependencies (or approved if necessary)
- [ ] **End-to-end**: Full pilot flow works in running app
- [ ] **Baseline isolation**: Baseline flow unaffected by changes
- [ ] **Performance**: Orchestration time acceptable; no N+1 queries
- [ ] **Mobile**: Works on mobile + desktop
- [ ] **Error handling**: Failures graceful; user-facing errors clear
- [ ] **Documentation**: Inline comments, migration notes, journal entries
- [ ] **Merge & cleanup**: 
  - [ ] Merge feature branch to staging
  - [ ] Delete feature worktree (if created)
  - [ ] Remove `feature_sbox/flow-pilot-scan/` directory
  - [ ] Update CHANGELOG.md (if applicable)

---

## Status Summary
**Phase**: Research & Design (awaiting spec clarification)
**Overall progress**: 0% [████░░░░░░] Not started
**Last updated**: 2026-08-08

### Next Steps
1. Clarify onboarding sequence spec (new steps vs. reordered steps)
2. Clarify new views scope (what exactly are the "different views"?)
3. Confirm NPD scraper readiness & integration requirements
4. Begin Phase 1 research

---

## Notes
For design decisions, blockers, and context, see `journal.md`.
For app architecture and integration points, see `CLAUDE-app.md`.
For targeted sandbox context, see `CLAUDE.md`.
