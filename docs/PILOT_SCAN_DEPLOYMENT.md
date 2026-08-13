# Pilot-Scan Deployment Guide

**Status:** Ready for Staging  
**Branch:** `dev/quickscan-phase1-phase2-integration`  
**Date:** 2026-08-12

## Deployment Steps

### Step 1: Apply Database Migrations

```bash
cd /Users/jameso/DevWork/vanyshr-stack/Vanyshr-mono

# Run migrations
supabase migration up

# Or via Vercel deployment (auto-runs)
git push origin dev/quickscan-phase1-phase2-integration
```

**Migrations Applied:**
1. `20260812_quickscan_dedup_groups.sql` - Phase 1 results table
2. `20260812_quickscan_enrichment.sql` - Phase 2 enrichment table
3. `20260812_quickscan_cost_tracking.sql` - Cost tracking + helper functions
4. `20260812_quickscan_update_fks.sql` - FK updates to quick_scans

### Step 2: Deploy Edge Functions

All files auto-deploy when code is pushed:

```
supabase/functions/_shared/quickscan/
  ├── DedupEngine.ts
  ├── email-extractor.ts
  ├── holehe-enricher.ts
  ├── leakcheck-enricher.ts
  ├── profile-consolidator.ts
  ├── phase1-orchestrator.ts
  ├── phase2-orchestrator.ts
  ├── cost-middleware.ts
  ├── quickscan-phase1-phase2-models.ts
  ├── dedup-engine.test.ts
  ├── email-extractor.test.ts
  └── TESTING.md

supabase/functions/pilot-scan/
  └── index.ts (NEW ENDPOINT)
```

### Step 3: Set Environment Variables

In Vercel/Supabase environment settings:

```bash
# Required
CONTEXT_DEV_API_KEY=*** (already configured)

# Highly recommended (enables 4-broker parallel)
SCRAPER_LAB_URL=https://vanyshr-scraper-lab.fly.dev/api
SCRAPER_LAB_TOKEN=***

# Optional (enables data breach detection)
LEAKCHECK_API_KEY=***
```

### Step 4: Verify Deployment

Check that edge functions are deployed:

```bash
# List deployed functions
curl https://<project>.supabase.co/functions/v1

# Should show: pilot-scan, run-quick-scan, etc.
```

Check that tables exist:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_name LIKE 'quickscan%';
-- Should return:
-- - quickscan_dedup_groups
-- - quickscan_enrichment
-- - quickscan_cost_tracking
```

---

## Testing Guide

### Phase 1 Smoke Test (Search)

```bash
curl -X POST https://<project>.supabase.co/functions/v1/pilot-scan \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "James",
    "lastName": "Oehring",
    "zipcode": "65251",
    "sessionId": "test-001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "dedup_groups": [
    {
      "id": "group-uuid",
      "name": "James Oehring",
      "age": 61,
      "city": "Cameron",
      "state": "MO",
      "sources": ["fps", "npd", "anywho"],
      "confidence": 87.5,
      "members": [...]
    }
  ],
  "metadata": {
    "total_time_ms": 7850,
    "profiles_found": 1,
    "brokers_scraped": ["fps", "npd", "anywho", "zaba"]
  }
}
```

**Success Criteria:**
- ✅ Returns deduplicated groups
- ✅ Confidence >= 75%
- ✅ Time < 8 seconds
- ✅ At least 1 group returned

### Phase 2 Smoke Test (Enrichment)

```bash
# Use groupId from Phase 1 response above
curl -X POST https://<project>.supabase.co/functions/v1/pilot-scan \
  -H "Content-Type: application/json" \
  -d '{
    "dedupGroupId": "group-uuid-from-phase1",
    "sessionId": "test-001"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "consolidated_profile": {
    "person_id": "pid_123",
    "full_name": "James Oehring",
    "age": 61,
    "emails": ["james@example.com"],
    "phone_numbers": ["555-123-4567"],
    "services_found": ["github", "linkedin"],
    "breaches": [
      {
        "name": "LinkedIn 2021",
        "date": "2021-05-15"
      }
    ]
  },
  "enrichment": {
    "holehe_services": ["github", "linkedin"],
    "leakcheck_breaches": [...]
  },
  "metadata": {
    "total_phase2_ms": 1600,
    "emails_found": 1,
    "services_found": 2,
    "breaches_found": 1
  }
}
```

**Success Criteria:**
- ✅ Returns consolidated profile
- ✅ Emails extracted
- ✅ Services found via Holehe
- ✅ Time < 2 seconds

---

## E2E Flow Testing

### Full User Flow

1. **Search (Phase 1):**
   - User enters: James, Oehring, 65251
   - System returns: 3-4 dedup groups
   - Modal displays for selection

2. **Select (Modal):**
   - User clicks "Select" on top group (highest confidence)
   - Frontend calls Phase 2 with dedupGroupId

3. **Enrich (Phase 2):**
   - System enriches selected profile
   - Extracts emails, finds services, checks breaches
   - Returns consolidated profile

4. **Display:**
   - User sees full profile with all data

### Error Scenarios

```bash
# Test invalid zipcode
curl -X POST https://.../pilot-scan \
  -d '{"firstName":"John","lastName":"Doe","zipcode":"00000","sessionId":"test"}'
# Expected: Search completes, may return empty groups

# Test rate limiting
# Send 6+ Phase 1 requests in 60 seconds from same session
# Expected: 6th request returns 429 Too Many Requests

# Test missing parameters
curl -X POST https://.../pilot-scan -d '{"firstName":"John"}'
# Expected: 400 Bad Request
```

### Load Test (100 Concurrent)

```bash
ab -n 100 -c 100 \
  -T "application/json" \
  -p payload.json \
  https://<project>.supabase.co/functions/v1/pilot-scan
```

**Success Criteria:**
- ✅ All 100 requests complete
- ✅ No connection errors
- ✅ Response time avg < 8s
- ✅ No 500 errors

---

## Monitoring

### Check Logs

```bash
# View Supabase function logs
supabase functions logs pilot-scan --follow
```

### Verify Database Recording

```sql
-- Check dedup groups stored
SELECT COUNT(*) FROM quickscan_dedup_groups;

-- Check enrichment results
SELECT COUNT(*) FROM quickscan_enrichment;

-- Check costs tracked
SELECT * FROM quickscan_cost_tracking 
ORDER BY created_at DESC LIMIT 10;

-- Check cost aggregation
SELECT 
  session_id, 
  COUNT(*) as searches,
  SUM(total_cost_usd) as total_cost
FROM quickscan_cost_tracking
GROUP BY session_id;
```

### Verify Cost Accuracy

```sql
-- Phase 1 should be ~$0.0025 per search
SELECT * FROM quickscan_cost_tracking 
WHERE phase = 1 
ORDER BY created_at DESC LIMIT 5;

-- Phase 2 should be ~$0.007 per search
SELECT * FROM quickscan_cost_tracking 
WHERE phase = 2 
ORDER BY created_at DESC LIMIT 5;
```

---

## Rollback Plan

If issues occur:

1. **Revert pilot-scan deployment:**
   ```bash
   git revert <commit-hash>
   git push origin dev/quickscan-phase1-phase2-integration
   ```

2. **Keep database tables** (safe - read-only until tested)

3. **Roll forward** once fixed

---

## Sign-Off Checklist

- [ ] Migrations applied successfully
- [ ] Edge functions deployed
- [ ] Environment variables set
- [ ] Phase 1 smoke test passes
- [ ] Phase 2 smoke test passes
- [ ] Full E2E flow works
- [ ] Error scenarios handled
- [ ] Load test passes (100 concurrent)
- [ ] Cost tracking accurate
- [ ] Logs show no errors
- [ ] Rate limiting enforced
- [ ] Ready for production ✅

---

## Production Readiness

Once all tests pass:

1. Merge `dev/quickscan-phase1-phase2-integration` to `staging`
2. Run final E2E tests in staging
3. Create PR to `main` for production
4. Deploy to production (app.vanyshr.com)

---

## Support

**If issues occur:**
- Check logs: `supabase functions logs pilot-scan`
- Verify env vars are set
- Confirm database migrations ran
- Check API rate limits (context.dev, Holehe, Leakcheck)

**Contact:** See project CLAUDE.md for escalation

---

**Deployment Date:** 2026-08-12  
**Status:** READY FOR STAGING
