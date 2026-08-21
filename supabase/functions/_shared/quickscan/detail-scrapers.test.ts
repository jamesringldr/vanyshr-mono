/**
 * Zaba detail targeting — the search page IS the profile page.
 * Run: deno test supabase/functions/_shared/quickscan/detail-scrapers.test.ts
 */
import { parseZabaDetail } from "./detail-scrapers.ts";

const TWO_PEOPLE = `<html><body>
<div class="person" data-age="34" data-id="aaa">
  <div id="container-name"><h2>Lucas Clark</h2></div>
  <div class="container-age"><h3>Age 34</h3></div>
  <div>
    <h3>Last Known Address</h3>
    <p>7935 Holmes RD<br>Kansas City, Missouri 64131</p>
  </div>
  <div>
    <h3>Associated Email Addresses</h3>
    <ul><li>lucas@civicplus.com</li></ul>
  </div>
</div>
<div class="person" data-age="30" data-id="bbb">
  <div id="container-name"><h2>Lucas Clark</h2></div>
  <div class="container-age"><h3>Age 30</h3></div>
  <div>
    <h3>Last Known Address</h3>
    <p>9351 Valley Garden DR<br>Kansas City, Missouri 64139</p>
  </div>
  <div>
    <h3>Associated Email Addresses</h3>
    <ul><li>other@aol.com</li></ul>
  </div>
</div>
</body></html>`;

Deno.test("parseZabaDetail does not bail on div.person", () => {
  const detail = parseZabaDetail(TWO_PEOPLE, { ordinal: 0, full_name: "Lucas Clark", age: 34 });
  if (!detail.fullName) {
    throw new Error("bailed on a search-result page — this is the zaba full-profile bug");
  }
});

Deno.test("parseZabaDetail re-matches on name+age, not blindly on ordinal", () => {
  // Hint says person 0, but we pass the WRONG ordinal to prove name+age wins.
  const detail = parseZabaDetail(TWO_PEOPLE, {
    ordinal: 1,
    full_name: "Lucas Clark",
    age: 34,
    address: "7935 Holmes RD, Kansas City, Missouri 64131",
  });
  if (detail.age !== 34) {
    throw new Error(`expected age 34, got ${detail.age}`);
  }
  const addr = detail.primaryAddress?.formatted || "";
  if (!/Holmes/i.test(addr)) {
    throw new Error(`expected Holmes address, got ${addr}`);
  }
  if (!detail.emails?.includes("lucas@civicplus.com")) {
    throw new Error(`expected lucas@civicplus.com, got ${detail.emails?.join(",")}`);
  }
});

Deno.test("parseZabaDetail falls back to ordinal when names collide without age", () => {
  const detail = parseZabaDetail(TWO_PEOPLE, { ordinal: 1, full_name: "Lucas Clark" });
  if (detail.age !== 30) {
    throw new Error(`ordinal 1 should be age 30, got ${detail.age}`);
  }
});
