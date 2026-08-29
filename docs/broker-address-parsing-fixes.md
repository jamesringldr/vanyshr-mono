# AnyWho + FPS detail-page address parsing — fixed

**Status:** Fixed and tested against real broker HTML for both AnyWho and
FPS (`dev/quickscan-ui`). FPS turned out to be the bigger issue — broken on
12 of 13 previous addresses on one real profile, not an edge case.

**Where this started:** chasing a report-page bug where a user's
current/past addresses rendered duplicated and garbled, e.g.:

```
413 Lovers Ln Cameron MO 64429
Lovers Ln Cameron, MO
```

Confirmed against a real `quickscan.consolidated_profile.primary_address`
value (via the client's own `sessionStorage`):

```
'413 Lovers Ln Cameron MO 64429, Lovers Ln Cameron, MO, 64429'
```

Two real saved HTML pages (AnyWho and FPS, both for the same test profile,
"Lucas Clark") were used to verify every fix below against ground truth
rather than guessing at DOM shape.

## Bug #1 — AnyWho: whole address in the heading gets doubled

`supabase/functions/_shared/quickscan/detail-scrapers.ts`,
`parseAnywhoDetail()`, the `#addresses` section loop.

**Mechanism:** `streetText = textOf(heading)` sometimes comes out as the
**entire** address with no comma at all (`"413 Lovers Ln Cameron MO
64429"`) rather than just the street. `containerText = textOf
(heading.parentElement)` necessarily re-includes the heading's own text,
and the `locationMatch` regex against that wider text found a second,
differently-formatted copy of the same address — comma-punctuated but
missing the house number. `addrFromParts()` then joined `street` (already
the whole address) with the separately-parsed `city, state, zip`, doubling
it.

**Fix:** parse the heading on its own first via the shared `parseAddress()`
helper (`address-parser.ts`), which already had a street-suffix-boundary
fallback for exactly this no-comma shape. Only fall back to the original
`containerText` regex for whichever of `city`/`state` the heading alone
didn't resolve.

When the heading is just a clean street (the common case — confirmed
against real HTML, all 15 addresses on the sample AnyWho profile), this
new branch is skipped entirely and behavior is unchanged from before.

## Investigating Bug #1 surfaced a false alarm, and a much bigger real one

While building a synthetic "clean heading" fixture to verify Bug #1's fix
didn't regress the common case, the fixture — hand-written with normal
spacing between `<h4>` and `<p>` tags — triggered what looked like a
second bug: the `containerText` regex swallowing a street suffix into
"city" (`"Lovers Ln Cameron"` instead of just `"Cameron"`). Testing against
the **real** AnyWho HTML showed this doesn't happen: AnyWho's actual
markup has **zero whitespace** between `</h4>` and `<p>` (a bundler
artifact), which breaks the regex's ability to chain across that boundary
in a way my hand-formatted test fixture, with incidental whitespace
between tags, didn't reproduce. Real HTML gave clean output before and
after the fix — false alarm, real markup doesn't have this shape.

**Checking the real FPS HTML the same way, to be sure, surfaced the actual
bigger bug:**

## Bug #2 — FPS: current address duplicated the same way as AnyWho

`parseFpsDetail()`, `#current_address_section h3 a`. FPS's current-address
link text is the **whole address**, space-joined with no comma at all
(`"7935 Holmes Rd Kansas City MO 64131"`) — confirmed against real HTML.
The old code read the link as `street`, then regexed `city`/`state`/`zip`
out of `blockText` (which necessarily re-includes the link's own text),
duplicating the address exactly like Bug #1. Same fix: run it through
`parseAddress()`.

## Bug #3 — FPS: previous addresses mis-parsed on 12 of 13 real entries

`parseFpsDetail()`, `#previous-addresses dt.address-link a`. FPS's
previous-address link text is **also** space-joined with no comma before
the city (`"3301 Treehouse LN Plano TX 75023"`), plus an optional `,
Unit N` before it (`"400 W 20th St, Unit 2117 Kansas City MO 64108"`).

The old regex (`/^(.+?)\s+([A-Za-z\s.]+?)\s+([A-Z]{2})\s+(\d{5}...)$/`)
has no way to find the real street/city boundary in a comma-less run — on
the real profile tested, it put just the house number in `street` and
dumped the entire street name + unit + city into `city`
(`street: "3301"`, `city: "Treehouse LN Plano"`). **12 of the profile's 13
previous addresses were broken this way** — this was not an edge case, it
was the dominant shape for FPS previous addresses.

**Fix:** same as above — route through `parseAddress()` instead of the
bespoke regex.

## Bug #4 (found while fixing #3) — `parseAddress()`'s own unit-designator handling

`address-parser.ts`, `parseAddress()`. Its existing unit-designator
handling assumed a unit token landing at the front of the "city" slot
meant the **whole** slot was actually part of the street (correct for
AnyWho-style `"1225 Union Ave, Apt 502, Kansas City, MO"`, where the unit
gets its own comma-delimited chunk). FPS's shape puts the unit and the
real city in the **same** chunk after one comma (`"unit 2117 kansas
city"`), so the old logic dumped the real city into `street` too, losing
it — this is what caused Bug #3's `city: ""` for every address with a
unit number.

**Fix:** peel off just the unit token + whatever immediately follows it
(its number/id) and keep looking for a real city in what's left, instead
of assuming the whole fragment is street. Verified against all 10
pre-existing `address-parser.test.ts` cases (no regression) plus the real
FPS unit-number shapes.

## Bonus polish

`parseAddress()` lowercases everything for matching (fine for a dedup
key, wrong for display) — added a `titleCase()` helper in
`detail-scrapers.ts` for the callers that display its output, with a small
special case so directional abbreviations stay fully uppercase (`"447 NW
1151st Rd"`, not `"447 Nw 1151st Rd"`).

## What was patched client-side (still in place, defense-in-depth)

`apps/app/src/pages/pilot-scan/consolidated-profile.ts`,
`parseFullAddress()` — detects a repeated 5-digit zip in the raw string (a
reliable signal of Bug #1/#2's duplication shape) and truncates to the
first copy, then falls back to a street-suffix split when no comma marks
the boundary at all. With the server-side bugs fixed, new scrapes
shouldn't produce this shape any more, but this stays in place for
already-stored corrupted rows and as defense-in-depth generally.

## Verification

- `deno check` clean on `detail-scrapers.ts` and `address-parser.ts`.
- Full `_shared/quickscan` test suite: 76 passed, 0 failed, 3 pre-existing
  unrelated `.ignore`'d Zaba tests (confirmed broken identically with and
  without these changes — unrelated to this work).
- Two new tests in `address-parser.test.ts` (unit+city sharing one comma
  chunk; no comma at all before an alphanumeric unit id).
- One new test in `detail-scrapers.test.ts` per broker
  (`parseAnywhoDetail`, `parseFpsDetail`), both using realistic HTML shaped
  after the real files.
- Every fix was checked against the two real saved HTML pages
  (`~/Downloads/Anywho Full- Lucas W Clark...html`,
  `~/Downloads/fps full - Lucas Clark...html`) — all 15 AnyWho addresses
  and all 14 FPS addresses (1 current + 13 previous) parse correctly with
  the fixes applied, confirmed byte-for-byte against the actual saved
  markup, not synthetic guesses.

## Not checked

Zaba and NPD (`parseZabaDetail`, `parseNpdDetail`) weren't examined in
this pass — no real HTML was available for either. `parseNpdDetail`'s own
comment already flags it as "a first draft ... unverified until checked
against real National Public Data profile-page HTML," so it's a
reasonable next thing to check if similar duplication/mis-parse reports
come in from NPD- or Zaba-sourced addresses.
