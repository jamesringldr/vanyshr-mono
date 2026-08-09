# QS Search Sequence — Roadmap & Progress

## Work Breakdown

- [ ] Phase 1: Research & Design
  - [ ] Map current quickscan flow (entry point → search → results display)
  - [ ] Identify friction points and pain points in current UX
  - [ ] Define target flow (fewer steps, clearer results)
  - [ ] Create wireframes or mockups for the optimized flow
  - [ ] Validate assumptions with existing codebase
  
- [ ] Phase 2: Implementation
  - [ ] Frontend: Refactor search page/components in `apps/app/src/`
  - [ ] Backend: Optimize orchestration if needed in `packages/services/orchestration/`
  - [ ] Unit tests for individual components/functions
  - [ ] Integration tests for end-to-end flow
  
- [ ] Phase 3: Polish & Validation
  - [ ] Error handling & edge cases (empty results, network errors, etc.)
  - [ ] Performance validation (time-to-first-result, result rendering speed)
  - [ ] Accessibility review (keyboard navigation, screen readers)
  - [ ] Documentation inline (code comments for non-obvious decisions)
  
- [ ] Phase 4: Integration
  - [ ] Merge changes into main app
  - [ ] Wire into production user paths
  - [ ] End-to-end validation in running app
  - [ ] Deployment & monitoring setup
  - [ ] Collect early user feedback

## Integration Checklist (Phase 4)
*Do this when feature is solid and ready to wire into production.*

- [ ] **Code review**: Self-review in CLAUDE.md, check against app architecture
- [ ] **Type safety**: No `any` types; types match shared types in `packages/shared/`
- [ ] **Tests**: Run full test suite; flow tests pass locally
- [ ] **Dependencies**: No new external dependencies without approval
- [ ] **Performance**: Time-to-first-result is within target (if applicable)
- [ ] **Wiring**: Integrate into `apps/app/` user paths per design
- [ ] **End-to-end test**: Test complete search flow in running app
- [ ] **Merge & cleanup**: 
  - Merge feature branch to staging
  - Delete feature worktree (if created)
  - Remove `feature_sbox/flow-qs-search-sequence/` directory
  - Update `CHANGELOG.md` with flow improvements

## Status Summary
**Overall progress**: [Not started on this flow's own scope, but backend orchestration/matching groundwork already exists — see journal.md]
**Last updated**: 2026-08-08

---

## Notes
For design decisions, blockers, and findings, see `journal.md`.
Backend orchestration + matching (`ProfileMatcher.ts`, parallel `run-quick-scan` wiring, UI already wired to it) was built and tested on `dev/quickscan-search-ui` (unmerged) — pull that forward rather than redoing Phase 2's backend work.

## Related Work
- [[quickscan-orchestration]] — Parallel orchestration improvements (see memory)
