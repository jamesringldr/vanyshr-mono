/**
 * Address parser — turns a broker's free-form address line into components.
 *
 * Every broker formats differently, and the codebase previously did
 * `address.split(",")` and called part[0] the city and part[1] the state.
 * On real data that produces garbage:
 *
 *   zaba    "413 Lovers LN Cameron, Missouri 64429"    -> city "413 Lovers LN Cameron"
 *   fps     "413 Lovers Ln, Cameron MO 64429"          -> state "Cameron MO 64429"
 *   npd     "413 Lovers Ln, Cameron, MO"               -> city "413 Lovers Ln"
 *   anywho  "1225 Union Ave, Apt 502, Kansas City, MO" -> state "Apt 502"
 *
 * Two records at the SAME street address then score as a city mismatch, so
 * DedupEngine cannot merge them and the client-side cross-tier merge (which
 * matches on state) fails too. That is the whole "two James Oehring cards"
 * bug.
 *
 * The parser anchors on the reliable end of a US address and works backwards:
 * ZIP, then state, then city, leaving the street. Nothing here is
 * broker-specific — it is all shape-based, so a new broker's format does not
 * need new code unless it breaks those anchors.
 */

/** Full state names -> USPS code. Territories included; brokers do use them. */
const STATE_NAMES: Record<string, string> = {
  alabama: "AL", alaska: "AK", arizona: "AZ", arkansas: "AR", california: "CA",
  colorado: "CO", connecticut: "CT", delaware: "DE", florida: "FL", georgia: "GA",
  hawaii: "HI", idaho: "ID", illinois: "IL", indiana: "IN", iowa: "IA",
  kansas: "KS", kentucky: "KY", louisiana: "LA", maine: "ME", maryland: "MD",
  massachusetts: "MA", michigan: "MI", minnesota: "MN", mississippi: "MS",
  missouri: "MO", montana: "MT", nebraska: "NE", nevada: "NV",
  "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM", "new york": "NY",
  "north carolina": "NC", "north dakota": "ND", ohio: "OH", oklahoma: "OK",
  oregon: "OR", pennsylvania: "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", tennessee: "TN", texas: "TX", utah: "UT", vermont: "VT",
  virginia: "VA", washington: "WA", "west virginia": "WV", wisconsin: "WI",
  wyoming: "WY", "district of columbia": "DC", "puerto rico": "PR",
};

const STATE_CODES = new Set(Object.values(STATE_NAMES));

/**
 * Street-type suffixes -> canonical short form.
 *
 * This is what makes "413 Lovers LN" and "413 Lovers Lane" comparable. Keys
 * include both the long and short spellings so normalisation is idempotent.
 */
const STREET_SUFFIXES: Record<string, string> = {
  street: "st", st: "st",
  avenue: "ave", ave: "ave", av: "ave",
  road: "rd", rd: "rd",
  lane: "ln", ln: "ln",
  drive: "dr", dr: "dr",
  court: "ct", ct: "ct",
  circle: "cir", cir: "cir",
  boulevard: "blvd", blvd: "blvd",
  place: "pl", pl: "pl",
  terrace: "ter", ter: "ter",
  parkway: "pkwy", pkwy: "pkwy",
  highway: "hwy", hwy: "hwy",
  way: "way", trail: "trl", trl: "trl",
  square: "sq", sq: "sq",
  loop: "loop", run: "run", pass: "pass", path: "path",
};

/** Unit designators — kept with the street, never mistaken for a city. */
const UNIT_TOKENS = new Set([
  "apt", "apartment", "unit", "ste", "suite", "#", "bldg", "building",
  "fl", "floor", "rm", "room", "trlr", "lot",
]);

export interface ParsedAddress {
  /** The input, trimmed. */
  raw: string;
  /** Street line incl. any unit, lowercased, suffix-normalised. */
  street: string;
  /** City, lowercased. */
  city: string;
  /** Two-letter USPS code, uppercased. Empty when not resolvable. */
  state: string;
  /** Five-digit ZIP. Empty when absent. */
  zip: string;
}

const EMPTY: ParsedAddress = { raw: "", street: "", city: "", state: "", zip: "" };

function tidy(value: string): string {
  return value.toLowerCase().replace(/[.]/g, " ").replace(/\s+/g, " ").trim();
}

/** Normalise the trailing street-type token so LN and Lane compare equal. */
function normaliseStreet(street: string): string {
  const tokens = tidy(street).split(" ").filter(Boolean);
  return tokens
    .map((t, i) => {
      // Only the suffix position is ambiguous; a leading "St" is "Saint".
      if (i === 0) return t;
      return STREET_SUFFIXES[t] ?? t;
    })
    .join(" ");
}

/**
 * Parse a US address line into components.
 *
 * Returns empty strings rather than throwing or guessing wildly — an unparsed
 * field is a signal the caller can score as "unknown", which is safer than a
 * confidently wrong value.
 */
export function parseAddress(raw: string | null | undefined): ParsedAddress {
  if (!raw || typeof raw !== "string") return { ...EMPTY };

  const original = raw.trim();
  let working = tidy(original);
  if (!working) return { ...EMPTY, raw: original };

  // 1. ZIP is the most reliable anchor: 5 digits (optionally +4) at the end.
  let zip = "";
  const zipMatch = working.match(/\b(\d{5})(?:-\d{4})?\s*$/);
  if (zipMatch) {
    zip = zipMatch[1];
    working = working.slice(0, zipMatch.index).trim();
  }

  // 2. State sits immediately before the ZIP. Try a two-word name first
  //    ("new york"), then one word ("missouri"), then a bare code ("mo").
  let state = "";
  const stripTrailingComma = (s: string) => s.replace(/[,\s]+$/, "").trim();
  const tokens = working.split(/[\s,]+/).filter(Boolean);

  if (tokens.length) {
    const lastTwo = tokens.slice(-2).join(" ");
    const lastOne = tokens[tokens.length - 1];

    if (STATE_NAMES[lastTwo]) {
      state = STATE_NAMES[lastTwo];
      working = stripTrailingComma(working.slice(0, working.lastIndexOf(tokens[tokens.length - 2])));
    } else if (STATE_NAMES[lastOne]) {
      state = STATE_NAMES[lastOne];
      working = stripTrailingComma(working.slice(0, working.lastIndexOf(lastOne)));
    } else if (STATE_CODES.has(lastOne.toUpperCase())) {
      state = lastOne.toUpperCase();
      working = stripTrailingComma(working.slice(0, working.lastIndexOf(lastOne)));
    }
  }

  // 3. City. If commas survive, the last chunk is the city and the rest is the
  //    street. Otherwise fall back to the street-suffix boundary: everything
  //    after the last suffix token is the city ("413 lovers ln cameron").
  let city = "";
  let street = "";

  const chunks = working.split(",").map((c) => c.trim()).filter(Boolean);

  if (chunks.length >= 2) {
    city = chunks[chunks.length - 1];
    street = chunks.slice(0, -1).join(" ");
  } else if (chunks.length === 1) {
    const parts = chunks[0].split(" ").filter(Boolean);
    let suffixAt = -1;
    for (let i = parts.length - 1; i >= 0; i--) {
      if (STREET_SUFFIXES[parts[i]] && !UNIT_TOKENS.has(parts[i])) {
        suffixAt = i;
        break;
      }
    }
    if (suffixAt >= 0 && suffixAt < parts.length - 1) {
      street = parts.slice(0, suffixAt + 1).join(" ");
      city = parts.slice(suffixAt + 1).join(" ");
    } else {
      // No usable boundary. If it starts with a house number treat the whole
      // thing as a street; otherwise it is most likely a bare city.
      if (/^\d/.test(chunks[0])) street = chunks[0];
      else city = chunks[0];
    }
  }

  // A unit designator landing at the front of the city slot happens in two
  // different shapes depending on the broker: alone ("apt 502", nothing
  // else -- the real city was a separate, earlier comma chunk, e.g. FPS's
  // own "1225 Union Ave, Apt 502, Kansas City, MO"), or with the real city
  // glued onto the SAME chunk right after it ("unit 2117 kansas city" --
  // FPS's previous-addresses links put only one comma in, before the unit,
  // e.g. "400 W 20th St, Unit 2117 Kansas City MO 64108"). Peel off just
  // the unit token + whatever immediately follows it (its number/id) and
  // keep looking for a real city in what's left, rather than assuming the
  // whole fragment is street. When there's genuinely nothing after the
  // unit's id, `rest` comes out empty and this reduces to the old
  // move-it-all-to-street behavior.
  const cityWords = city.split(" ").filter(Boolean);
  if (cityWords.length && UNIT_TOKENS.has(cityWords[0])) {
    const unitFragment = cityWords.slice(0, 2).join(" ");
    street = `${street} ${unitFragment}`.trim();
    city = cityWords.slice(2).join(" ");
  }

  return {
    raw: original,
    street: normaliseStreet(street),
    city: tidy(city),
    state,
    zip,
  };
}

/**
 * Similarity of two addresses, 0-1, for DedupEngine scoring.
 *
 * Deliberately graded rather than boolean: brokers disagree about how much of
 * an address they publish, and "unknown" must not read as "different". A
 * missing component contributes nothing instead of penalising.
 */
export function compareParsedAddresses(a: ParsedAddress, b: ParsedAddress): number {
  const sameZip = !!a.zip && a.zip === b.zip;
  const sameState = !!a.state && a.state === b.state;
  const sameCity = !!a.city && a.city === b.city;
  const sameStreet = !!a.street && a.street === b.street;

  // Same street plus any corroborating locality: as strong as it gets.
  if (sameStreet && (sameZip || sameCity || sameState)) return 1.0;
  // Same street, nothing else known — still a very strong signal.
  if (sameStreet) return 0.9;
  if (sameCity && sameState) return 0.85;
  if (sameZip) return 0.8;
  if (sameCity) return 0.6;
  if (sameState) return 0.4;
  return 0.0;
}
