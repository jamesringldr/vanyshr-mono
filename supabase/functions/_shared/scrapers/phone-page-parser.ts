/**
 * Phone-number-keyed lookup pages: URL builders + a per-broker summary
 * extractor for the accuracy study (testing.phone_results).
 *
 * Each broker's actual page shape was confirmed with a live context.dev
 * fetch against 8162258592 before writing its extractor (see
 * /private/tmp .../scratchpad/probe-phone-brokers.ts -- not checked in, just
 * how this was validated). They are NOT uniform:
 *
 *   - reversephonelookup: schema.org Person JSON-LD. `email` is genuinely
 *     server-side redacted (literal "xxxx@domain" strings, confirmed no
 *     unmasked value anywhere else on the page) -- not extracted, it's noise.
 *   - fps (fastpeoplesearch): schema.org Person JSON-LD, same shape as the
 *     quickscan name-search JSON-LD fallback.
 *   - anywho: NO JSON-LD on this page at all. The "POTENTIAL OWNERS" name is
 *     masked with a pure CSS trick, same idea as Zaba's blurred emails: the
 *     real characters sit in a `data-content="..."` attribute rendered via
 *     `before:content-[attr(data-content)]` and blurred with a CSS class --
 *     fully recoverable from the raw HTML. LOCATIONS / PHONE TYPE / PHONE
 *     CARRIER on the same page are plain, unmasked text. Relatives/address
 *     history/emails are gated behind a "See available results" link with
 *     no data on this page -- left null rather than guessed at.
 *   - usphonebook: NO JSON-LD Person either -- schema.org *Microdata*
 *     (itemprop="givenName"/"familyName"/"relatedTo") instead, plain text,
 *     no masking at all. Full address is gated behind a "Full address
 *     available" link -- left null.
 */
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { deblurAnywhoHtml } from "../quickscan/detail-scrapers.ts";

export type PhoneLookupTarget = "reversephonelookup" | "usphonebook" | "anywho" | "fps";

export const PHONE_LOOKUP_TARGETS: PhoneLookupTarget[] = [
  "reversephonelookup",
  "usphonebook",
  "anywho",
  "fps",
];

export type PhoneSummary = {
  full_name: string | null;
  address: string | null;
  age: number | null;
  profile_url: string | null;
  phone: string | null;
  email: string | null;
  aliases: string | null;
  relatives: string | null;
  previous_addresses: string | null;
  line_type: string | null;
  carrier: string | null;
};

function emptySummary(profile_url: string): PhoneSummary {
  return {
    full_name: null, address: null, age: null, profile_url,
    phone: null, email: null, aliases: null, relatives: null,
    previous_addresses: null, line_type: null, carrier: null,
  };
}

function splitPhone(phone10: string): [string, string, string] {
  const d = phone10.replace(/\D/g, "");
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)];
}

export function buildPhoneLookupUrl(target: PhoneLookupTarget, phone10: string): string {
  const [area, mid, last] = splitPhone(phone10);
  switch (target) {
    case "reversephonelookup":
      return `https://www.reversephonelookup.com/number/${area}${mid}${last}/`;
    case "usphonebook":
      return `https://www.usphonebook.com/phone-search/${area}-${mid}-${last}`;
    case "anywho":
      return `https://www.anywho.com/phone/${area}${mid}${last}`;
    case "fps":
      return `https://www.fastpeoplesearch.com/${area}-${mid}-${last}`;
  }
}

type El = {
  textContent: string | null;
  className?: string;
  querySelector: (sel: string) => El | null;
  querySelectorAll: (sel: string) => El[];
  nextElementSibling?: El | null;
};

function parseDoc(html: string): El | null {
  return new DOMParser().parseFromString(html, "text/html") as unknown as El | null;
}

function textOf(el: El | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function isObj(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object";
}

function joinList(value: unknown): string | null {
  if (!value) return null;
  const arr = Array.isArray(value) ? value : [value];
  const strs = arr.map((v) => (isObj(v) ? String(v.name ?? "") : String(v))).filter(Boolean);
  return strs.length ? strs.join(", ") : null;
}

function ageFromBirthDate(birthDate: unknown): number | null {
  const s = String(birthDate ?? "");
  const yearMatch = s.match(/\b(1[89]\d{2}|20[0-2]\d)\b/);
  if (!yearMatch) return null;
  const year = parseInt(yearMatch[1], 10);
  const age = new Date().getUTCFullYear() - year;
  return age > 0 && age < 130 ? age : null;
}

// ---------------------------------------------------------------------------
// reversephonelookup / fps -- schema.org Person JSON-LD
// ---------------------------------------------------------------------------

function jsonLdPersons(html: string): Record<string, unknown>[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const out: Record<string, unknown>[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      const blocks = Array.isArray(data) ? data : [data];
      for (const b of blocks) {
        if (!isObj(b)) continue;
        const t = b["@type"];
        if (t === "Person" || (Array.isArray(t) && t.includes("Person"))) out.push(b);
      }
    } catch {
      /* ignore unparseable block */
    }
  }
  return out;
}

function postalLine(addr: Record<string, unknown> | undefined): string {
  if (!addr) return "";
  return [addr.streetAddress, addr.addressLocality, addr.addressRegion]
    .map((p) => String(p ?? "").trim())
    .filter(Boolean)
    .join(", ");
}

/** Normalizes homeLocation's two observed shapes into a flat PostalAddress list. */
function extractPostalAddresses(person: Record<string, unknown>): Record<string, unknown>[] {
  const home = person.homeLocation;
  const candidates: unknown[] = Array.isArray(home) ? home : home ? [home] : [];
  const out: Record<string, unknown>[] = [];
  for (const c of candidates) {
    if (!isObj(c)) continue;
    const addr = c.address;
    if (Array.isArray(addr)) out.push(...addr.filter(isObj));
    else if (isObj(addr)) out.push(addr);
    else if (c.streetAddress || c.addressLocality) out.push(c);
  }
  return out;
}

function parseJsonLdSummary(html: string, sourceUrl: string, includeEmail: boolean): PhoneSummary | null {
  const persons = jsonLdPersons(html);
  if (persons.length === 0) return null;
  const person = persons[0];

  const addresses = extractPostalAddresses(person);
  const address = addresses[0] ? postalLine(addresses[0]) : null;
  const previous = addresses.slice(1).map(postalLine).filter(Boolean);

  return {
    ...emptySummary(sourceUrl),
    full_name: (person.name as string) || null,
    address,
    age: ageFromBirthDate(person.birthDate),
    phone: joinList(person.telephone),
    email: includeEmail ? joinList(person.email) : null,
    aliases: joinList(person.alternateName),
    relatives: joinList(person.relatedTo),
    previous_addresses: previous.length ? previous.join("; ") : null,
  };
}

// ---------------------------------------------------------------------------
// anywho -- no JSON-LD; labeled fields, name masked with a CSS blur trick
// ---------------------------------------------------------------------------

/** Finds a "LABEL:" div and reads its sibling value div. */
function anywhoField(doc: El, label: string): El | null {
  for (const div of Array.from(doc.querySelectorAll("div"))) {
    if (textOf(div) === `${label}:`) return div.nextElementSibling ?? null;
  }
  return null;
}

function parseAnywhoSummary(rawHtml: string, sourceUrl: string): PhoneSummary | null {
  // deblurAnywhoHtml() substitutes each blurred data-content span with its
  // real text before parsing -- see detail-scrapers.ts, already the pattern
  // used for AnyWho's full-profile pages. Plain textOf() reads correctly
  // afterward; no per-element reconstruction needed.
  const doc = parseDoc(deblurAnywhoHtml(rawHtml));
  if (!doc) return null;

  const ownersValue = anywhoField(doc, "POTENTIAL OWNERS");
  let fullName: string | null = null;
  if (ownersValue) {
    const firstCandidate = Array.from(ownersValue.querySelectorAll("span")).find(
      (s) => s.className !== "text-gray-500",
    );
    const text = textOf(firstCandidate).trim();
    if (text) fullName = text;
  }
  if (!fullName) return null; // no owners section at all -> not this page shape

  const locationsValue = anywhoField(doc, "LOCATIONS");
  const locations = locationsValue
    ? textOf(locationsValue)
        .split("•")
        .map((s) => s.replace(/\+\d+\s*more$/i, "").trim()) // "+1 more" link isn't bullet-separated from the text before it
        .filter(Boolean)
    : [];

  return {
    ...emptySummary(sourceUrl),
    full_name: fullName,
    address: locations[0] ?? null,
    previous_addresses: locations.slice(1).join("; ") || null,
    line_type: textOf(anywhoField(doc, "PHONE TYPE")) || null,
    carrier: textOf(anywhoField(doc, "PHONE CARRIER")) || null,
  };
}

// ---------------------------------------------------------------------------
// usphonebook -- no JSON-LD; schema.org Microdata, unmasked
// ---------------------------------------------------------------------------

function parseUsPhonebookSummary(html: string, sourceUrl: string): PhoneSummary | null {
  const doc = parseDoc(html);
  if (!doc) return null;

  const nameEl = doc.querySelector('[itemprop="name"]');
  if (!nameEl) return null;
  const given = textOf(nameEl.querySelector('[itemprop="givenName"]'));
  const family = textOf(nameEl.querySelector('[itemprop="familyName"]'));
  const fullName = [given, family].filter(Boolean).join(" ") || textOf(nameEl);
  if (!fullName) return null;

  const relatives = Array.from(doc.querySelectorAll('[itemprop="relatedTo"] [itemprop="name"]'))
    .map(textOf)
    .filter(Boolean);

  return {
    ...emptySummary(sourceUrl),
    full_name: fullName,
    relatives: relatives.length ? joinList(relatives) : null,
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function parsePhoneSummary(
  target: PhoneLookupTarget,
  html: string,
  sourceUrl: string,
): PhoneSummary | null {
  switch (target) {
    case "reversephonelookup":
      return parseJsonLdSummary(html, sourceUrl, /* includeEmail */ false);
    case "fps":
      return parseJsonLdSummary(html, sourceUrl, /* includeEmail */ true);
    case "anywho":
      return parseAnywhoSummary(html, sourceUrl);
    case "usphonebook":
      return parseUsPhonebookSummary(html, sourceUrl);
  }
}
