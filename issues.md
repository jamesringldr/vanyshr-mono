# Outstanding Issues — Pilot Scan UI

## Critical Issues

### 1. Email Extraction Not Reaching Confirmation Modal
**Status:** Blocking  
**Severity:** Critical

**Symptom:**
- Email confirmation modal shows "(empty)" for extracted emails after profile selection
- API response clearly contains emails in member objects (e.g., `"email": "catlac02@yahoo.com"`)

**Root Cause:**
- Unknown. Debug logging added to `loading.tsx:handlePick()` to trace extraction flow
- Logs show:
  - `handlePick debug` object with profile/group info
  - `Extracted emails` array
- Tests show logs should fire when profile is selected, but haven't been manually verified in browser

**Investigation Path:**
1. Run the app in browser (`pnpm dev` → port 5174)
2. Fill scan form: Luke Clark, 85355, Waddell, AZ
3. Click "Scan Now"
4. When results modal appears with profiles, select "This is me"
5. Check browser DevTools console for `handlePick debug` and `Extracted emails` logs
6. Trace where extraction fails (API payload vs. state management vs. modal props)

**Code References:**
- `apps/app/src/pages/pilot-scan/loading.tsx:handlePick()` — email extraction logic (lines ~331-360)
- `apps/app/src/pages/pilot-scan/email-confirmation.tsx` — modal display (expects `initialEmails` prop)
- Network request shows emails in API response

---

### 2. Email Confirmation Modal Not Appearing After Profile Selection
**Status:** Blocking  
**Severity:** Critical

**Symptom:**
- After selecting profile ("This is me"), modal should show email confirmation
- Test automation shows modal doesn't appear within expected timeframe
- Manual testing required to confirm if modal appears or if profile selection doesn't trigger it

**Related To:** Issue #1 (both depend on profile selection flow)

---

## Known Issues

### 3. ZIP Code API Returns 404
**Status:** Blocking dedup logic  
**Severity:** High

**Symptom:**
- Duplicate profiles for same person (e.g., two "James Oehring" entries)
- spi.zippopotamus.us API returns 404 when looking up "85355" (Waddell, AZ zip)

**Root Cause:**
- Third-party ZIP code API issue (may be down or deprecated)
- Or zip code lookup logic is sending wrong format

**Fix Options:**
1. Add fallback city/state lookup (don't require ZIP validation)
2. Cache known ZIP codes locally
3. Remove ZIP validation entirely for now

---

### 4. Browser Automation Setup (Playwright)
**Status:** Unresolved  
**Severity:** Medium (blocks automated testing, not user-facing)

**Issue:**
- Playwright installed but test scripts have:
  - Port discovery issues (was on 5174, not 5173)
  - Form selector issues (inputs lack name attributes, use placeholder instead)
  - Modal state timing issues (hard to detect when results fully loaded)
  - Click interception by dialog overlay

**Resolution:**
- Manual testing in browser is more reliable for now
- If automation needed later, simplify by:
  - Waiting for specific network responses (API calls complete)
  - Using data attributes for selectors instead of text content
  - Increasing timeouts for form validation/submission

---

## Completed Work

✅ Items 2.1-2.4 from punchlist implemented:
- 2.1: Phase 2 data rendered into 6 hex areas
- 2.2: Skeleton-until-resolved loading pattern
- 2.3: Expired scan results screen
- 2.4: Email capture + magic link signup flow

✅ Session caching bug fixed (entry.tsx cleanup)

✅ Debug logging added to trace email extraction

---

## Next Steps

1. **Immediate:** Manual browser testing to verify email extraction and modal flow
2. **Follow-up:** Fix dedup logic (ZIP code issue) so similar profiles combine
3. **Optional:** Improve browser automation if needed for CI/CD

---

## Testing Commands

```bash
# Start dev server
pnpm dev

# Navigate to http://localhost:5174 in browser
# Form: Luke Clark, 85355, Waddell, AZ
# Check console after "This is me" click for debug logs
```
