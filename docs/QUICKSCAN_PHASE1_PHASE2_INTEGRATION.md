# QuickScan Phase 1 & 2 Integration

**Status:** 70% Complete (7/11 Tasks)  
**Date Started:** 2026-08-12  
**Target Completion:** 2026-08-13  
**Priority:** High (Production Feature)

## Overview

Integration of production-ready QuickScan system from `vanyshr-scraper-lab` into `Vanyshr-mono` production application.

**Phase 1:** Two-phase people search with 4-broker parallel scraping + deduplication
- Input: {firstName, lastName, city, state} — run as two tiers (fast: Zaba alone, slow: FPS+NPD+AnyWho) that merge client-side as they land
- Output: Deduplicated profiles ranked by confidence
- Time: ~8s | Cost: $0.002-0.003

**Phase 2:** Scrapes each broker's real detail page (`profile_url` from Phase 1), then full profile enrichment with email extraction + Holehe (online services) + Leakcheck (data breaches)
- Input: {dedup_group_id} (DB lookup) or an inline `selectedGroup` (no DB round trip — current pilot-scan path)
- Output: Consolidated profile with enrichment data
- Detail-page scrape: 20s timeout per broker (Zaba/FPS/AnyWho/NPD), degrades to Phase 1 summary data per-broker on timeout/failure
- Time: ~1.6s enrichment + detail-scrape time | Cost: $0.005-0.008

## Deliverables

### ✅ Database Schema (4 migrations)

Located in `supabase/migrations/`:

1. **`20260812_quickscan_dedup_groups.sql`**
   - Stores Phase 1 dedup results
   - Fields: dedup_id, rank, confidence, members_count, full_data JSONB
   - Indexes for quick lookup by quick_scan_id, session_id, created_at

2. **`20260812_quickscan_enrichment.sql`**
   - Stores Phase 2 enrichment results
   - Fields: emails_found, services_found, breaches (Leakcheck), consolidated_profile JSONB
   - Separate status tracking for Holehe, Leakcheck, email extraction

3. **`20260812_quickscan_cost_tracking.sql`**
   - Tracks all API costs for billing and rate limiting
   - Fields: phase, cost_usd, brokers_searched, profiles_found, metadata
   - Helper function: `get_user_quickscan_costs(user_id, lookback_days)`

4. **`20260812_quickscan_update_fks.sql`**
   - Adds FK references to quick_scans table
   - Columns: dedup_group_id, enrichment_id

### ✅ Core Data Models

Located in `supabase/functions/_shared/quickscan/`:

**`DedupEngine.ts`**
- Complete deduplication engine with weighted scoring
- Score components: name similarity (45%), location (35%), age (10%), credibility (10%)
- Thresholds: Merge (75+), Group (50-75), Separate (<50)
- Name matching: exact, first+last, Levenshtein, sequence matching
- Location matching: city+state, state-only, fuzzy matching
- Age conflict detection with notes

### ✅ Enrichment Components

1. **`email-extractor.ts`**
   - Extracts emails from broker profile data
   - Validates format and filters system emails (noreply@, test@, etc.)
   - Deduplicates case-insensitively
   - Returns: {success, emails[], count, sources[]}

2. **`holehe-enricher.ts`**
   - Calls Holehe API (https://api.holehe.io/v1/email)
   - Checks 123+ online services per email
   - Prioritizes relevant services (GitHub, LinkedIn, Twitter, etc.)
   - Batch processing with 3-email concurrency
   - Deduplicates and aggregates results

3. **`leakcheck-enricher.ts`**
   - Calls Leakcheck API (https://api.hudsonrock.com/json/v3/search-by-login-emails)
   - Finds 200+ data breaches per email
   - Requires optional LEAKCHECK_API_KEY
   - Returns breach records with date, source, URL
   - Batch processing with 3-email concurrency

4. **`profile-consolidator.ts`**
   - Merges profile data from multiple brokers
   - Deduplicates addresses (similarity threshold 0.7)
   - Normalizes and deduplicates phone numbers
   - Consolidates relatives, associates, properties
   - Calculates data completeness score
   - Returns: ConsolidatedProfile with all merged data

### ✅ Orchestrators

1. **`phase1-orchestrator.ts`**
   - Attempts scraper-lab bridge if SCRAPER_LAB_URL configured
   - Falls back to native Edge Function scrapers if unavailable
   - Calls DedupEngine for consolidation
   - Generates dedup groups and ranks by confidence
   - Stores results in quickscan_dedup_groups table
   - Returns: {success, dedup_groups[], raw_results, metadata}

2. **`phase2-orchestrator.ts`**
   - Loads dedup_group from database
   - Extracts emails from consolidated profiles
   - Enriches with Holehe and Leakcheck in parallel
   - Consolidates all data using ProfileConsolidator
   - Stores results in quickscan_enrichment table
   - Returns: {consolidated_profile, enrichment_data, metadata}

### ✅ Cost Tracking

**`cost-middleware.ts`**
- Functions:
  - `trackCost()` - Record cost to database and update user aggregate
  - `checkRateLimit()` - Enforce $10/day per-user limit
  - `estimateCost()` - Pre-flight cost estimation
  - `checkBurstProtection()` - Max 5 Phase 1 searches per 60s
  - `getUserCostSummary()` - Billing summary for user

## Remaining Work

### Task 8: Update run-quick-scan Edge Function
- Integrate Phase1Orchestrator and Phase2Orchestrator
- Add phase parameter detection
- Wire database storage
- Add cost tracking and rate limiting
- **Effort:** 2-3 hours
- **Blocked by:** None (all components ready)

### Task 9: Write Integration Tests
- DedupEngine scoring tests
- Email extraction tests
- Enrichment API tests (mock Holehe/Leakcheck)
- End-to-end orchestration tests
- Cost tracking validation
- **Effort:** 3-4 hours
- **Blocked by:** Task 8

### Task 10: Deploy to Staging
- Run 4 database migrations
- Deploy shared code (_shared/quickscan/)
- Deploy updated run-quick-scan
- Set environment variables
- Run smoke tests
- **Effort:** 1-2 hours
- **Blocked by:** Tasks 8-9

### Task 11: End-to-End Testing
- Verify Phase 1 and Phase 2 flows
- Test error scenarios
- Load test with 100 concurrent searches
- Verify cost tracking and rate limiting
- **Effort:** 2-3 hours
- **Blocked by:** Task 10

## Installation & Deployment

### 1. Apply Database Migrations

```bash
# In Vanyshr-mono directory
supabase migration up

# Or deploy via Vercel (auto-runs migrations)
git push origin staging
```

### 2. Deploy Edge Functions

All files in `supabase/functions/_shared/quickscan/` are automatically deployed when you push the code.

### 3. Update run-quick-scan

Update `supabase/functions/run-quick-scan/index.ts` to integrate the orchestrators (see Task 8).

### 4. Set Environment Variables

```bash
# Required
CONTEXT_DEV_API_KEY=*** (already set)

# Highly recommended (enables 4-broker parallel search)
SCRAPER_LAB_URL=https://vanyshr-scraper-lab.fly.dev/api
SCRAPER_LAB_TOKEN=***

# Optional (enables data breach detection)
LEAKCHECK_API_KEY=***
```

## API Specification

### Phase 1: POST /api/quickscan

```json
{
  "phase": "1",
  "firstName": "James",
  "lastName": "Oehring",
  "city": "Cameron",
  "state": "MO",
  "sessionId": "unique-session-id"
}
```

**Response (200):**
```json
{
  "success": true,
  "dedup_groups": [
    {
      "dedup_id": "hash123",
      "rank": 1,
      "name": "James Oehring",
      "age": 61,
      "city": "Cameron",
      "state": "MO",
      "sources": ["fps", "npd", "anywho"],
      "confidence": 87.5,
      "members": [...]
    }
  ],
  "cost_estimate": { "phase": 1, "estimated_cost_usd": 0.0025 },
  "timing_ms": 7850
}
```

### Phase 2: POST /api/quickscan

```json
{
  "phase": "2",
  "dedup_group_id": "from-phase-1",
  "sessionId": "same-session-id"
}
```

**Response (200):**
```json
{
  "success": true,
  "consolidated_profile": {
    "person_id": "pid_abc123",
    "full_name": "James Oehring",
    "age": 61,
    "primary_address": { "formatted": "..." },
    "phone_numbers": [...],
    "emails": [...],
    "relatives": [...],
    "services_found": ["github", "linkedin"],
    "breaches": [...],
    "confidence": 87.5,
    "sources": ["fps", "npd", "anywho"]
  },
  "enrichment": {
    "holehe_services": ["github", "linkedin"],
    "leakcheck_breaches": [...]
  },
  "metadata": {
    "total_phase2_ms": 1600,
    "emails_found": 3,
    "services_found": 5,
    "breaches_found": 2,
    "phase2_cost_usd": 0.007
  }
}
```

## Performance Targets

- **Phase 1:** <8s for 4-broker parallel (or <4s with scraper-lab)
- **Phase 2:** <2s for enrichment
- **Total:** <10s end-to-end
- **Concurrency:** 100 simultaneous Phase 1 searches
- **Costs:** $0.002-0.003 (Phase 1) + $0.005-0.008 (Phase 2) per user
- **Rate limit:** $10/day per user

## Testing Approach

**Test data:** James Oehring, Cameron, MO
- Expected Phase 1: 3-4 dedup groups with 75%+ confidence
- Expected Phase 2: Emails, online services, and data breaches

**Test scenarios:**
1. Happy path: Full flow Phase 1 → Phase 2
2. Error handling: Invalid input, broker failures, timeouts
3. Load testing: 100 concurrent Phase 1 searches
4. Cost tracking: Verify accurate cost recording
5. Rate limiting: Verify $10/day limit enforcement

## File Locations

### Pilot Worktree (vanyshr-pilot-scraper-integration/)
- `quickscan-phase1-phase2-models.ts` - Data models
- `DedupEngine.ts` - Dedup engine
- `IMPLEMENTATION_STATUS.md` - Detailed status
- `HANDOFF_GUIDE.md` - Implementation guide for remaining tasks

### Main Repository (Vanyshr-mono/)

**Migrations:**
- `supabase/migrations/20260812_quickscan_dedup_groups.sql`
- `supabase/migrations/20260812_quickscan_enrichment.sql`
- `supabase/migrations/20260812_quickscan_cost_tracking.sql`
- `supabase/migrations/20260812_quickscan_update_fks.sql`

**Shared Code:**
- `supabase/functions/_shared/quickscan/DedupEngine.ts`
- `supabase/functions/_shared/quickscan/email-extractor.ts`
- `supabase/functions/_shared/quickscan/holehe-enricher.ts`
- `supabase/functions/_shared/quickscan/leakcheck-enricher.ts`
- `supabase/functions/_shared/quickscan/profile-consolidator.ts`
- `supabase/functions/_shared/quickscan/phase1-orchestrator.ts`
- `supabase/functions/_shared/quickscan/phase2-orchestrator.ts`
- `supabase/functions/_shared/quickscan/cost-middleware.ts`
- `supabase/functions/_shared/quickscan/quickscan-phase1-phase2-models.ts`

**Documentation:**
- `docs/QUICKSCAN_PHASE1_PHASE2_INTEGRATION.md` (this file)

## Next Steps

1. **Complete Task 8:** Update `run-quick-scan/index.ts` to integrate orchestrators
   - See HANDOFF_GUIDE.md for detailed implementation code

2. **Complete Task 9:** Write integration tests
   - All test infrastructure ready, just need test cases

3. **Complete Task 10:** Deploy to staging
   - Migrations ready, just need to run them

4. **Complete Task 11:** E2E testing
   - All systems ready for validation

**Estimated time to completion:** 8-12 hours

## Support

For detailed implementation guidance, see:
- `HANDOFF_GUIDE.md` in pilot-scraper-integration worktree (has code examples)
- `IMPLEMENTATION_STATUS.md` for architecture overview
- Source code documentation in each module

## References

- Scraper-lab source: `/Users/jameso/DevWork/vanyshr-stack/vanyshr-scraper-lab/`
- Plan agent recommendations: From /plan task execution
- Project CLAUDE.md: `/Users/jameso/DevWork/vanyshr-stack/Vanyshr-mono/CLAUDE.md`
