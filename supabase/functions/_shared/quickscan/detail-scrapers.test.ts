/**
 * Zaba detail targeting — the search page IS the profile page.
 * Run: deno test supabase/functions/_shared/quickscan/detail-scrapers.test.ts
 */
import { detailToSummary, parseAnywhoDetail, parseFpsDetail, parseNpdDetail, parseZabaDetail } from "./detail-scrapers.ts";
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

// QUARANTINED -- these three are a spec for a feature that was never built.
// They call parseZabaDetail(html, hint) with a targeting hint, but the
// function takes only (html): `deno check` reports TS2554 "Expected 1
// arguments, but got 2" for each. They ran at all only because the suite
// passes --no-check.
//
// What they describe: Zaba's search-results page IS the profile page, so the
// parser should pick the right div.person card by name+age (falling back to
// ordinal) instead of bailing. Today detail-scrapers.ts bails on div.person
// and the caller falls back to Phase 1 summary data -- graceful, but Zaba
// never contributes full-profile detail.
//
// Un-ignore these as the first step of building that. Ignored rather than
// deleted so they stay in every run's output.
Deno.test.ignore("parseZabaDetail does not bail on div.person", () => {
  const detail = parseZabaDetail(TWO_PEOPLE, { ordinal: 0, full_name: "Lucas Clark", age: 34 });
  if (!detail.fullName) {
    throw new Error("bailed on a search-result page — this is the zaba full-profile bug");
  }
});

Deno.test.ignore("parseZabaDetail re-matches on name+age, not blindly on ordinal", () => {
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

Deno.test.ignore("parseZabaDetail falls back to ordinal when names collide without age", () => {
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

// AnyWho's #addresses <h4> heading is sometimes the WHOLE address run
// together with no comma at all ("413 Lovers Ln Cameron MO 64429") rather
// than just the street. containerText (heading.parentElement's textContent)
// necessarily re-includes the heading's own text, and a second,
// differently-formatted copy of the same address elsewhere in the card was
// being read as if it were separate city/state/zip -- addrFromParts then
// joined both, doubling the address. Confirmed against a real corrupted
// `quickscan.addresses.raw_value` — see docs/anywho-address-duplication.md.
Deno.test("parseAnywhoDetail does not double an address when the heading is the whole thing", () => {
  const html = `<html><body>
    <h1>James Oehring, 61</h1>
    <div id="addresses">
      <div>
        <h4>413 Lovers Ln Cameron MO 64429</h4>
        <p>Lovers Ln Cameron, MO, 64429</p>
        <p>James lived here in this Single Family Residential from 2020 to 2026</p>
      </div>
    </div>
  </body></html>`;
  const detail = parseAnywhoDetail(html);
  const addr = detail.primaryAddress;
  if (!addr) throw new Error("expected a primary address");
  if (addr.formatted !== "413 Lovers Ln, Cameron, MO, 64429") {
    throw new Error(`address still duplicated/garbled: ${addr.formatted}`);
  }
  if (addr.street !== "413 Lovers Ln" || addr.city !== "Cameron" || addr.state !== "MO" || addr.zip !== "64429") {
    throw new Error(`components wrong: ${JSON.stringify(addr)}`);
  }
  if (addr.propertyType !== "Single Family Residential") {
    throw new Error(`property type sentence should still parse: ${addr.propertyType}`);
  }
});

// FPS's current-address link text and previous-addresses link text are both
// the whole address, space-joined with no comma before the city at all
// ("7935 Holmes Rd Kansas City MO 64131", plus an optional ", Unit N"
// before it on previous addresses). Confirmed against real FPS HTML: the
// old regexes here duplicated the current address the same way AnyWho's
// heading bug did, and mis-parsed 12 of 13 previous addresses on one real
// profile (street landing as just the house number, with the street name +
// unit + city all dumped into "city"). See
// docs/anywho-address-duplication.md.
Deno.test("parseFpsDetail separates street/city with no comma, current and previous", () => {
  const html = `<html><body>
    <h1 id="details-header">Lucas Clark</h1>
    <div id="current_address_section"><h3><a>7935 Holmes Rd Kansas City MO 64131</a></h3></div>
    <div id="previous-addresses">
      <dl>
        <dt class="address-link"><a>400 W 20th St, Unit 2117 Kansas City MO 64108</a></dt>
        <dd>Recorded June 2022</dd>
        <dd>Jackson County</dd>
      </dl>
      <dl>
        <dt class="address-link"><a>3301 Treehouse LN Plano TX 75023</a></dt>
        <dd>Recorded December 2018</dd>
      </dl>
    </div>
  </body></html>`;
  const detail = parseFpsDetail(html);

  const primary = detail.primaryAddress;
  if (!primary) throw new Error("expected a primary address");
  if (primary.formatted !== "7935 Holmes Rd, Kansas City, MO, 64131") {
    throw new Error(`current address still duplicated/garbled: ${primary.formatted}`);
  }

  const [withUnit, noUnit] = detail.previousAddresses ?? [];
  if (!withUnit || withUnit.street !== "400 W 20th St Unit 2117" || withUnit.city !== "Kansas City") {
    throw new Error(`unit+city on one comma chunk not separated: ${JSON.stringify(withUnit)}`);
  }
  if (withUnit.county !== "Jackson County" || withUnit.recordedDate !== "June 2022") {
    throw new Error(`county/recordedDate should still parse: ${JSON.stringify(withUnit)}`);
  }
  if (!noUnit || noUnit.street !== "3301 Treehouse Ln" || noUnit.city !== "Plano") {
    throw new Error(`street/city not separated with no comma at all: ${JSON.stringify(noUnit)}`);
  }
});

// parseNpdDetail was "a first draft ... unverified against real HTML" (see
// its own prior comment). Checked against a real nationalpublicdata.com
// profile page and every field was broken except email: the <h1> is
// "James Oehring, 62." (name + age + trailing period all in one string,
// unlike every other broker's clean name-only heading) and was used
// verbatim as fullName; and #addresses/#phones/#relatives don't exist on
// the real page at all -- NPD's actual section ids
// (person-current-address, person-previous-address, person-current-phone,
// person-phone-numbers, person-relatives) live on the section's own <h2>,
// with the real content in a sibling ".name-cards-block__text" inside the
// same ".name-cards-grid-item" wrapper.
Deno.test("parseNpdDetail reads NPD's real section structure, not the guessed one", () => {
  const html = `<html><body>
    <div class="name-cards-grid-item">
      <h2 id="person-current-address" class="name-cards-block__header">Current Address</h2>
      <div class="name-cards-block__text">
        <div class="flex-line"><span>413 Lovers Ln, Cameron, MO, 64429</span></div>
      </div>
    </div>
    <div class="name-cards-grid-item">
      <h2 id="person-current-phone" class="name-cards-block__header">Current Phone Numbers</h2>
      <div class="name-cards-block__text">
        <div><span><a href="tel:+18166322218">(816) 632-2218</a></span><span>(Landline)</span></div>
      </div>
    </div>
    <div>
      <h2 id="person-previous-address">Address History</h2>
      <div class="name-cards-block__text">
        <div class="flex-line"><span>500 3rd St, Kansas City, MO, 64106</span><span>Last reported in 2015</span></div>
      </div>
    </div>
    <div>
      <h2 id="person-relatives">Relative</h2>
      <div class="name-cards-block__text">
        <div class="flex-list"><a href="https://nationalpublicdata.com/people/o/rickilinda-oehring/">Rickilinda Oehring</a></div>
      </div>
    </div>
    <div class="like-h1"><h1>James Oehring, 62.</h1></div>
    <p>rickioehring@yahoo.com</p>
  </body></html>`;
  const detail = parseNpdDetail(html);

  if (detail.fullName !== "James Oehring") throw new Error(`age/period leaked into name: ${detail.fullName}`);
  if (detail.age !== 62) throw new Error(`age not parsed from h1: ${detail.age}`);
  if (detail.primaryAddress?.formatted !== "413 Lovers Ln, Cameron, MO, 64429") {
    throw new Error(`current address: ${JSON.stringify(detail.primaryAddress)}`);
  }
  if (detail.phoneNumbers?.[0] !== "(816) 632-2218") {
    throw new Error(`current phone not found: ${JSON.stringify(detail.phoneNumbers)}`);
  }
  const prev = detail.previousAddresses?.[0];
  if (!prev || prev.formatted !== "500 3rd St, Kansas City, MO, 64106" || prev.recordedDate !== "2015") {
    throw new Error(`previous address: ${JSON.stringify(prev)}`);
  }
  if (detail.relatives?.[0]?.name !== "Rickilinda Oehring") {
    throw new Error(`relative not found: ${JSON.stringify(detail.relatives)}`);
  }
});
