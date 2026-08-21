/**
 * Address parser tests.
 * Run: deno test supabase/functions/_shared/quickscan/address-parser.test.ts
 *
 * The four REAL_WORLD cases are the exact strings the four brokers returned
 * for one person on 2026-08-20. They are the reason this parser exists: the
 * old split(",") turned them into four mutually-incompatible city/state pairs
 * and the same person came back as two separate cards.
 */
import { compareParsedAddresses, parseAddress } from "./address-parser.ts";

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("zaba: no comma before city, full state name, zip", () => {
  const a = parseAddress("413 Lovers LN Cameron, Missouri 64429");
  eq(a.street, "413 lovers ln", "street");
  eq(a.city, "cameron", "city");
  eq(a.state, "MO", "state");
  eq(a.zip, "64429", "zip");
});

Deno.test("fps: comma after street, bare state code, zip", () => {
  const a = parseAddress("413 Lovers Ln, Cameron MO 64429");
  eq(a.street, "413 lovers ln", "street");
  eq(a.city, "cameron", "city");
  eq(a.state, "MO", "state");
  eq(a.zip, "64429", "zip");
});

Deno.test("npd: fully comma-separated, no zip", () => {
  const a = parseAddress("413 Lovers Ln, Cameron, MO");
  eq(a.street, "413 lovers ln", "street");
  eq(a.city, "cameron", "city");
  eq(a.state, "MO", "state");
  eq(a.zip, "", "zip");
});

Deno.test("anywho: unit designator must not become the city", () => {
  const a = parseAddress("1225 Union Ave, Apt 502, Kansas City, MO");
  eq(a.city, "kansas city", "city");
  eq(a.state, "MO", "state");
  if (!a.street.includes("union ave")) throw new Error(`street lost: ${a.street}`);
  if (a.city.startsWith("apt")) throw new Error("unit leaked into city");
});

Deno.test("THE BUG: all three Cameron records now agree", () => {
  const zaba = parseAddress("413 Lovers LN Cameron, Missouri 64429");
  const fps = parseAddress("413 Lovers Ln, Cameron MO 64429");
  const npd = parseAddress("413 Lovers Ln, Cameron, MO");

  eq(compareParsedAddresses(zaba, fps), 1.0, "zaba vs fps");
  eq(compareParsedAddresses(zaba, npd), 1.0, "zaba vs npd");
  eq(compareParsedAddresses(fps, npd), 1.0, "fps vs npd");
});

Deno.test("LN and Lane are the same street", () => {
  const short = parseAddress("413 Lovers Ln, Cameron, MO");
  const long = parseAddress("413 Lovers Lane, Cameron, MO");
  eq(short.street, long.street, "suffix normalisation");
  eq(compareParsedAddresses(short, long), 1.0, "score");
});

Deno.test("different city in the same state scores low, not zero", () => {
  const cameron = parseAddress("413 Lovers Ln, Cameron, MO");
  const kc = parseAddress("1225 Union Ave, Apt 502, Kansas City, MO");
  const score = compareParsedAddresses(cameron, kc);
  if (score !== 0.4) throw new Error(`expected 0.4 (state only), got ${score}`);
});

Deno.test("two-word state names", () => {
  eq(parseAddress("1 Main St, Albany, New York 12207").state, "NY", "NY");
  eq(parseAddress("5 Elm Rd, Newark, New Jersey").state, "NJ", "NJ");
});

Deno.test("junk in, empty out — never a confidently wrong value", () => {
  const empty = parseAddress("");
  eq(empty.city, "", "empty city");
  eq(empty.state, "", "empty state");
  eq(parseAddress(null).state, "", "null");
  eq(parseAddress(undefined).city, "", "undefined");
});

Deno.test("unknown components contribute nothing rather than penalising", () => {
  const full = parseAddress("413 Lovers Ln, Cameron, MO 64429");
  const bare = parseAddress("Cameron, MO");
  eq(compareParsedAddresses(full, bare), 0.85, "city+state only");
});
