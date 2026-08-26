/**
 * Zaba detail targeting — the search page IS the profile page.
 * Run: deno test supabase/functions/_shared/quickscan/detail-scrapers.test.ts
 */
import { detailToSummary, parseZabaDetail } from "./detail-scrapers.ts";
import { BrokerName, type SummaryResult } from "./quickscan-phase1-phase2-models.ts";

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

Deno.test("detailToSummary copies phones so matchReference can score them", () => {
  const fallback = {
    broker: BrokerName.FPS,
    full_name: "James Oehring",
    address: "Cameron, MO",
    age_range: "61",
    age: 61,
    location: "Cameron, MO",
    profile_url: "https://example.test/fps/james",
  } as SummaryResult;
  const summary = detailToSummary(
    BrokerName.FPS,
    "pick-1",
    {
      fullName: "James Oehring",
      age: 61,
      primaryAddress: { formatted: "413 Lovers Ln, Cameron MO 64429" },
      phoneNumbers: ["(816) 632-2218", "(816) 225-8592"],
      emails: ["jaoehring@gmail.com"],
      relatives: [{ name: "Rickilinda Oehring" }],
      previousAddresses: [{ formatted: "380 W 22nd St, Kansas City, MO" }],
    },
    fallback,
  );
  if (summary.phone !== "(816) 632-2218, (816) 225-8592") {
    throw new Error(`expected phones, got ${summary.phone}`);
  }
  if (summary.address !== "413 Lovers Ln, Cameron MO 64429") {
    throw new Error(`expected street address, got ${summary.address}`);
  }
  if (summary.relatives !== "Rickilinda Oehring") {
    throw new Error(`expected relative, got ${summary.relatives}`);
  }
  if (summary.result_id !== "pick-1") throw new Error("result_id should be the pick id");
});
