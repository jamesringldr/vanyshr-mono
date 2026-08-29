# ReversePhoneLookup.com integration — journal

**Worktree:** `/Users/jameso/DevWork/vanyshr-stack/vanyshr-RPL-scraper`
**Branch:** `dev/rpl-scraper` (cut from `staging`)
**Date:** 2026-08-28

---

## Why this exists

`phone-lookup` (`supabase/functions/phone-lookup/index.ts`) is the edge
function behind reverse-phone-number search — a user types a phone number,
the function looks up who it belongs to. It has exactly **one** source
today: `ZabasearchScraper.searchByPhone()`. There is no fallback. If Zaba
has nothing for a number, or is blocked, or returns a thin result, the
whole lookup comes back empty or sparse — even when other public
people-search sites would have answered.

James found `reversephonelookup.com` returns richer per-number data than
Zaba for at least one real test case (himself), and wants it added as a
**second source** — the task here is to scrape it and wire it in as a
fallback (or a merge partner) alongside Zaba, not to replace Zaba.

## Current state — what exists today

`supabase/functions/phone-lookup/index.ts`, in full:

```ts
const scraper = new ZabasearchScraper();
const matches = await scraper.searchByPhone(normalized);

if (matches.length === 0) {
  return json({ error: "no_result" }, 404);
}

const match = matches[0];
// ...
return json({
  phone, source_url, name, age,
  birth_year: null, line_type: null, carrier: null,
  time_zone: null, aliases: [], related_persons: [],
  most_recent_address: null, previous_addresses: [],
  email_domains: [], previous_phones: [], social_media: [],
  jobs: [], education: [], professional_licenses: [],
  location: match.city_state ?? null,
});
```

The response shape is `ZabaPhoneResult`, defined in
`packages/shared/src/types/index.ts`:

```ts
export type ZabaPhoneResult = {
  phone: string;
  source_url: string;
  name: string | null;
  age: string | null;
  birth_year: string | null;
  line_type: string | null;
  carrier: string | null;
  location: string | null;
  time_zone: string | null;
  aliases: string[];
  related_persons: Array<{ name: string; href: string }>;
  most_recent_address: string | null;
  previous_addresses: string[];
  email_domains: string[];
  previous_phones: string[];
  social_media: string[];
  jobs: string[];
  education: string[];
  professional_licenses: string[];
};
```

Note how much of it is **hardcoded null** today:
`birth_year`, `line_type`, `carrier`, `time_zone`, `aliases`,
`related_persons`, `most_recent_address`, `previous_addresses`,
`email_domains`, `previous_phones`, `social_media`, `jobs`, `education`,
`professional_licenses` — all always empty/null, because
`ZabasearchScraper.searchByPhone()` only returns search-result-card data
(name, age, city/state), not a full profile. This function has never had
a real detail-level source; it's been running on summary-card scraps the
whole time.

**This is the target-rich part of the task** — `reversephonelookup.com`'s
JSON-LD, on the one real sample here, directly answers several of these
currently-always-null fields (see below).

## What reversephonelookup.com actually returns — reviewed against real HTML

Sample file: `reversephonelookup-sample.html` (in this worktree root) —
saved from `https://www.reversephonelookup.com/number/8162258592/`, a
real lookup for James's own number, pulled 2026-08-28.

**The page is keyed by phone number**, not by name — the URL structure is
`/number/<10digits>/` (confirmed via the page's own `BreadcrumbList`
JSON-LD: `{"@id": "/number/8162258592/", "name": "8162258592"}`). This
matches phone-lookup's use case exactly (search by number, get a person
back) — more directly than Zaba's `searchByPhone()`, which is presumably
reusing Zaba's name-search results and filtering.

**The data itself lives in a clean `schema.org` JSON-LD `Person` block** —
same general pattern as Zaba's own JSON-LD (see
`docs/broker-address-parsing-fixes.md` in the main worktree for how that
looks), not scattered across ad-hoc DOM elements the way FPS/AnyWho/NPD
are. There are 3 `<script type="application/ld+json">` blocks on the
page: a `Person` (the one that matters), an `FAQPage` (a looser natural-
language summary, same pattern Zaba/AnyWho/NPD all use — useful as a
secondary source or a total-count check, not the primary extraction
target), and a `BreadcrumbList` (just confirms the URL structure, not
useful for data).

On this one real sample, the `Person` block had:

| Field | What's there |
|---|---|
| `name` / `alternateName` | "James Allen Oehring" / "Ja Oehring" |
| `birthDate` | `1988` (year only in the JSON-LD; FAQ block has the fuller "September 1988") |
| `telephone` | 2 numbers (FAQ says 5 total — JSON-LD's own array is a partial/truncated view, same pattern as Zaba's `telephone`/`email` arrays not matching their own FAQ counts) |
| `email` | 55 masked addresses (`x...@domain`, same masking style as every other broker — domain visible, local part redacted) |
| `homeLocation.address[]` | **14 addresses**, already broken into clean `streetAddress` / `addressLocality` / `addressRegion` / `postalCode` fields — no string-parsing needed at all if read straight from the JSON-LD, unlike FPS/AnyWho which hand you a blob string to split yourself |
| `jobTitle` / `worksFor` | "Analyst" at "Netsmart" — **not present in Zaba's data for this same person** |
| `relatedTo[]` | Donald L Oehring, Rickilinda Oehring — **Donald wasn't in Zaba or NPD's relatives for this person**, only Rickilinda was |

Two data-quality quirks worth knowing about before writing a parser:
- A few of the 14 addresses are near-duplicates with cosmetic differences
  — e.g. `"413 Lovers Ln"` vs `"413 loverslane"` (no space, all lowercase)
  as separate array entries. Likely worth deduping through the existing
  `normalizeAddress()` (`address-parser.ts`) the same way every other
  broker's addresses already get deduped in `consolidation.ts`, rather
  than treating each JSON-LD entry as automatically distinct.
- Some entries in `homeLocation.address[]` are lowercase
  (`"addressLocality":"cameron"`, `"addressRegion":"missouri"`) while
  most are properly cased. `parseAddress()` already lowercases everything
  internally for matching, so this shouldn't break dedup — but if this
  data gets displayed anywhere, it'll need the same `titleCase()` treatment
  `detail-scrapers.ts` now applies to FPS/AnyWho/NPD addresses (see
  `docs/broker-address-parsing-fixes.md`), since `streetAddress` here can
  arrive in either case.

**Not checked / open questions for whoever picks this up:**
- Only one real sample exists (James's own number). Structure for a
  **not-found** number, a **blocked/bot-check** response, or a number with
  genuinely thin data hasn't been observed — build in graceful degradation
  (empty results, not a thrown error) the same way every other scraper in
  this codebase does, per its own conventions.
- Whether `reversephonelookup.com` also has a **name-search** page (not
  just phone-number-keyed) wasn't checked — if it does, that'd make it a
  candidate for the summary-scan brokers list too, not just the
  phone-lookup fallback. Out of scope for this task as scoped, but worth
  a mental note.
- Bot-blocking / rate-limiting behavior is unknown — every other broker in
  this pipeline goes through `context-dev-client.ts` (a proxy/rendering
  service) specifically to deal with this; this site will likely need the
  same treatment rather than a direct `fetch()`.

## Getting started

1. **Read the real sample first**: `reversephonelookup-sample.html` in
   this worktree root. Open it, search for `application/ld+json`, and look
   at the `Person` block directly — it's the fastest way to see the shape
   before writing any code.
2. **Decide the source strategy**: given the data lives in one clean
   JSON-LD block per page, parsing this is much closer to how Zaba's
   JSON-LD gets read than to FPS/AnyWho's DOM-scraping — look at how the
   main worktree's `html-scrapers.ts` reads Zaba's JSON-LD (`jsonLdPersons`
   helper) as a starting pattern, rather than porting AnyWho/FPS's
   `querySelector` approach.
3. **Where this plugs in**: `phone-lookup/index.ts` currently does one
   `await scraper.searchByPhone(normalized)` call and returns immediately
   on `matches.length === 0`. The natural shape for a fallback: try Zaba
   first (existing behavior preserved), and when it returns nothing (or
   optionally, always) also fetch reversephonelookup.com and merge —
   James should confirm whether he wants "Zaba first, RPL as fallback
   only when Zaba is empty" or "always fetch both and merge" before this
   gets built, since that changes both latency (parallel vs sequential)
   and which fields win when both sources disagree.
4. **Fetching**: check whether `reversephonelookup.com` needs
   `context-dev-client.ts` (bot-check/rendering proxy) the way every other
   broker in this pipeline does — a direct `fetch()` may get blocked. No
   evidence either way from a single saved sample; test against a live
   fetch before assuming.
5. **Response shape**: map the `Person` JSON-LD directly onto the
   currently-null `ZabaPhoneResult` fields this integration would finally
   be able to fill in: `related_persons` ← `relatedTo`, `most_recent_address`
   / `previous_addresses` ← `homeLocation.address[]` (first vs rest, or
   however "most recent" gets determined — the JSON-LD doesn't obviously
   flag which of the 14 is current), `jobs` ← `jobTitle`/`worksFor`,
   `email_domains` ← the domain half of each masked `email` entry. `carrier`,
   `line_type`, `birth_year`, `time_zone`, `social_media`,
   `professional_licenses` have no obvious source in this sample either —
   may just stay null from this source too.
6. **Test against the real sample** before calling it done, the same way
   the address-parsing fixes in the main worktree
   (`docs/broker-address-parsing-fixes.md`) were verified against real
   AnyWho/FPS/NPD HTML rather than synthetic guesses — that approach
   caught bugs a hand-written test fixture completely missed (see that
   doc's "Investigating Bug #1 surfaced a false alarm" section for why
   synthetic HTML is not a substitute for the real thing when the exact
   whitespace/markup shape is what determines whether a parser works).
