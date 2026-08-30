# Simple UI Variant — A/B Test Documentation

## Overview

The Simple UI variant is a **minimal, conversational alternate flow for the new-user scan experience**. It A/B tests against the current dense `/pilot-scan` flow to measure conversion and engagement.

**What this is NOT:**
- ❌ A post-login dashboard redesign
- ❌ From-scratch onboarding where users type all their info
- ❌ A separate product with its own backend

**What this IS:**
- ✅ The same data broker scan flow, with a minimal UI skin
- ✅ Grok Bot-inspired design: lots of air, short copy, one action at a time
- ✅ The "oh-shit" dossier reveal, shown in punchy cards (not dense hex charts)
- ✅ Seeded profile review (users validate scraped data, not enter it from scratch)
- ✅ A true A/B test of **new-user acquisition flow**

---

## Product Flow

### Control: `/pilot-scan` (Dense/Detailed)

```
/pilot-scan          → animated entry splash
/pilot-scan/start    → form (first/last/zip) + detailed value prop
/pilot-scan/loading  → animated scanning with broker progress
/pilot-scan/risk-summary → HEX CHART with risk areas, full tables
/pilot-scan/pre-profile  → validate scraped data (dense, multi-section)
/pilot-scan/report   → full carousel report
```

**Characteristics:**
- Information-rich
- Animated hexagon risk chart
- Multiple sections on-screen at once
- Dense tables and lists
- Professional, technical feel

### Variant: `/simple/scan` (Minimal/Grok Bot)

```
/simple/scan          → clean form (first/last/zip)
/simple/scan/loading  → minimal spinner + progress bar
/simple/scan/reveal   → PUNCHY CARDS showing "we found X things"
/simple/scan/validate → review scraped data, one section at a time
/simple/scan/signup   → email capture
```

**Characteristics:**
- Conversational, friendly
- Lots of whitespace
- One action per screen
- Short copy
- Calm, sparse chrome
- Punchy cards (not tables)

---

## What's Shared (Same Backend)

Both flows use:
- ✅ Same data broker scraper (FPS, NPD, AnyWho, Zaba)
- ✅ Same Edge Functions (`intro-scan`, `pilot-scan`)
- ✅ Same Supabase tables (`quick_scans`, `quickscan_enrichment`)
- ✅ Same consolidated profile data structure
- ✅ Same Holehe + Leakcheck enrichment

**The only difference is UI presentation.**

---

## Routes

### Simple Variant

| Route | Component | Purpose |
|-------|-----------|---------|
| `/simple/scan` | `SimpleScanEntry` | Form to start scan (first/last/zip) |
| `/simple/scan/loading` | `SimpleScanLoading` | Loading spinner + progress |
| `/simple/scan/reveal` | `SimpleScanReveal` | "Oh shit" moment - show what was found in cards |
| `/simple/scan/validate` | `SimpleScanValidate` | Review/approve scraped data |
| `/simple/scan/signup` | `SimpleScanSignup` | Email capture to create account |

All routes defined in `/workspace/apps/app/src/App.tsx`.

---

## Design Principles

### Grok Bot Inspiration

1. **Lots of air** — whitespace is a feature
2. **Short copy** — conversational, not marketing
3. **One action at a time** — never two CTAs competing
4. **Calm chrome** — minimal nav, no clutter
5. **Cards over tables** — digestible chunks

### Example: Reveal Screen

**Dense control** (current `/pilot-scan/risk-summary`):
```
[Hex chart with 6 risk areas]
[Table: Critical exposures (12 rows)]
[Table: Emails found (4 rows)]
[Table: Relatives (8 rows)]
[Graph: Breach timeline]
[CTA: Start removal process]
```

**Simple variant** (`/simple/scan/reveal`):
```
[Alert icon]
"We found 28 pieces of your data"
"This is what's publicly available about you."

[Card: 4 emails]
[Card: 3 phones]
[Card: 7 addresses]
[Card: 14 relatives]

[CTA card: "Want to remove this?"]
[Button: See full details]
```

---

## Development

### File Structure

```
apps/app/src/pages/simple/scan/
├── entry.tsx       # Form to start scan
├── loading.tsx     # Loading state
├── reveal.tsx      # "Oh shit" dossier reveal
├── validate.tsx    # Review scraped data
├── signup.tsx      # Email capture
└── index.ts        # Exports
```

### Running Locally

```bash
cd /workspace
pnpm install
pnpm dev
```

Then visit:
- Dense control: http://localhost:5173/pilot-scan
- Simple variant: http://localhost:5173/simple/scan

### Reusing Pilot Scan Utilities

The simple variant imports shared utilities from `/pilot-scan`:

```typescript
import {
  loadConsolidatedProfile,
  toProperCase,
  formatPhone,
  parseFullAddress,
  type ConsolidatedProfile,
} from "@/pages/pilot-scan/consolidated-profile";
```

This ensures both flows use the **exact same data structure**.

---

## A/B Testing Strategy

### Hypothesis

The dense control optimizes for authority and completeness.
The simple variant optimizes for clarity and emotional impact.

**We're testing:** Does a minimalist presentation increase conversion from scan → signup?

### Metrics to Track

- **Completion rate:** % who finish the scan
- **Reveal engagement:** Time on reveal page
- **Validation dropoff:** % who abandon at validate step
- **Signup conversion:** % who enter email after seeing results
- **Time to conversion:** Scan start → signup

### Implementation

1. **Traffic split:** 50/50 randomization at landing
2. **Session tracking:** All events logged to same `quick_scans` table
3. **Tagging:** Add `variant: 'simple' | 'dense'` field to scan records
4. **Analysis:** Compare conversion funnels side-by-side

---

## Key Differences from Dense Control

| Aspect | Dense (`/pilot-scan`) | Simple (`/simple/scan`) |
|--------|----------------------|-------------------------|
| Entry | Animated splash + long value prop | Clean form, minimal copy |
| Loading | Animated progress with broker names | Spinner + progress bar |
| Reveal | Hex chart + tables | Punchy stat cards |
| Validation | All sections on one page | One section at a time |
| Chrome | Header with nav, progress indicator | Logo only, no nav |
| Copy | Professional, detailed | Conversational, short |
| Actions | Multiple CTAs | One CTA per screen |

---

## Success Criteria

**Ship when:**
- ✅ All 5 screens render correctly
- ✅ Scan backend integration works (same as `/pilot-scan`)
- ✅ Data flows from scan → reveal → validate → signup
- ✅ No auth errors or API failures
- ✅ Mobile-responsive
- ✅ Loads under 2 seconds

**A/B test is successful if:**
- Simple variant has **>10% higher** signup conversion
- Time to conversion is **<20% longer** than dense (some loss acceptable for clarity)
- Reveal engagement is **equal or higher** (validates "oh shit" impact)

---

## Notes for James

1. **The scrape is the product.** Don't skip it, stub it, or replace it with fake data. The "oh shit" moment only works with real data.

2. **Validation is key.** Users need to see their scraped data is accurate before trusting us to remove it. This is where conversion happens.

3. **Mobile-first.** Most users will see this on their phone. Test at 375px width.

4. **Fast loading.** The simpler UI should feel faster, even though the backend is the same. Progress indicators matter.

5. **Copy tone.** "We found 28 pieces of your data" is better than "28 data exposures detected across 4 brokers."

---

## Deployment

This variant ships on the same branch as the dense control. No separate deployment needed.

**To test:**
- Dense: app.vanyshr.com/pilot-scan
- Simple: app.vanyshr.com/simple/scan

**To measure:**
- Add `?variant=simple` query param for forced assignment
- Check `quick_scans.variant` field in Supabase

---

## Related Docs

- `docs/SCAN_SEQUENCE.md` — How the scraper works
- `docs/scraper-data-flow.md` — Data pipeline
- `docs/PILOT_SCAN_DEPLOYMENT.md` — Backend deployment
- `apps/app/src/pages/pilot-scan/*` — Dense control UI
