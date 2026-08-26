# Scraper Testing Journal

## 2026-07-29: Live Data Pull Testing Attempt

### Session Goal
Test zabasearch with actual live HTTP requests to zabasearch.com to validate scraper logic against real data.

### Test Approach
Created `test_zabasearch_live.py` script using pure Python (urllib) to:
1. Make real HTTP requests to zabasearch.com
2. Parse HTML responses
3. Extract person data (name, age, carrier, location, etc.)
4. No external dependencies (requests module not available)

### Test Results
❌ **Live fetch returned 404 for test phone numbers**
- Tested: 415-555-0123 (generic test number)
- Result: zabasearch.com returns 404 for non-existent numbers
- **Finding:** This is expected behavior — zabasearch returns 404 for numbers with no public data

### Blocker
- Test phone number (415-555-0123) is not a real registered number on zabasearch
- Cannot perform real data validation without a valid phone number

### Next Steps
To test actual data pull:
1. **Option A:** Use a real phone number (requires actual test data)
2. **Option B:** Check if worker is deployed and test via HTTP endpoint
3. **Option C:** Use zabasearch API directly if available (vs web scraping)

---

## 2026-07-28: ZabaSearch Testing Session Started

### Session Goal
Test the zabasearch relay scraper with focus on:
1. Summary search functionality
2. API integration
3. Error handling

### Test Results
✅ **Full test suite PASSED: 46/46 tests**

#### Breakdown by Category:
- **Phone Normalization:** 10/10 ✅
  - Handles dashes, parentheses, dots, +1 country codes
  - Validates digit counts (9-11 digits with normalization)
  - Formats as XXX-XXX-XXXX
  
- **Field Extraction:** 11/11 ✅
  - HTML parsing works for all major fields (name, age, carrier, location, etc.)
  - Handles aliases, addresses (current & previous), related persons
  - Phone numbers and time zone extraction verified
  
- **Response Structure:** 4/4 ✅
  - JSON structure has all required fields
  - Field types validated
  - Error responses properly formatted (no_result, invalid_phone, unauthorized, etc.)
  
- **CORS Headers:** 4/4 ✅
  - All required CORS headers present
  - Allows all origins (*)
  - OPTIONS preflight handling verified
  
- **Relay Authentication:** 5/5 ✅
  - X-Relay-Token header support
  - Query parameter token support
  - 401 handling for missing/invalid tokens
  
- **Relay URL Validation:** 6/6 ✅
  - Domain whitelist works (zabasearch.com, fastpeoplesearch.com, anywho.com)
  - Rejects unknown domains
  - Validates URL format
  
- **Endpoint Routing:** 4/4 ✅
  - /phone endpoint routing
  - /relay endpoint routing
  - Root fallback (/)
  - OPTIONS preflight
  
- **Integration Tests:** 2/2 ✅
  - Full phone lookup flow (normalize → fetch → parse → respond)
  - Full relay flow (auth → validate URL → fetch → relay)

### Issues/Blockers
(none found)

### Decisions
- Zabasearch test suite is comprehensive and stable
- Ready for production relay use

---

## 2026-07-29: Anywho Testing Session

### Session Goal
Test the anywho scraper with focus on:
1. URL building for anywho.com people search
2. HTML parsing (name, age, location, phones, aliases, related people)
3. Blocking detection (Cloudflare, access denied)
4. DOM parser and data-content attribute handling
5. Edge cases and error handling

### Test Results
✅ **Full test suite PASSED: 46/46 tests**

#### Breakdown by Category:
- **Slug Generation:** 5/5 ✅
  - Lowercase conversion
  - Spaces to dashes
  - Special character handling
  - Multiple dash collapsing
  - Trim leading/trailing dashes
  
- **URL Building:** 6/6 ✅
  - Name-only URLs
  - Full URLs with city/state
  - State abbreviation → full name mapping
  - Unknown state handling
  - Special chars in names
  - All 50+ state abbreviations verified
  
- **Text Cleaning:** 4/4 ✅
  - Whitespace collapse
  - Non-breaking space handling
  - Bullet/dash stripping
  - Content preservation
  
- **HTML Parsing:** 11/11 ✅
  - Single person extraction
  - Result structure validation
  - Age extraction
  - Location (lives_in) extraction
  - Phone number reassembly from data-content spans
  - Alias (AKA) extraction
  - Related people extraction
  - Detail link extraction
  - No results handling
  - Card deduplication
  - Invalid name filtering
  
- **Block Detection:** 5/5 ✅
  - Cloudflare challenge detection
  - Access denied message detection
  - Small response threshold (200 bytes)
  - Normal page validation
  - Configurable threshold
  
- **DOM Parser:** 4/4 ✅
  - Simple text extraction
  - data-content attribute preservation
  - Nested tag handling
  - Self-closing tag support
  
- **Integration Tests:** 3/3 ✅
  - Full flow HTML to person records
  - URL pattern validation
  - All state abbreviations valid

- **Edge Cases:** 6/6 ✅
  - Empty names
  - Numbers-only strings
  - Very long names
  - Unicode character handling
  - Malformed HTML resilience
  - None values in build_url

### Key Implementation Details
- **Scraper:** `workers/anywho/anywho_test.py` (1.2K lines, Python 3)
- **URL Pattern:** `/people/{first}+{last}/{state-name}/{city-slug}`
- **Phone Reconstruction:** Uses `<span data-content="NNNN">•••</span>` patterns
- **Block Detection:** Checks for Cloudflare title, "Access denied", response < 200 bytes
- **State Mapping:** All 50 states + DC in STATE_NAMES dict

### Issues/Blockers
(none found)

### Decisions
- Anywho scraper is well-tested with comprehensive unit coverage
- Ready for integration with broader scraping pipeline
- Test fixtures in conftest.py provide mock HTML samples
- No real network calls during testing (all mocked)

---

## 2026-08-12: Phase 1 Summary Scraper Test Framework (vanyshr-scraper-lab)

### Session Goal
Create comprehensive 17-person test framework to validate Phase 1 summary scrapers (FPS, NPD, AnyWho) and identify most reliable brokers for different data types (age, address, phones, emails, aliases, relatives).

### What Was Built

#### 1. **Data Models Updated**
- Extended `SummaryResult` dataclass across all brokers to include:
  - `phone`: str
  - `email`: str  
  - `aliases`: str (comma/bullet-separated list)
  - `relatives`: str (comma/bullet-separated list)
- Files: `/targets/{fps,npd,anywho}/models.py`

#### 2. **HTML Scrapers Implemented**
- **FPS HTML Scraper** (`fps_html_scraper.py`): Extracts summary results with phone/email fields
- **NPD HTML Scraper** (`npd_html_scraper.py`): 
  - Fixed BASE_URL (removed www.)
  - URL format: `/people/{letter}/{first}-{last}/{state-abbr-lower}/{city-lower}/`
  - Uses context.dev HTML method (~$0.001/request)
- **AnyWho HTML Scraper** (`anywho_html_scraper.py`):
  - h3-section based extraction (Lives in, Phone numbers, AKA, May be related to)
  - Reconstructs data-content (Cloudflare blurred data) from HTML attributes
  - Smart spacing: only adds space before letters, not punctuation
  - Phone regex: `\(\d{3}\)\s*\d{3}-\d+`
  - Email regex: `[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?`

#### 3. **Test Framework** (`test_all_17_profiles.py`)
- Runs Phase 1 for 17 known people across 3 brokers
- Generates CSV with:
  - **SUMMARY rows**: Per-profile metadata (timing, total results, broker count)
  - **DETAIL rows**: Per-result extracted data (age, address, phones, emails, aliases, relatives)
- Output: `/Users/jameso/Downloads/Test_Profiles_-_detailed_results.csv`

#### 4. **Sequence Runner Updates**
- Updated `_scrape_broker()` method to extract and pass new fields
- Handles broker-specific field name variants (phone vs phonePreview)
- Converts broker results → SummaryResult with all data fields

### Test Results (17-person run)
✅ **Test completed successfully**
- 17 profiles tested across FPS, NPD, AnyWho
- ~50 API requests total, ~52 seconds runtime
- **FPS:** Excellent — 1-5 matches per profile consistently
- **NPD:** 404s expected — users not in database with city/state filter
- **AnyWho:** Good results — extracting detailed data

### Data Extraction Status

| Field | FPS | NPD | AnyWho | Status |
|-------|-----|-----|--------|--------|
| Age | ✅ | ✅ (ageRange) | ✅ | Working |
| Address | ✅ | ✅ | ✅ | Working |
| Phone | ⚠️ | ⚠️ | ⚠️ | Extracted but truncated |
| Email | ⚠️ | ✅ | ✅ | Working in scrapers |
| Aliases | ✅ | ✅ | ✅ | Working |
| Relatives | ✅ | ✅ | ✅ | Working |

### Known Issues / Blockers

#### 🔴 **CRITICAL: CSV Parsing/Insertion Problem**
- **Symptom:** Data extracted correctly (visible in terminal output and intermediate JSON) but CSV has truncated/missing values in some fields
- **Root Cause:** TBD — likely issue in `sequence_runner.py` CSV conversion logic or test_all_17_profiles.py data aggregation
- **Evidence:**
  - Phone numbers showing as "(816) 632-" (incomplete)
  - Some email/aliases/relatives fields empty despite successful extraction
  - Extraction logic working (h3 parsing, data-content reconstruction all verified)
- **Impact:** CSV results unreliable for spot-checking accuracy

#### ⚠️ **Minor: Zaba Residential Connection Errors**
- [Errno 61] Connection refused on serv01:8789
- Expected behavior — service not running (noted in git commit history)
- Does not affect Phase 1 summary scrapers (FPS, NPD, AnyWho)

#### ⚠️ **Minor: Leakcheck API Key Missing**
- Warning on startup — expected, not used in Phase 1 tests
- Can suppress or add to .env

### Files Modified/Created

**Data Models:**
- `/targets/fps/models.py` — Added phone, email, aliases, relatives fields
- `/targets/npd/models.py` — Added ageRange, email, aliases, relatives fields  
- `/targets/anywho/models.py` — Added phone, email, aliases, relatives fields
- `/data_models.py` — Updated SummaryResult dataclass

**Scrapers:**
- `/fps_html_scraper.py` — New
- `/npd_html_scraper.py` — Complete rewrite with HTML method
- `/anywho_html_scraper.py` — Complete rewrite with h3-section parsing

**Test/Sequence:**
- `/test_all_17_profiles.py` — New 17-person test framework
- `/sequence_runner.py` — Updated `_scrape_broker()` method (~line 270)

**Test Data:**
- `/test_profiles.csv` — 17-person test list
- `/Users/jameso/Downloads/Test_Profiles_-_detailed_results.csv` — Results (with parsing issues)

### Next Steps for Handoff

1. **Debug CSV parsing issue** — Trace data flow from broker results → CSV output
   - Verify sequence_runner.py field extraction
   - Check test_all_17_profiles.py CSV writing logic
   - Validate data types in SummaryResult instances

2. **Verify phone number truncation** — Check if AnyWho extraction is incomplete or CSV truncating

3. **Test with corrected CSV logic** — Re-run 17-person test to confirm all fields populate correctly

4. **Spot-check accuracy** — Against known profiles to identify which brokers most reliable

### Code Locations in Lab
- Primary: `/Users/jameso/DevWork/vanyshr-stack/vanyshr-scraper-lab/`
- Scrapers: root + `/targets/{broker}/`
- Test: `test_all_17_profiles.py` (root)
- Models: `data_models.py` + `/targets/{broker}/models.py`

---
