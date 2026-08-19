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
  "/Users/jameso/DevWork/vanyshr-stack/vanyshr-pilot-scan-integration/tests/fixtures";

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
console.log(`✓ Zaba ${zaba.length} results — ${zaba[0].full_name} ${zaba[0].address}`);

console.log("all parser fixtures passed");
