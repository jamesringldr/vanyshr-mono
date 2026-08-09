# QS Search Sequence — Decision Journal

## Entries (newest first)

### 2026-08-08 — Existing backend orchestration groundwork found on dev/quickscan-search-ui
**What**: Before starting Phase 1 research/design, found a parked branch (`dev/quickscan-search-ui`, never merged) with completed backend work directly relevant to this flow:
- `ProfileMatcher.ts` (`supabase/functions/_shared/scrapers/ProfileMatcher.ts`) — phone + address deduplication/grouping across scraper results, 14 passing unit tests
- Parallel orchestration in `run-quick-scan/index.ts` — Anywho + Zabasearch run in parallel, FPS fires async in the background as a fallback with a 35s wait cap, results deduplicated as soon as fast scrapers return
- UI already wired: `quick-scan-form.tsx` calls `run-quick-scan` directly, sequential Zabasearch fallback removed, profile selection simplified
- Full test suite: unit tests, 7 integration scenarios, a bash integration script, `docs/TESTING_QUICKSCAN.md`
- Commits: `3d85654`, `878f4a5`, `88d098b`

**Why**: This flow's stated scope (search UX, fewer steps, clearer results) overlaps heavily with what that branch already solved on the backend/data side. No need to redesign the orchestration or matching logic from scratch.

**Impact**: Phase 2 implementation for this flow should start by pulling `dev/quickscan-search-ui` into a fresh branch off current `staging` (it will need rebasing — staging has moved since 2026-07-07) rather than re-implementing matching/orchestration. Remaining work is likely just the UX/interaction-design layer this flow is actually scoped around, not the plumbing underneath it.

---

### [Not started]
(Entries will be appended as development progresses. Format: ISO8601 date, decision/finding, rationale.)

---

## Template for new entries:
```
### YYYY-MM-DD — {Decision/Finding}
**What**: [Describe the decision or finding]
**Why**: [Rationale for the choice]
**Impact**: [How this affects the flow or implementation]
```
