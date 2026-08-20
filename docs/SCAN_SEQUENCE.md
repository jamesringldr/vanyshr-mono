# Pilot Scan — Sequence Rework

**Status:** design, not built. §7 resolved 2026-08-20 from a saved zaba page; spec is complete.
**Supersedes:** the fast/slow two-tier Phase 1 and its client-side merge.
**Related:** `docs/SCHEMA_REVIEW.md` (why the DB looks like it does), `docs/PUNCHLIST.md` (current integration state).

---

## 1. Why rewrite the sequence

The flow works backwards today: it asks the user to confirm emails **before** running
the scrape that discovers emails. The precise mechanism, traced end to end on
2026-08-20:

```
zaba is shown first  →  user picks a zaba profile
                     →  scrapeBrokerDetails() short-circuits:
                          if (!profile_url) return summaryFallback(...)
                     →  zaba has NO profile_url (0 of 13 in production)
                     →  parseZabaDetail() is never reached
                     →  no emails extracted
                     →  email modal renders empty
                     →  Confirm is disabled while every value is blank
                     →  the user cannot proceed; Phase 2 is never invoked
```

Verified against production: 4 browser scans, 8 Phase-1 cost rows, **0 Phase-2
cost rows, 0 dedup groups, 0 enrichment rows**. A scripted call with the same
payload succeeded, so the backend was never at fault — the client could not reach it.

`parseZabaDetail` exists, is registered in `DETAIL_PARSERS`, and is unreachable.

### The deeper problem

Phase 1 currently deduplicates *speculatively*: it groups ~13 zaba + 12 fps + 8 npd
+ 16 anywho records into "people" before anyone has said which person they are.
That is a hard, low-information problem, and it is why one man came back as two
cards.

The rework inverts it. **The user identifies themselves first**, and matching
becomes one-reference-against-many with a known target — a far better-posed
problem, and one the address parser and name canonicaliser already serve.

---

## 2. The sequence

```
PHASE 1 — SUMMARY SWEEP
  All four summary scrapes fire in parallel. No matching, no dedup, no grouping.
  Results are presented ONE BROKER AT A TIME for identification:

      zaba  ──(none of these / no results)──▶  fps  ──▶  anywho

  npd is collected but never shown; it participates in matching only.
        │
        └─ user picks their profile ───────────────────────────┐
                                                                │
MATCH — REFERENCE RESOLUTION                                    │
  The picked record is the reference. Match it against every    │
  other broker's already-collected summaries to resolve their   │
  profile_urls. Scoring, not fixed rules (§4).                  │
        │                                                       │
PHASE 2 — FULL PROFILE                                          │
  Scrape the full profile of EVERY target, including the one    │
  the user picked:                                              │
     • fps / npd / anywho → fetch profile_url, run detail parser│
     • zaba               → same URL, richer extraction (§7)    │
  Normalize (§5). Write to DB.                                  │
        │                                                       │
        └─ email modal: deduped list, user removes/adds, submits┘
                                                                │
PHASE 3 — ENRICHMENT                                            │
  holehe + leakcheck against the CONFIRMED emails only.         │
  Update the Phase 2 enrichment row in place.                   │
        │
        └─▶ risk summary
```

**Every scan gets a full profile scrape.** Even with zero cross-broker matches,
the picked target is always scraped. There is no path where Phase 2 does nothing.

---

## 3. Phase contracts

### Phase 1 — summary sweep

| | |
|---|---|
| In | `{ firstName, lastName, zipcode, city, state, sessionId, broker }` |
| Out | `{ quick_scan_id, broker, results[] }` — raw summaries, **ungrouped** |
| DB | `quick_scans` upsert on `session_id`; this broker's results merged into `candidate_matches` under its own key |
| Cost | `phase = 1`, one row per broker |

`candidate_matches` becomes keyed **by broker** (`zaba`/`fps`/`npd`/`anywho`)
rather than by tier (`fast`/`slow`). `quickscan.record_phase1_tier()` already does
exactly this — it merges under an arbitrary key and is atomic across concurrent
callers, so it needs no change beyond what is passed as `p_tier`.

### Match — reference resolution

Not a network phase; pure computation over data already held.

| | |
|---|---|
| In | picked record + all brokers' summaries from `candidate_matches` |
| Out | list of `{ broker, profile_url, match_score }` |
| DB | none |

### Phase 2 — full profile

| | |
|---|---|
| In | `{ quick_scan_id, picked_record, matched_targets[] }` |
| Out | `{ dedup_group_id, enrichment_id, consolidated_profile, emails[] }` |
| DB | insert `quickscan_dedup_groups` (the picked person + matched members); insert `quickscan_enrichment` with `emails_found`, `emails_extracted_at`, `consolidated_profile`, and `holehe_status`/`leakcheck_status` left at `'pending'` |
| Cost | `phase = 2` |

The enrichment row is written **here**, before the user confirms anything. A scan
abandoned at the email modal keeps its profile and emails instead of vanishing.

### Phase 3 — enrichment

| | |
|---|---|
| In | `{ quick_scan_id, enrichment_id, confirmed_emails[] }` |
| Out | `{ services_found[], breaches[], coverage }` |
| DB | **UPDATE** the Phase 2 enrichment row: `services_found`, `services_checked`, `breaches`, `breach_count`, `holehe_status`, `holehe_checked_at`, `leakcheck_status`, `leakcheck_checked_at`, `fields_exposed`, `completed_at`; set `quick_scans.status='completed'` |
| Cost | `phase = 3` — **requires a migration, see §6** |

`quickscan_enrichment` already carries a separate status and timestamp per
enrichment source. The schema was built for staged writes; only the code needs to
catch up.

---

## 4. Matching rules

Scoring, never fixed rules — brokers publish wrong ages, nicknames, and
inconsistent addresses, so any single hard gate produces wrong answers.

Existing weights in `DedupEngine.calculateMatchScore` (unchanged):

| signal | weight | notes |
|---|---|---|
| name | 45 | canonicalised given names: Jim ≡ James, Bob ≡ Robert |
| location | 35 | parsed components, not raw strings (`address-parser.ts`) |
| age | 10 | contextual only — cannot veto a match |
| broker | 10 | flat |

`MERGE_THRESHOLD = 75` (same person), `GROUP_THRESHOLD = 50` (possible match).

**Change of role, not of algorithm.** `deduplicate()` currently scores every
summary against every other. In the new sequence it scores *the picked record*
against each other broker's summaries and keeps the best per broker above
threshold. One reference, many candidates.

**A below-threshold broker is skipped, not forced.** Scraping a detail page for
the wrong person injects a stranger's PII into someone's privacy report — worse
than a thinner report.

---

## 5. Normalization

Does not exist today, which is why `+18162258592` and `(816) 225-8592` both reach
the UI as separate entries. Applies **on write**, after Phase 2 merges the brokers.

| field | rule | stored |
|---|---|---|
| phone | strip to digits, drop leading `1` on 11-digit, reject ≠10 digits | `(816) 225-8592` display; digits as the dedupe key |
| email | trim, lowercase | lowercased |
| address | `parseAddress()` → street / city / state / zip; suffix + state normalised | components |
| name | trim, collapse whitespace, title-case; given name canonicalised for matching only | as published |
| alias | same as name; deduped against the primary name and each other so a spelling variant is not listed twice | as published |
| age | **not merged** — take the mode across brokers; if any value differs from the mode by >3 years, set `age_conflict` and keep every reported value | mode + all variants |
| employer | strip legal suffixes (Inc, LLC, Corp, Co) and trailing descriptors before comparing (§7b) | best-formatted variant |

Dedupe on the **normalized key**, display the **best-formatted variant**. Never
show two spellings of one fact.

Age is the exception: it is a single-valued fact that brokers genuinely disagree
about (one production record showed 37 / 61 / 62 at the same street address), so
it is *resolved* rather than merged. `DedupEngine.getMostCommonAge()` and the
`age_conflict` / `age_note` fields already implement this — the consolidator must
carry them through instead of silently picking the first broker's answer.

---

## 6. Required DB changes

**a. `cost_tracking.phase` rejects Phase 3.**

```sql
CHECK ((phase = ANY (ARRAY[1, 2])))   -- a phase-3 insert is rejected outright
```

Must widen to `[1,2,3]`. This is the same failure class as the
`leakcheck_status='no_results'` bug: a CHECK violation aborts the whole insert,
and because cost tracking is best-effort the loss is silent.

**b. `quickscan_enrichment` has no unique key.**

Four Phase 2 calls on one scan produced four dedup groups and four enrichment
rows. With Phase 3 updating what Phase 2 wrote, a retry must not fork the row:

```sql
ALTER TABLE quickscan.quickscan_enrichment
  ADD CONSTRAINT quickscan_enrichment_scan_group_key
  UNIQUE (quick_scan_id, dedup_group_id);
```

**c. No new columns.** `emails_extracted_at`, `holehe_status`/`holehe_checked_at`,
`leakcheck_status`/`leakcheck_checked_at`, `completed_at` already model the stages.

---

## 7. RESOLVED — zaba full-profile extraction

Answered from a saved production page (Lucas Clark, Kansas City MO), 59KB,
2026-08-20.

### How a person is addressed

`<div class="person">` is the per-person container — 2 on that page. The summary
scraper **already iterates exactly this selector**:

```ts
// html-scrapers.ts:586
for (const card of Array.from(doc.querySelectorAll("div.person")).slice(0, MAX_RESULTS) as El[]) {
```

So the ordinal is available at summary time and needs no new parsing. Phase 1
records the index alongside each zaba summary; Phase 2 re-parses
`div.person[index]` with the richer extraction. **Positional addressing.**

There is no unique per-person id — `id="container-name"` is duplicated across
blocks (invalid HTML, but that is what ships), so the class + ordinal is the only
reliable handle. There is no per-person href either, which is why `profile_url`
is empty for all 13 production zaba records.

### Why it was doubly unreachable

`parseZabaDetail` refuses this page outright:

```ts
// Search-result feeds (div.person cards) aren't a detail page — bail, let the caller fall back.
if (doc.querySelectorAll("div.person").length > 0) return {};
```

So zaba could never produce detail data: no `profile_url` to trigger the call,
and a guard that bails if it were called anyway. Both must change.

### ⚠️ Zaba emails are MASKED — this reshapes Phase 3

The page does carry an "Associated Email Addresses" section, but the local part
is obfuscated:

```
person[0] (age 34): xxxxx@civicplus.com, xxxxxxxxx@att.net, xxxxxxxxxxxxxxx@gmail.com, …17 total
person[1] (age 30): xxxxxxxxx@sbcglobal.net, xxxxxxxxxx@aol.com
```

The codebase already assumes this — `detail-scrapers.ts:273` filters `/x{3,}/i`.

**Zaba can never contribute a usable email.** Consequences:

1. Zaba's full scrape is still worth running: relatives, phones, addresses,
   possible user IDs and estimated value are all real and absent from the summary.
2. **Emails come only from fps / npd / anywho detail pages.** A zaba pick with no
   cross-broker match yields no emails — a property of the source, not a failure.
3. **Phase 3 must be skippable, and the email modal must be passable while
   empty.** This is now a hard requirement, not a nicety. Manual entry is the
   only route to enrichment for a zaba-only identification.

### Re-fetch vs cache

Re-fetch the search URL at Phase 2. It is stateless, and the alternative — having
Phase 1 stash HTML — means carrying 59KB per scan for a page we can request again.
The risk is that results reorder between the two requests, which would invalidate
the stored index; guard by re-matching on name + age + address rather than
trusting the ordinal blindly.

### Test fixtures

Two cleanly distinguishable people, useful for matching tests:

| | age | address |
|---|---|---|
| person[0] | 34 | 7935 Holmes RD, Kansas City, Missouri 64131 |
| person[1] | 30 | 9351 Valley Garden DR, Kansas City, Missouri 64139 |

Reference URL (`buildZabaUrl`, byte-identical to production):

```
https://www.zabasearch.com/people/lucas-clark/missouri/kansas-city
```

---

## 7b. Extraction coverage — what we take from whom

Verified against the saved zaba page (Lucas Clark, Kansas City MO) on 2026-08-20.

### Per-broker field authority

Brokers are not interchangeable. Each is canonical for the fields it does well,
rather than every broker contributing to every field and consolidation guessing.
Merging a weak source into a strong one costs accuracy for no gain.

| Field | Authority | Notes |
|---|---|---|
| Emails | **anywho** (then npd) | 6 real addresses recovered; zaba masks the same ones at source (§7) |
| Property detail | **fps** | beds / baths / sq ft / year built / est. value / county |
| Financial — net worth, assets | **anywho** | `$304,558`, asset count, in a dedicated section |
| Job history | **fps** | employer + location + title + start date + durations |
| Education | **zaba** | fps has the section but it was empty; zaba carried real content |
| Legal records | **anywho** | Legal Records (9) — not extracted today |
| Relatives / phones / addresses / aliases | all four | merge, dedupe on the normalised key (§5) |
| Age | all four | **resolved, not merged** — mode across brokers, conflicts surfaced (§5) |

Verified 2026-08-20 against saved full-profile pages for one person across all
three brokers. Two entries changed from the first draft: **job history moved
zaba → fps** (fps adds location, start date and durations; zaba's Job History
has title and employer only), and **emails resolved to anywho** as the primary.

Zaba *does* publish Estimated Value, Estimated Equity, Last Sale Amount and Last
Sale Date, but property is fps's strength and financial is anywho's — take those
there and ignore zaba's versions rather than reconciling three partial views.

### Per-broker obfuscation — and how to defeat it

Each broker hides data differently. Two of the three are recoverable; the parsers
handle none of it today.

| Broker | Obfuscation | Recoverable? |
|---|---|---|
| **fps** | none — clean HTML | n/a |
| **anywho** | CSS blur, value in a `data-content` attribute | **yes, fully** |
| **zaba** | server-side masking (`xxxxx@aol.com`) + a cosmetic blur on top | **no** |

**anywho — the fix is one preprocessing pass.** The blurred span is *empty* in the
DOM and the hidden text sits in `data-content`; the field is span-split around it:

```html
<span><span>w</span><span data-content="elctola" class="blur-sm before:content-[attr(data-content)]"></span><span>@aol.com</span></span>
```

Substitute each attribute as its span's text before parsing and the value
reassembles:

```ts
html.replace(/<span\s+data-content="([^"]*)"[^>]*>\s*<\/span>/g, "$1")
```

Then `welctola@aol.com` reads normally. Same trick recovers phone numbers
(`816263` + hidden `0393`) and street numbers (hidden `7935` + ` Holmes Rd`).
**53 elements on one page are affected**, so this is not an edge case — without
it every anywho email, several phones and several street numbers are silently
truncated.

⚠️ **Unverified:** whether anywho applies the same blur to its SUMMARY pages. If
it does, `parseAnywhoSummaries` is truncating data in production right now, and
those summaries feed both the picker and the matching step. Check before
building Phase 1.

**zaba is not recoverable.** The `.blur` class there
(`color:transparent;text-shadow:...`) sits on top of text that is *already*
`xxxxx` in the source, and all seven JSON-LD blocks carry the same masked
values. Nothing underneath.

### Anywho: "Online Presence (100)" is a teaser, not data

The section claims 100 social profiles and names Facebook, Twitter and
Instagram — but the body is marketing copy ("Social media information may
include: Online Aliases, Dating Profiles") with no actual profiles. Do not build
against it. Same judgement as zaba's "Possible User IDs" below.

### Job history: parse `Job History`, NOT `Jobs`

Both sections exist on the zaba page. They are not equivalent:

| | entries | usable | structure |
|---|---|---|---|
| `Jobs` | 24 | **9** | flat `<li>` string; 11 bare company names, plus 4 past addresses bleeding across the section boundary |
| `Job History` | 12 | **12** | structured, one record per `<li>` |

`Job History` markup is genuinely addressable:

```html
<li>
  <p><strong>Lucas Clark</strong><br>Civicengage Consultant</p>
  <p>Civicplus</p>
</li>
```

→ `<strong>` = person, text after `<br>` = title, second `<p>` = employer.

**Trade-off, stated plainly:** `Jobs` is the only section carrying date ranges
("Since 2018", "2016-2018"), and `Job History` has none. Dates are lost by
choosing `Job History`. That is the right call anyway — 15 of 24 `Jobs` rows are
noise, and the employer is duplicated as a leading token in every real one
("Civicplus Sales Representative at Civicplus"). If dates prove necessary later,
mine `Jobs` purely for them and join on (title, employer); do not use it as the
record source.

### Company-name normalisation is required

The same employer appears under several spellings, and punctuation-stripping is
not enough:

```
"Ehawk, Inc"  vs  "Ehawk,"                    -> ehawkinc vs ehawk      (still distinct)
"Netsmart Technologies" vs "Netsmart"          -> still distinct
```

Needs a normaliser that strips legal suffixes (Inc, LLC, Corp, Co) and trailing
descriptors, in the same shape as the street-suffix normalisation in
`address-parser.ts`. Without it, one employer renders as three jobs.

### Fields that have nowhere to go

`BrokerDetailProfile` currently holds only: `fullName`, `age`, `primaryAddress`,
`previousAddresses`, `phoneNumbers`, `emails`, `relatives`, `associates`, and
`properties?: never[]` — the last explicitly typed as unusable
("none of the current parsers extract real property/asset records").

So even once parsed, these have no destination:

| Data | Needs |
|---|---|
| Job history | `jobs?: { title, employer, start?, end? }[]` |
| Education | `education?: { degree?, field?, institution, year? }[]` |
| Property detail (fps) | `properties` retyped from `never[]` to real records |
| Financial (anywho) | `financial?: { netWorth?, assetCount? }` |

`ConsolidatedProfile` needs matching additions, and `consolidated_profile` is
JSONB so no migration is required — but the risk-summary areas need somewhere to
render them, which is a UI decision (`docs/PUNCHLIST.md` §2.1).

**Note:** the legacy `/scan` pipeline stored `jobs`, `education`, `assets`,
`legal_records`, `background_records` and `social_profiles` in
`quick_scans.profile_data` (see retained rows in `docs/SCHEMA_REVIEW.md` §4). The
quickscan model narrowed the shape. These additions restore ground already held.

### Considered and rejected: "Possible User IDs"

Zaba lists entries like `210228332@linkedin`, `235632182@twitter`,
`5a/4a3/ab8@linkedin`, `#ab84a35a@linkedin`. **Do not extract these.**

- Bare `<li>` text — no href, no data attribute, nothing to resolve against
  (the phone numbers immediately below *are* linked, so this is not an oversight)
- Two of the four are visibly mangled (slashes, a leading `#`)
- Zaba itself hedges: the heading is "**Possible** User IDs"
- A numeric platform id is meaningless to a reader
- Asserting the wrong social account in a privacy report is worse than omitting
  it, and a 50% visible-garbage rate is a poor base

Recorded here so it is not re-litigated.

---

## 8. What survives, what goes

**Survives unchanged**
- `quick_scans` + `quickscan.record_phase1_tier()` — already atomic and key-agnostic
- `public.get_pilot_scan_result()` — the read path
- `address-parser.ts`, name canonicalisation, the scoring weights
- `quickscan_enrichment`'s staged columns
- Retention: `purge_after` defaults, the FK, `promote_pending_profile`

**Goes away**
- Client-side `mergeScanResults` — no cross-tier merge to do
- Speculative up-front `deduplicate()` over all brokers
- The fast/slow tier split, replaced by progressive per-broker presentation

**Must be fixed**
- `scrapeBrokerDetails`'s `if (!profile_url) return summaryFallback(...)` short-circuit — the direct cause of the empty email modal
- Email modal moves from between pick and Phase 2, to between Phase 2 and Phase 3
- Confirm must be reachable with an empty list — mandatory, not cosmetic: a
  zaba-only identification legitimately yields zero emails (§7)
- `parseZabaDetail` must stop bailing when it sees `div.person`, and must accept
  an ordinal to target one person

---

## 9. Build order

1. **§6 migrations** — cheap, and Phase 3 cannot be tested without them
2. **Normalization module** (§5) with tests — Phase 2 depends on it
3. **Phase 2 full-profile scrape incl. zaba** — drop the `!profile_url`
   short-circuit, drop `parseZabaDetail`'s `div.person` bail, add ordinal
   targeting (§7)
4. **Match step** — retarget `DedupEngine` to reference-vs-candidates
5. **Phase 1 rework** — per-broker endpoint + progressive UI
6. **Phase 3** split out of the current Phase 2
7. **Client rewrite** — progressive picker, modal moved, `mergeScanResults` deleted

Steps 1–2 are backend-only and unblock everything else. Step 5 and 7 are the
client rewrite and should be one piece of work, not two.
