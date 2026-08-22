/**
 * Detail-page parser checks against lab HTML fixtures. Same convention as
 * html-scrapers_test.ts, for the Phase 2 (full-profile) parsers.
 * Run: deno run --allow-read supabase/functions/_shared/quickscan/detail-scrapers_test.ts
 */
import { parseAnywhoDetail, parseFpsDetail } from "./detail-scrapers.ts";

const FIX = Deno.env.get("LAB_FIXTURES") ??
  "/Users/jameso/DevWork/vanyshr-stack/vanyshr-scraper-sequence/tests/fixtures";

try {
  await Deno.stat(FIX);
} catch {
  console.log(`skip: fixtures not found at ${FIX}`);
  Deno.exit(0);
}

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// ---------------------------------------------------------------------------
// FPS
// ---------------------------------------------------------------------------

const fpsHtml = await Deno.readTextFile(`${FIX}/fps/james_oehring_mo_profile.html`);
const fps = parseFpsDetail(fpsHtml);
assert(fps.fullName === "James Oehring", `FPS name: ${fps.fullName}`);
assert(fps.bornDate === "June 1965", `FPS bornDate: ${fps.bornDate}`);
// Was 10 -- silently dropped 36-39 of 46-49 relatives before the cap was
// raised on the Python side; ported here too since parseFpsDetail never had
// a cap of its own but is worth guarding against one being added blindly.
assert((fps.relatives?.length ?? 0) >= 40, `FPS relatives: ${fps.relatives?.length}`);
assert(fps.relatives?.[0]?.birthMonth, `FPS relative birthMonth missing: ${JSON.stringify(fps.relatives?.[0])}`);
const fpsPhone = fps.phoneDetails?.[0];
assert(fpsPhone?.type === "Landline", `FPS phone type: ${fpsPhone?.type}`);
assert(fpsPhone?.carrier, `FPS phone carrier missing: ${JSON.stringify(fpsPhone)}`);
const fpsAddr = fps.previousAddresses?.[0];
assert(fpsAddr?.county?.endsWith("County"), `FPS previous address county: ${fpsAddr?.county}`);
assert(fpsAddr?.recordedDate, `FPS previous address recordedDate missing: ${JSON.stringify(fpsAddr)}`);
assert(fps.employment?.[0]?.employer === "RINGLDR", `FPS employment: ${JSON.stringify(fps.employment)}`);
const fpsProps = fps.properties?.[0] ?? {};
assert(fpsProps.occupancyType === "Owner Occupied", `FPS property occupancyType: ${fpsProps.occupancyType}`);
assert(fpsProps.lotSqFt === 8712, `FPS property lotSqFt: ${fpsProps.lotSqFt}`);
console.log(`✓ FPS ${fps.fullName} — aliases/employment/relatives-demographics/phone-detail/property fields`);

// A second fixture so the aliases/associates/jobHistory/education checks
// aren't tuned to a page that happens to lack those sections.
const clarkHtml = await Deno.readTextFile(`${FIX}/fps/lucas_clark_mo_profile.html`);
const clark = parseFpsDetail(clarkHtml);
assert(
  (clark.aliases ?? []).includes("Lucas C Ward"),
  `FPS Clark aliases: ${JSON.stringify(clark.aliases)}`,
);
assert((clark.associates?.length ?? 0) >= 25, `FPS Clark associates: ${clark.associates?.length}`);
assert(clark.associates?.[0]?.birthMonth, `FPS Clark associate birthMonth missing`);
assert((clark.jobHistory?.length ?? 0) >= 5, `FPS Clark jobHistory: ${clark.jobHistory?.length}`);
assert(
  clark.education?.[0]?.school === "NORTHWEST MISSOURI STATE UNIVERSITY",
  `FPS Clark education: ${JSON.stringify(clark.education)}`,
);
console.log(`✓ FPS ${clark.fullName} — aliases/associates/jobHistory/education fields`);

// ---------------------------------------------------------------------------
// AnyWho
// ---------------------------------------------------------------------------

const anyHtml = await Deno.readTextFile(`${FIX}/anywho/james_oehring_mo_profile.html`);
const anywho = parseAnywhoDetail(anyHtml);
assert(anywho.fullName === "James A Oehring", `AnyWho name: ${anywho.fullName}`);
assert(
  (anywho.aliases ?? []).includes("James Allen Oehring Jr."),
  `AnyWho aliases: ${JSON.stringify(anywho.aliases)}`,
);
assert(anywho.relatives?.[0]?.gender === "Female", `AnyWho relative gender: ${anywho.relatives?.[0]?.gender}`);
assert(anywho.relatives?.[0]?.age === 65, `AnyWho relative age: ${anywho.relatives?.[0]?.age}`);
const anywhoPhone = anywho.phoneDetails?.find((p) => p.number === "816-225-8592");
assert(anywhoPhone?.location === "Kansas City, MO", `AnyWho phone location: ${anywhoPhone?.location}`);
assert(anywhoPhone?.carrier === "AT&T", `AnyWho phone carrier: ${anywhoPhone?.carrier}`);
assert(anywho.legalRecords?.nationwideCount === 4, `AnyWho legalRecords nationwide: ${anywho.legalRecords?.nationwideCount}`);
assert(
  anywho.legalRecords?.countyRecords?.location === "Dekalb, Missouri",
  `AnyWho legalRecords county: ${JSON.stringify(anywho.legalRecords?.countyRecords)}`,
);
const typedAddresses = (anywho.previousAddresses ?? []).filter((a) => a.propertyType);
assert(typedAddresses.length > 0, `AnyWho addresses with propertyType: ${typedAddresses.length}`);
console.log(`✓ AnyWho ${anywho.fullName} — aliases/relative-gender/phone-location/legalRecords/propertyType fields`);

console.log("all detail-scraper fixtures passed");
