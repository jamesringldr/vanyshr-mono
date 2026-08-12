# QuickScan Phase 1 & 2 - Testing Guide

## Test Files

### 1. **dedup-engine.test.ts**
Comprehensive unit tests for the DedupEngine

**Test Cases:**
- `calculateMatchScore()` - Name similarity, location matching, age compatibility
- `deduplicate()` - Grouping identical profiles, separating different people
- Group sorting by confidence score
- Age conflict detection
- Handling empty/failed broker results
- Group display formatting

**Running:**
```bash
deno test --allow-all dedup-engine.test.ts
```

### 2. **email-extractor.test.ts**
Unit tests for email extraction, validation, and deduplication

**Test Cases:**
- Email format validation
- System email filtering (noreply@, test@, admin@, etc.)
- Case-insensitive deduplication
- Nested email structure extraction
- Broker source tracking
- Error handling

**Running:**
```bash
deno test --allow-all email-extractor.test.ts
```

## Integration Tests (Manual)

### Phase 1 Flow Test
```bash
curl -X POST http://localhost:54321/functions/v1/run-quick-scan \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "1",
    "scan_id": "test-scan-001",
    "first_name": "James",
    "last_name": "Oehring",
    "city": "Cameron",
    "state": "MO",
    "session_id": "test-session-001"
  }'
```

**Expected Response:**
- ✅ `success: true`
- ✅ `dedup_groups[]` with results ranked by confidence
- ✅ `metadata` with timing information
- ✅ Cost estimation (~$0.0025)

### Phase 2 Flow Test
```bash
curl -X POST http://localhost:54321/functions/v1/run-quick-scan \
  -H "Content-Type: application/json" \
  -d '{
    "phase": "2",
    "scan_id": "test-scan-002",
    "session_id": "test-session-001",
    "dedup_group_id": "group-id-from-phase1"
  }'
```

**Expected Response:**
- ✅ `success: true`
- ✅ `consolidated_profile` with full merged data
- ✅ `enrichment` with services and breaches
- ✅ `metadata` with timing and cost

## Test Data

**Primary Test Case:** James Oehring, Cameron, MO
- Expected Phase 1: 3-4 dedup groups with 75%+ confidence
- Expected Phase 2: Multiple emails, online services, data breaches (if Leakcheck enabled)

## Testing Checklist

### Unit Tests
- [ ] DedupEngine scoring algorithm
- [ ] Email extraction and validation
- [ ] Profile consolidation
- [ ] Cost calculation

### Integration Tests
- [ ] Phase 1 search completes in <8s
- [ ] Phase 1 returns deduplicated groups
- [ ] Phase 1 stores results in database
- [ ] Phase 2 enrichment completes in <2s
- [ ] Phase 2 returns consolidated profile
- [ ] Phase 2 stores results in database

### Error Handling
- [ ] Invalid input returns 400
- [ ] Rate limit exceeded returns 429
- [ ] Broker failure handled gracefully
- [ ] API timeout handled
- [ ] Database errors logged

### Performance
- [ ] Phase 1 <8s (4-broker parallel)
- [ ] Phase 2 <2s (enrichment)
- [ ] Cost tracking accurate
- [ ] Rate limiting enforced

## Running All Tests

```bash
# Run all Deno tests in _shared/quickscan/
deno test --allow-all supabase/functions/_shared/quickscan/*.test.ts

# Run with coverage
deno test --allow-all --coverage=coverage/ supabase/functions/_shared/quickscan/*.test.ts

# Run specific test file
deno test --allow-all supabase/functions/_shared/quickscan/dedup-engine.test.ts
```

## Environment Variables for Testing

```bash
# Required for testing Phase 1 & 2
CONTEXT_DEV_API_KEY=***
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=***

# Optional for Leakcheck testing
LEAKCHECK_API_KEY=***

# Optional for scraper-lab bridge testing
SCRAPER_LAB_URL=https://vanyshr-scraper-lab.fly.dev/api
SCRAPER_LAB_TOKEN=***
```

## Load Testing

**100 Concurrent Phase 1 Searches:**
```bash
# Using Apache Bench
ab -n 100 -c 100 \
  -T "application/json" \
  -p test-payload.json \
  http://localhost:54321/functions/v1/run-quick-scan
```

**Expected:**
- ✅ All requests complete
- ✅ Response time: <8s per request
- ✅ No connection pool exhaustion
- ✅ Cost tracking accurate

## Troubleshooting

**Test timeouts:**
- Increase timeout if brokers respond slowly
- Check network connectivity to scraper-lab
- Verify API keys are valid

**Database connection errors:**
- Ensure Supabase is running
- Check connection string
- Verify migrations are applied

**Missing test data:**
- Ensure database migrations are complete
- Verify session_id is unique per test
- Check that dedup_group_id references exist

## Next Steps After Testing

1. ✅ Run unit tests (DedupEngine, Email Extractor)
2. ✅ Run integration tests (Phase 1 & 2 flows)
3. ✅ Run load tests (100 concurrent)
4. ⏳ Deploy to staging (Task 10)
5. ⏳ Run E2E tests in staging (Task 11)
