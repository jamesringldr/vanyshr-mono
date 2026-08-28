/**
 * Phone-lookup parser tests.
 * Run: deno test supabase/functions/_shared/quickscan/phone-lookup-parser.test.ts
 *
 * Fixtures are reduced from a live reversephonelookup.com page
 * (James Allen Oehring / 8162258592, 2026-08-27) and the existing
 * zabasearch phone-page sample in workers/tests/conftest.py.
 */
import {
  buildRplUrl,
  buildZabaPhoneUrl,
  parsePhoneLookupHtml,
} from "./phone-lookup-parser.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function includes(actual: string[], expected: string, label: string) {
  if (!actual.includes(expected)) {
    throw new Error(`${label}: expected ${JSON.stringify(actual)} to include ${JSON.stringify(expected)}`);
  }
}

const RPL_HTML = `<!doctype html>
<html>
<head>
<title>Background checks available for James Allen Oehring in 413 Lovers Ln, Cameron, Mo 64429-1123</title>
<script type="application/ld+json">
{"@type":"Person","name":"James Allen Oehring","alternateName":"Ja Oehring","birthDate":1988,"telephone":["(816) 225-8592","(816) 632-2218"],"email":["xxxxxxxxxxxx@yahoo.com","xxxxxxxxx@gmail.com","xxxxx@ntst.com"]}
</script>
<script type="application/ld+json">
{"@type":"FAQPage","mainEntity":[
  {"@type":"Question","name":"How old is James Allen Oehring?","acceptedAnswer":{"@type":"Answer","text":"James Allen Oehring is possibly 37 years old and maybe was born in September 1988."}},
  {"@type":"Question","name":"Where does James Allen Oehring live?","acceptedAnswer":{"@type":"Answer","text":"James Allen Oehring has been associated with 14 addresses, the last known one is 413 Lovers Ln, Cameron, Mo 64429-1123."}},
  {"@type":"Question","name":"Who is James Allen Oehring related to?","acceptedAnswer":{"@type":"Answer","text":"James Allen Oehring's possible relatives include Donald L Oehring, Rickilinda Oehring."}},
  {"@type":"Question","name":"What does James Allen Oehring do for a living?","acceptedAnswer":{"@type":"Answer","text":"James Allen Oehring could be an Analyst at Netsmart and might have 1 other jobs on file."}},
  {"@type":"Question","name":"Did James Allen Oehring go to school?","acceptedAnswer":{"@type":"Answer","text":"James Allen Oehring could of attended The University Of Kansas where James Allen Oehring received a degree."}}
]}
</script>
</head>
<body>
  <h1>Results Found For: (816) 225-8592</h1>
  <div class="column">
    <p class="color-grey">(816) 225-8592</p>
    <h2>Owner Information</h2>
    <h3>james allen oehring<br> <span>413 Lovers Ln, Cameron, Mo 64429-1123</span></h3>
  </div>
  <h2>Phone Number Information</h2>
  <ul class="column2 nolist">
    <li>Area Code (NPA): <strong>816</strong></li>
    <li>Original Service Type: <strong>mobile</strong></li>
    <li>Carrier Type: <strong>new cingular wireless pcs llc - il (at&amp;t mobility)</strong></li>
    <li>Original Coverage Area: <strong>kansas city</strong></li>
    <li>Switch CLLI Code: <strong>N/A</strong></li>
  </ul>
</body>
</html>`;

const RPL_NO_RESULT_HTML = `<!doctype html>
<html>
<body>
  <h1>Reverse Phone Lookup</h1>
  <p>No results found for this phone number.</p>
</body>
</html>`;

const ZABA_HTML = `<html>
<body>
  <div id="result-top-content">
    <h3>John Doe</h3>
    <table>
      <tr><th>Age</th><td>42</td></tr>
      <tr><th>Birth Year</th><td>1982</td></tr>
      <tr><th>Line Type</th><td>Landline</td></tr>
      <tr><th>Carrier</th><td>AT&T</td></tr>
      <tr><th>Location</th><td>San Francisco, CA</td></tr>
      <tr><th>Time Zone</th><td>Pacific</td></tr>
    </table>
  </div>
  <div id="phone-number-names">
    <ul>
      <li>Johnny Doe</li>
    </ul>
  </div>
  <div id="phone-number-locations">
    <h5>Most Recent Address</h5>
    <ul><li>123 Main St, San Francisco, CA 94102</li></ul>
    <h5>Previous Addresses</h5>
    <ul><li>456 Oak Ave, Oakland, CA 94601</li></ul>
  </div>
  <div id="phone-number-related">
    <ul><li><a href="/person/jane-doe">Jane Doe</a></li></ul>
  </div>
</body>
</html>`;

Deno.test("builds the reversephonelookup URL from 10 digits", () => {
  eq(
    buildRplUrl("8162258592"),
    "https://www.reversephonelookup.com/number/8162258592/",
    "rpl url",
  );
});

Deno.test("builds the zaba phone URL with dashed digits", () => {
  eq(
    buildZabaPhoneUrl("8162258592"),
    "https://www.zabasearch.com/phone/816-225-8592",
    "zaba url",
  );
});

Deno.test("RPL: owner name, address, line type, carrier, coverage", () => {
  const { result, found } = parsePhoneLookupHtml(
    RPL_HTML,
    "8162258592",
    "https://www.reversephonelookup.com/number/8162258592/",
    "rpl",
  );
  eq(found, true, "found");
  eq(result.name, "James Allen Oehring", "name from JSON-LD, not lowercased h3");
  eq(result.most_recent_address, "413 Lovers Ln, Cameron, Mo 64429-1123", "address");
  eq(result.line_type, "mobile", "line type");
  eq(result.carrier, "At&T Mobility", "carrier from parenthetical");
  eq(result.location, "Kansas City", "coverage area");
});

Deno.test("RPL: JSON-LD age, alias, other phone, email domains, relatives, job, school", () => {
  const { result } = parsePhoneLookupHtml(
    RPL_HTML,
    "8162258592",
    "https://www.reversephonelookup.com/number/8162258592/",
    "rpl",
  );
  eq(result.age, "37", "age");
  eq(result.birth_year, "1988", "birth year");
  includes(result.aliases, "Ja Oehring", "alias");
  includes(result.previous_phones, "(816) 632-2218", "other phone");
  if (result.previous_phones.includes("(816) 225-8592")) {
    throw new Error("lookup number should not be listed as a previous phone");
  }
  includes(result.email_domains, "@yahoo.com", "yahoo domain");
  includes(result.email_domains, "@gmail.com", "gmail domain");
  includes(result.email_domains, "@ntst.com", "ntst domain");
  eq(result.related_persons.map((r) => r.name).join("|"), "Donald L Oehring|Rickilinda Oehring", "relatives");
  includes(result.jobs, "Analyst at Netsmart", "job");
  includes(result.education, "The University Of Kansas", "school");
});

Deno.test("RPL: no-result page is not found", () => {
  const { result, found } = parsePhoneLookupHtml(
    RPL_NO_RESULT_HTML,
    "8162258592",
    "https://www.reversephonelookup.com/number/8162258592/",
    "rpl",
  );
  eq(found, false, "found");
  eq(result.name, null, "name");
});

Deno.test("Zaba Intelius template still parses", () => {
  const { result, found } = parsePhoneLookupHtml(
    ZABA_HTML,
    "4155550123",
    "https://www.zabasearch.com/phone/415-555-0123",
    "zaba",
  );
  eq(found, true, "found");
  eq(result.name, "John Doe", "name");
  eq(result.age, "42", "age");
  eq(result.carrier, "AT&T", "carrier");
  eq(result.most_recent_address, "123 Main St, San Francisco, CA 94102", "address");
  includes(result.previous_addresses, "456 Oak Ave, Oakland, CA 94601", "previous");
  eq(result.related_persons[0]?.name, "Jane Doe", "related");
});
