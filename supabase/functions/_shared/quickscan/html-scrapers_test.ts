/**
 * Parser checks against lab HTML fixtures.
 * Run: deno run --allow-read supabase/functions/_shared/quickscan/html-scrapers_test.ts
 */
import {
  parseAnywhoSummaries,
  parseFpsSummaries,
  parseNpdSummaries,
  parseZabaSummaries,
} from "./html-scrapers.ts";

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

const fpsHtml = await Deno.readTextFile(`${FIX}/fps/james_oehring_mo.html`);
const fps = parseFpsSummaries(fpsHtml);
assert(fps.length > 0, `FPS: expected results, got ${fps.length}`);
assert(fps[0].full_name === "James Oehring", `FPS name: ${fps[0].full_name}`);
assert(fps[0].age === 61, `FPS age: ${fps[0].age}`);
assert(fps[0].address.includes("413 Lovers Ln"), `FPS address: ${fps[0].address}`);
assert(
  (fps[0].relatives || "").includes("Rickilinda Oehring"),
  `FPS relatives: ${fps[0].relatives}`,
);
console.log(`✓ FPS ${fps.length} results — ${fps[0].full_name} ${fps[0].address}`);

const npdHtml = await Deno.readTextFile(`${FIX}/npd/james_oehring_mo.html`);
const npd = parseNpdSummaries(npdHtml);
assert(npd.length > 0, `NPD: expected results, got ${npd.length}`);
assert(/oehring/i.test(npd[0].full_name), `NPD name: ${npd[0].full_name}`);
console.log(`✓ NPD ${npd.length} results — ${npd[0].full_name} ${npd[0].address}`);

const anyHtml = await Deno.readTextFile(`${FIX}/anywho/james_oehring_mo.html`);
const any = parseAnywhoSummaries(anyHtml);
assert(any.length > 0, `AnyWho: expected results, got ${any.length}`);
assert(/oehring/i.test(any[0].full_name), `AnyWho name: ${any[0].full_name}`);
console.log(`✓ AnyWho ${any.length} results — ${any[0].full_name} ${any[0].address}`);

const zabaHtml = await Deno.readTextFile(`${FIX}/zaba/james_oehring_mo.html`);
const zaba = parseZabaSummaries(zabaHtml);
assert(zaba.length > 0, `Zaba: expected results, got ${zaba.length}`);
assert(/oehring/i.test(zaba[0].full_name), `Zaba name: ${zaba[0].full_name}`);
assert(zaba[0].birth_date === "1988", `Zaba birth_date: ${zaba[0].birth_date}`);
console.log(`✓ Zaba ${zaba.length} results — ${zaba[0].full_name} ${zaba[0].address}`);

// Was capped at 5 -- silently dropped phones/aliases on real profiles. Also
// exercises the JSON-LD relatives fallback + position/age-matched birthDate
// across two distinct same-named people on one page.
const clarkHtml = await Deno.readTextFile(`${FIX}/zaba/lucas_clark_mo.html`);
const clark = parseZabaSummaries(clarkHtml);
assert(clark.length === 2, `Zaba Clark: expected 2 people, got ${clark.length}`);
const byAge = Object.fromEntries(clark.map((r) => [r.age, r]));
assert(byAge[34]?.birth_date === "1991", `Zaba Clark age-34 birth_date: ${byAge[34]?.birth_date}`);
assert(byAge[30]?.birth_date === "1996", `Zaba Clark age-30 birth_date: ${byAge[30]?.birth_date}`);
assert(
  (byAge[34]?.relatives || "").includes("Brandon Keith Clark"),
  `Zaba Clark age-34 relatives (DOM blank, JSON-LD fallback): ${byAge[34]?.relatives}`,
);
assert(
  (byAge[34]?.phone || "").split(",").length > 5,
  `Zaba Clark age-34 phones should exceed the old cap of 5: ${byAge[34]?.phone}`,
);
assert(
  (byAge[34]?.job_history || "").includes("Civicplus"),
  `Zaba Clark age-34 job_history: ${byAge[34]?.job_history}`,
);
assert(
  (byAge[34]?.education || "").includes("Northwest Missouri State University"),
  `Zaba Clark age-34 education: ${byAge[34]?.education}`,
);
console.log(`✓ Zaba (Clark, 2 people) birthDate/relatives-fallback/job_history/education/uncapped phones`);

const claireHtml = await Deno.readTextFile(`${FIX}/zaba/claire_inman_ks.html`);
const claire = parseZabaSummaries(claireHtml);
assert(claire.length > 0, `Zaba Claire: expected results, got ${claire.length}`);
assert(
  (claire[0].associates || "").includes("cameron bishop"),
  `Zaba Claire associates: ${claire[0].associates}`,
);
console.log(`✓ Zaba Claire associates ("Possible Associations")`);

console.log("all parser fixtures passed");
