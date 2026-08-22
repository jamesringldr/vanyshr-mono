/**
 * Phase 2 detail-page scrapers — visits each broker's profile_url (captured by
 * the Phase 1 summary parsers in html-scrapers.ts) via context.dev and parses
 * the richer detail page: full address history, all phones, relatives, aliases.
 *
 * FPS/AnyWho/Zaba parsers below are ported from the proven detail-page logic in
 * _shared/scrapers/{FastPeopleSearchScraper,AnyWhoScraper,ZabasearchScraper}.ts
 * (previously tuned against real HTML fetched via CF relay / serv01) — reshaped
 * to the flat BrokerDetailProfile consolidateProfiles() expects.
 *
 * NPD has no prior detail-page scraper anywhere in this repo to port from, so
 * parseNpdDetail() below is a first draft using the same structural heuristics
 * as the others (regex/section-header based). Treat it as unverified until
 * checked against real National Public Data profile-page HTML.
 */

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { BrokerName, type DedupMember, type SummaryResult } from "./quickscan-phase1-phase2-models.ts";
import { scrapeHtml } from "./context-dev-client.ts";

const DEFAULT_DETAIL_TIMEOUT_MS = 20000;

type El = {
  textContent: string | null;
  parentElement: El | null;
  getAttribute: (name: string) => string | null;
  querySelector: (sel: string) => El | null;
  querySelectorAll: (sel: string) => El[];
};

function parseDoc(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

function textOf(el: El | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

export interface DetailAddress {
  formatted: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  county?: string;
  recordedDate?: string; // FPS previous addresses ("Recorded July 2020")
  propertyType?: string; // AnyWho per-address ("Single Family Residential")
}

export interface DetailRelation {
  name: string;
  relation?: string;
  age?: number;
  address?: string;
  gender?: string;
  birthMonth?: string; // FPS relatives/associates ("May 1961")
}

/**
 * Phones stay `phoneNumbers: string[]` for backward compatibility with
 * consolidation.ts's upsertTyped() and the phones table (raw_value/
 * normalized_value only, no type/carrier columns). The richer per-number
 * detail some brokers publish (line type, carrier, first-reported date,
 * AnyWho's per-number city/state) is captured in this parallel array instead
 * -- same order as phoneNumbers, not yet written to a dedicated column, but
 * preserved in full_profile_results.raw either way.
 */
export interface DetailPhone {
  number: string;
  type?: string;
  carrier?: string;
  firstReported?: string;
  location?: string;
}

export interface DetailJob {
  employer?: string;
  title?: string;
  since?: string;
  location?: string;
  duration?: string;
}

export interface DetailEducation {
  school?: string;
  details?: string[];
}

export interface DetailLegalRecords {
  countyRecords?: { location: string; count?: number };
  nationwideCount?: number;
}

/** Shape consolidateProfiles() in profile-consolidator.ts expects per broker. */
export interface BrokerDetailProfile {
  fullName?: string;
  age?: number;
  bornDate?: string; // FPS only, month/year from the header ("June 1965")
  aliases?: string[];
  primaryAddress?: DetailAddress;
  previousAddresses?: DetailAddress[];
  phoneNumbers?: string[];
  phoneDetails?: DetailPhone[]; // see DetailPhone doc comment
  emails?: string[];
  relatives?: DetailRelation[];
  associates?: DetailRelation[];
  properties?: Record<string, unknown>[]; // FPS only; empty for brokers with no property section
  employment?: DetailJob[]; // FPS "Current Employment"
  jobHistory?: DetailJob[]; // FPS "Work Experience"
  education?: DetailEducation[];
  legalRecords?: DetailLegalRecords; // AnyWho only
}

function addrFromParts(street: string | undefined, city: string | undefined, state: string | undefined, zip: string | undefined, fallback?: string): DetailAddress {
  const formatted = [street, [city, state].filter(Boolean).join(", "), zip].filter(Boolean).join(", ") || fallback || "";
  return { formatted, street, city, state, zip };
}

/** Fallback when a detail-page fetch fails/times out — degrade to what Phase 1's summary already had. */
export function summaryFallback(summary: SummaryResult): BrokerDetailProfile {
  const [city, state] = (summary.address || "").split(",").map((s) => s.trim());
  return {
    fullName: summary.full_name,
    age: summary.age,
    primaryAddress: summary.address ? addrFromParts(undefined, city, state, undefined, summary.address) : undefined,
    previousAddresses: (summary.previous_addresses || "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((formatted) => ({ formatted })),
    phoneNumbers: summary.phone ? summary.phone.split(",").map((s) => s.trim()).filter(Boolean) : [],
    emails: summary.email ? summary.email.split(",").map((s) => s.trim()).filter(Boolean) : [],
    relatives: (summary.relatives || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((name) => ({ name })),
    associates: [],
  };
}

// ---------------------------------------------------------------------------
// FPS — ported from FastPeopleSearchScraper.parsePersonDetailPage
// ---------------------------------------------------------------------------

// #current_property_data <dl> labels not covered by beds/baths/sqft/built/
// value alone -- see vanyshr-scraper-lab's fps_full_profile_scraper.py for
// the same map. Numeric fields get their currency/commas stripped to ints.
const FPS_PROPERTY_LABELS: Record<string, string> = {
  "Bedrooms": "beds",
  "Bathrooms": "baths",
  "Square Feet": "squareFeet",
  "Year Built": "yearBuilt",
  "Estimated Value": "estimatedValue",
  "Estimated Equity": "estimatedEquity",
  "Last Sale Amount": "lastSaleAmount",
  "Last Sale Date": "lastSaleDate",
  "Occupancy Type": "occupancyType",
  "Ownership Type": "ownershipType",
  "Land Use": "landUse",
  "Property Class": "propertyClass",
  "Subdivision": "subdivision",
  "Lot SqFt.": "lotSqFt",
};
const FPS_PROPERTY_NUMERIC_FIELDS = new Set([
  "squareFeet", "yearBuilt", "estimatedValue", "estimatedEquity", "lastSaleAmount", "lotSqFt",
]);

export function parseFpsDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(html) as unknown as El;
  if (!doc) return {};

  const fullName =
    textOf(doc.querySelector("#full_name_section .fullname")) ||
    textOf(doc.querySelector("h1#details-header"));
  if (!fullName) return {};

  // "Age 61, Born June 1965" is a <p> sibling of h1#details-header -- not a
  // separate #age-header (that id doesn't exist on the real page, so age was
  // silently always undefined here before this fix) and not near
  // #full_name_section .fullname either (a different, unrelated "Full Name:"
  // summary box elsewhere on the page, despite winning the fullName lookup
  // above).
  const headerText = textOf(doc.querySelector("#age-header")) ||
    textOf(doc.querySelector("h1#details-header")?.parentElement);
  const ageMatch = headerText.match(/Age\s+(\d+)/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;
  const bornMatch = headerText.match(/Born\s+([A-Za-z]+\s+\d{4})/i);
  const bornDate = bornMatch ? bornMatch[1] : undefined;

  const phoneNumbers: string[] = [];
  const phoneDetails: DetailPhone[] = [];
  for (const dl of doc.querySelectorAll("#phone_number_section .detail-box-phone dl")) {
    const number = textOf(dl.querySelector("dt a"));
    if (number.replace(/\D/g, "").length < 10) continue;
    phoneNumbers.push(number);

    // Type/carrier/first-reported sit as <dd> siblings of the number this
    // scraper already reads -- previously discarded.
    const detail: DetailPhone = { number };
    for (const dd of dl.querySelectorAll("dd")) {
      const text = textOf(dd);
      if (/^first reported/i.test(text)) {
        detail.firstReported = text.replace(/^first reported\s*/i, "").trim();
      } else if (!detail.type) {
        detail.type = text;
      } else if (!detail.carrier) {
        detail.carrier = text;
      }
    }
    phoneDetails.push(detail);
  }

  const emails: string[] = [];
  for (const h3 of doc.querySelectorAll("#email_section h3")) {
    const email = textOf(h3);
    if (email.includes("@")) emails.push(email);
  }

  let primaryAddress: DetailAddress | undefined;
  const currentLink = doc.querySelector("#current_address_section h3 a");
  if (currentLink) {
    const blockText = textOf(currentLink.parentElement);
    const street = textOf(currentLink);
    const csMatch = blockText.match(/([A-Za-z\s]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)/);
    primaryAddress = addrFromParts(street, csMatch?.[1]?.trim(), csMatch?.[2], csMatch?.[3], blockText);
  }

  const previousAddresses: DetailAddress[] = [];
  for (const link of doc.querySelectorAll("#previous-addresses dt.address-link a")) {
    const text = textOf(link);
    const csMatch = text.match(/^(.+?)\s+([A-Za-z\s.]+?)\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/);
    const addr: DetailAddress = csMatch
      ? addrFromParts(csMatch[1].trim(), csMatch[2].trim(), csMatch[3], csMatch[4], text)
      : { formatted: text };

    // County + "Recorded <date>" are <dd> siblings of the <dt> this link
    // lives in (<a> -> <dt> -> <dl>) -- previously never read.
    const dl = link.parentElement?.parentElement;
    if (dl) {
      for (const dd of dl.querySelectorAll("dd")) {
        const ddText = textOf(dd);
        const recorded = ddText.match(/^Recorded\s+(.+)$/i);
        if (recorded) addr.recordedDate = recorded[1].trim();
        else if (/county$/i.test(ddText)) addr.county = ddText;
      }
    }
    previousAddresses.push(addr);
  }

  // Age + birth month sit as one <dd> per relative/associate ("Age 65 (May
  // 1961)"), matching #relative-links and #associate-links identically.
  const AGE_BIRTH = /Age\s+(\d+)(?:\s*\(([A-Za-z]+\s+\d{4})\))?/i;

  const relatives: DetailRelation[] = [];
  for (const dl of doc.querySelectorAll("#relative-links dl")) {
    const name = textOf(dl.querySelector("dt a"));
    if (!name || name.length < 3) continue;
    const match = textOf(dl.querySelector("dd")).match(AGE_BIRTH);
    relatives.push({
      name, relation: "family",
      age: match ? parseInt(match[1], 10) : undefined,
      birthMonth: match?.[2],
    });
  }

  // Declared in BrokerDetailProfile but previously had zero extraction code
  // -- folded into `relatives`/`associates` the same as the other brokers,
  // consolidation.ts's populateFromBrokerDetail already merges both into one
  // relatives table (kind='relative'/'associate').
  const associates: DetailRelation[] = [];
  for (const dl of doc.querySelectorAll("#associate-links dl")) {
    const name = textOf(dl.querySelector("dt a"));
    if (!name || name.length < 3) continue;
    const match = textOf(dl.querySelector("dd")).match(AGE_BIRTH);
    associates.push({
      name, relation: "associate",
      age: match ? parseInt(match[1], 10) : undefined,
      birthMonth: match?.[2],
    });
  }

  const aliases: string[] = [];
  const akaSection = doc.querySelector("#aka-links");
  if (akaSection) {
    for (const h3 of akaSection.querySelectorAll("h3")) {
      const name = textOf(h3);
      if (name && !aliases.includes(name)) aliases.push(name);
    }
  }

  const employment: DetailJob[] = [];
  for (const dl of doc.querySelectorAll("#current_employment_section dl")) {
    const employer = textOf(dl.querySelector("dt"));
    if (!employer) continue;
    const job: DetailJob = { employer };
    for (const dd of dl.querySelectorAll("dd")) {
      const text = textOf(dd);
      if (/^title:/i.test(text)) job.title = text.replace(/^title:\s*/i, "");
      else if (/^since:/i.test(text)) job.since = text.replace(/^since:\s*/i, "");
      else if (text) job.location = text;
    }
    employment.push(job);
  }

  const jobHistory: DetailJob[] = [];
  for (const dl of doc.querySelectorAll("#work_experience_section dl")) {
    const employer = textOf(dl.querySelector("dt"));
    if (!employer) continue;
    const dds = dl.querySelectorAll("dd");
    jobHistory.push({
      employer,
      title: dds[0] ? textOf(dds[0]) : undefined,
      duration: dds[1] ? textOf(dds[1]) : undefined,
    });
  }

  const education: DetailEducation[] = [];
  for (const dl of doc.querySelectorAll("#education_section dl")) {
    const school = textOf(dl.querySelector("dt"));
    if (!school) continue;
    const details = Array.from(dl.querySelectorAll("dd")).map(textOf).filter(Boolean);
    education.push({ school, details: details.length ? details : undefined });
  }

  const properties: Record<string, unknown>[] = [];
  const propertyData = doc.querySelector("#current_property_data");
  if (propertyData) {
    const property: Record<string, unknown> = {};
    for (const dl of propertyData.querySelectorAll("dl")) {
      const key = FPS_PROPERTY_LABELS[textOf(dl.querySelector("dt"))];
      if (!key) continue;
      const value = textOf(dl.querySelector("dd"));
      if (!value) continue;
      if (FPS_PROPERTY_NUMERIC_FIELDS.has(key)) {
        const digits = value.replace(/[^\d]/g, "");
        if (digits) property[key] = parseInt(digits, 10);
      } else {
        property[key] = value;
      }
    }
    if (Object.keys(property).length) properties.push(property);
  }

  return {
    fullName, age, bornDate, aliases, primaryAddress, previousAddresses,
    phoneNumbers, phoneDetails, emails, relatives, associates, employment,
    jobHistory, education, properties,
  };
}

// ---------------------------------------------------------------------------
// AnyWho — ported from AnyWhoScraper.parseDetailFromHtml
// ---------------------------------------------------------------------------

/**
 * Restore the values AnyWho hides behind its CSS blur.
 *
 * AnyWho does NOT redact server-side. It splits a value across spans and moves
 * one fragment into a `data-content` attribute on an EMPTY span, then renders it
 * with `class="blur-sm before:content-[attr(data-content)]"`. The text is
 * therefore absent from the DOM's text content but fully present in the markup:
 *
 *   <span><span>w</span><span data-content="elctola" class="blur-sm ..."></span><span>@aol.com</span></span>
 *
 * Read as text that is "w@aol.com"; substitute the attribute and it is
 * "welctola@aol.com". The same split hides phone digits ("816263" + "0393") and
 * street numbers ("7935" + " Holmes Rd").
 *
 * 53 elements were affected on a single saved profile, so this is routine, not
 * an edge case. Without it every AnyWho email is truncated -- and AnyWho is the
 * primary email source for the whole pipeline, since zaba masks the same
 * addresses server-side and those masked values are NOT recoverable.
 *
 * Exported because the summary scraper very likely needs it too; whether AnyWho
 * blurs its search-results pages the same way is unverified. See
 * docs/SCAN_SEQUENCE.md §7b.
 */
export function deblurAnywhoHtml(html: string): string {
  if (!html) return html;
  // Empty span carrying the hidden fragment -> the fragment as plain text.
  return html.replace(
    /<span\s+[^>]*?data-content="([^"]*)"[^>]*>\s*<\/span>/g,
    (_full, hidden: string) => hidden,
  );
}

export function parseAnywhoDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(deblurAnywhoHtml(html)) as unknown as El;
  if (!doc) return {};

  const nameEl = doc.querySelector("h1.text-display-sm") || doc.querySelector("h1");
  let fullName = textOf(nameEl);
  if (!fullName) return {};

  let age: number | undefined;
  const nameAgeMatch = fullName.match(/^(.+?),\s*(\d+)$/);
  if (nameAgeMatch) {
    fullName = nameAgeMatch[1].trim();
    age = parseInt(nameAgeMatch[2], 10);
  }

  const bodyText = textOf(doc.querySelector("body")) || textOf(doc);

  const phoneNumbers: string[] = [];
  const phoneDetails: DetailPhone[] = [];
  const phonesSection = doc.querySelector("#phones");
  if (phonesSection) {
    for (const item of phonesSection.querySelectorAll(".show-more-item")) {
      // Read the card's text directly. deblurAnywhoHtml() has already put the
      // hidden fragment back inline, so the digits are contiguous here.
      //
      // This previously reached for `span[data-content]` and concatenated the
      // attribute onto its previous sibling -- a per-field version of the same
      // trick. That has to go: once the substitution runs there is no
      // data-content span left to find, and the loop would `continue` past
      // every card and return zero phones.
      const itemText = textOf(item);
      const digits = itemText.replace(/\D/g, "");
      if (digits.length < 10) continue;
      const ten = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.slice(0, 10);
      if (ten.length !== 10) continue;
      const formatted = `${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}`;
      if (phoneNumbers.includes(formatted)) continue;
      phoneNumbers.push(formatted);

      // The rest of the card's text is "<City, ST>•<Carrier>" -- location
      // before the bullet, carrier after -- both computed alongside the
      // digits above and previously discarded.
      const numberMatch = itemText.match(/\d[\d\s().-]{8,}\d/);
      const tail = numberMatch ? itemText.slice((numberMatch.index ?? 0) + numberMatch[0].length) : "";
      const parts = tail.split("•").map((p) => p.trim()).filter(Boolean);
      const detail: DetailPhone = { number: formatted };
      if (parts[0]) detail.location = parts[0].slice(0, 60);
      if (parts[1]) {
        detail.carrier = parts[1].replace(/(View|Show|Unlock|See)\s*[-+]?\d*\s*(More|Less)?/gi, "").trim().slice(0, 60);
      }
      phoneDetails.push(detail);
    }
  }

  const aliases: string[] = [];
  for (const p of doc.querySelectorAll("p")) {
    const text = textOf(p);
    if (!text.startsWith("Aka:")) continue;
    for (const name of text.replace(/^Aka:\s*/i, "").split(/,\s*|\s+or\s+/i)) {
      const trimmed = name.trim();
      if (trimmed && !aliases.includes(trimmed)) aliases.push(trimmed);
    }
    break;
  }

  const emails: string[] = [];
  const emailPattern = /\b([a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const emailsSection = doc.querySelector("#emails");

  const pushEmail = (raw: string) => {
    const cleaned = raw.toLowerCase().trim();
    if (!/^[a-z0-9*._%+-]+@[a-z0-9.-]+\.[a-z]{2,63}$/.test(cleaned)) return;
    if (cleaned.includes("anywho") || cleaned.includes("example")) return;
    if (!emails.includes(cleaned)) emails.push(cleaned);
  };

  if (emailsSection) {
    // Per-card, and within the card the FIRST child div holds the address on
    // its own. Reading the whole card instead runs the address straight into
    // the provider label, because textOf() joins adjacent nodes with no
    // separator: "monkey1631@aol.com" + "aol" reads as "...@aol.comaol",
    // which is a plausible-looking but wrong address.
    for (const card of emailsSection.querySelectorAll(".show-more-item")) {
      const holder = card.querySelector("div") ?? card;
      const value = textOf(holder as El).trim();
      if (value.includes("@")) pushEmail(value);
    }
  }

  // Fall back to a whole-page sweep only when the section yielded nothing --
  // an unrecognised layout should degrade, not return empty.
  if (emails.length === 0) {
    const emailSource = emailsSection ? textOf(emailsSection) : bodyText;
    for (const match of emailSource.matchAll(emailPattern)) pushEmail(match[1]);
  }

  let primaryAddress: DetailAddress | undefined;
  const previousAddresses: DetailAddress[] = [];
  const addressesSection = doc.querySelector("#addresses");
  if (addressesSection) {
    let first = true;
    for (const heading of addressesSection.querySelectorAll("h4")) {
      const streetText = textOf(heading);
      if (!streetText || streetText.length < 5) continue;
      if (streetText.includes("Address History") || streetText.includes("We found")) continue;

      const containerText = textOf(heading.parentElement);
      const locationMatch = containerText.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s*([A-Z]{2})(?:,?\s*(\d{5}(?:-\d{4})?))?/);
      const city = locationMatch?.[1]?.trim();
      const state = locationMatch?.[2]?.trim();
      const zip = locationMatch?.[3]?.substring(0, 5);
      const isCurrent = first || containerText.includes("CURRENT") || containerText.includes("has resided here");
      const addr = addrFromParts(streetText, city, state, zip, streetText);

      // "James lived here in this Single Family Residential from 2005 to
      // 2025" -- a sentence sitting in the same block as the street/
      // city-state text already read above, previously discarded.
      const propertyIdx = containerText.indexOf("in this ");
      if (propertyIdx !== -1) {
        const propertyType = containerText
          .slice(propertyIdx + "in this ".length)
          .replace(/\s+from\s+\d{4}\s+to\s+\d{4}\s*$/i, "")
          .replace(/\s+in\s+\d{4}\s*$/i, "")
          .trim();
        if (propertyType) addr.propertyType = propertyType;
      }

      if (isCurrent && !primaryAddress) primaryAddress = addr;
      else previousAddresses.push(addr);
      first = false;
    }
  }

  const relatives: DetailRelation[] = [];
  const relativePattern = /Relative\s+data\s+re\s*s?\s*ult[:\s]+([A-Za-z\s]+?)\s*(Female|Male)\s*[•·\-]\s*(\d+)/gi;
  for (const match of bodyText.matchAll(relativePattern)) {
    // match[2] (gender) was already captured by this regex and never used.
    relatives.push({
      name: match[1].trim(), relation: "family",
      gender: match[2], age: parseInt(match[3], 10),
    });
  }

  // #court-records ("Legal Records (N)"): a nationwide count, plus a
  // county-level count when the person has local records. The generic
  // category list alongside them (Police/Criminal, Sex Offender, ...) is
  // boilerplate, not per-record data -- not extracted.
  let legalRecords: DetailLegalRecords | undefined;
  for (const h3 of doc.querySelectorAll("h3")) {
    const heading = textOf(h3);
    if (heading !== "County Records" && heading !== "Nationwide Search") continue;
    const paragraphs = h3.parentElement?.querySelectorAll("p") ?? [];
    if (paragraphs.length < 2) continue;
    const location = textOf(paragraphs[0]);
    const countMatch = textOf(paragraphs[1]).match(/(\d+)/);
    const count = countMatch ? parseInt(countMatch[1], 10) : undefined;
    legalRecords = legalRecords ?? {};
    if (heading === "County Records") legalRecords.countyRecords = { location, count };
    else legalRecords.nationwideCount = count;
  }

  return {
    fullName, age, aliases, primaryAddress, previousAddresses,
    phoneNumbers, phoneDetails, emails, relatives, associates: [], legalRecords,
  };
}

// ---------------------------------------------------------------------------
// Zaba — ported from ZabasearchScraper.parseDetailFromHtml
// ---------------------------------------------------------------------------

export function parseZabaDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(html) as unknown as El;
  if (!doc) return {};
  // Search-result feeds (div.person cards) aren't a detail page — bail, let the caller fall back.
  if (doc.querySelectorAll("div.person").length > 0) return {};

  const bodyText = textOf(doc.querySelector("body")) || textOf(doc);

  const nameEl = doc.querySelector("h1") || doc.querySelector("h2 a");
  let fullName = textOf(nameEl);
  let age: number | undefined;
  const nameMatch = fullName.match(/^(.+?),\s*(\d+)$/);
  if (nameMatch) {
    fullName = nameMatch[1].trim();
    age = parseInt(nameMatch[2], 10);
  }
  if (!age) {
    const ageMatch = bodyText.match(/Age\s+(\d+)/i);
    if (ageMatch) age = parseInt(ageMatch[1], 10);
  }
  if (!fullName) return {};

  const phoneNumbers: string[] = [];
  const seenPhones = new Set<string>();
  for (const link of doc.querySelectorAll("a[href^='tel:']")) {
    const phoneText = textOf(link);
    const cleaned = phoneText.replace(/\D/g, "");
    if (cleaned.length >= 10 && !seenPhones.has(cleaned)) {
      seenPhones.add(cleaned);
      phoneNumbers.push(phoneText);
    }
  }

  const emails: string[] = [];
  const seenEmails = new Set<string>();
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  for (const match of bodyText.matchAll(emailPattern)) {
    const email = match[1].toLowerCase();
    if (!seenEmails.has(email) && !email.includes("zabasearch") && !/x{3,}/i.test(email)) {
      seenEmails.add(email);
      emails.push(email);
    }
  }

  let primaryAddress: DetailAddress | undefined;
  const previousAddresses: DetailAddress[] = [];
  const addressSection = doc.querySelector("#addresses") || doc.querySelector(".addresses");
  if (addressSection) {
    let index = 0;
    for (const div of addressSection.querySelectorAll("div, li")) {
      const addrText = textOf(div);
      if (addrText.length <= 10 || !/\d/.test(addrText)) continue;
      const stateMatch = addrText.match(/\s([A-Z]{2})\s+\d{5}/);
      const zipMatch = addrText.match(/\b(\d{5})(?:-\d{4})?\b/);
      const cityMatch = addrText.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
      const addr = addrFromParts(undefined, cityMatch?.[1]?.trim(), stateMatch?.[1], zipMatch?.[1], addrText);
      if (index === 0) primaryAddress = addr;
      else previousAddresses.push(addr);
      index++;
    }
  }

  const relatives: DetailRelation[] = [];
  const relativesSection = doc.querySelector("#relatives") || doc.querySelector(".relatives");
  if (relativesSection) {
    const seenRelatives = new Set<string>();
    for (const link of relativesSection.querySelectorAll("a")) {
      const relName = textOf(link);
      const nameLower = relName.toLowerCase();
      if (relName.length > 2 && relName.length < 50 && !seenRelatives.has(nameLower) && /^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(relName)) {
        seenRelatives.add(nameLower);
        const parentText = textOf(link.parentElement);
        const ageMatch = parentText.match(/Age\s*(\d+)/i);
        relatives.push({ name: relName, relation: "family", age: ageMatch ? parseInt(ageMatch[1], 10) : undefined });
      }
    }
  }

  return { fullName, age, primaryAddress, previousAddresses, phoneNumbers, emails, relatives, associates: [] };
}

// ---------------------------------------------------------------------------
// NPD — no prior scraper to port from. First draft, unverified against real HTML.
// ---------------------------------------------------------------------------

export function parseNpdDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(html) as unknown as El;
  if (!doc) return {};

  const nameEl = doc.querySelector("h1");
  const fullName = textOf(nameEl);
  if (!fullName) return {};

  const bodyText = textOf(doc.querySelector("body")) || textOf(doc);
  const ageMatch = bodyText.match(/Age[:\s]+(\d{1,3})/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

  const phoneNumbers: string[] = [];
  const seenPhones = new Set<string>();
  const phonePattern = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
  const phoneSection = doc.querySelector("#phones") || doc.querySelector('[id*="phone" i]');
  for (const match of textOf(phoneSection || (doc as unknown as El)).matchAll(phonePattern)) {
    const cleaned = match[0].replace(/\D/g, "");
    if (cleaned.length === 10 && !seenPhones.has(cleaned)) {
      seenPhones.add(cleaned);
      phoneNumbers.push(match[0]);
    }
  }

  const emails: string[] = [];
  const seenEmails = new Set<string>();
  const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  for (const match of bodyText.matchAll(emailPattern)) {
    const email = match[1].toLowerCase();
    if (!seenEmails.has(email) && !email.includes("nationalpublicdata")) {
      seenEmails.add(email);
      emails.push(email);
    }
  }

  let primaryAddress: DetailAddress | undefined;
  const previousAddresses: DetailAddress[] = [];
  const addressSection = doc.querySelector("#addresses") || doc.querySelector('[id*="address" i]');
  if (addressSection) {
    let index = 0;
    for (const el of addressSection.querySelectorAll("div, li, p")) {
      const addrText = textOf(el);
      if (addrText.length <= 10 || !/\d/.test(addrText)) continue;
      const stateMatch = addrText.match(/\s([A-Z]{2})\s+\d{5}/);
      const zipMatch = addrText.match(/\b(\d{5})(?:-\d{4})?\b/);
      const cityMatch = addrText.match(/,\s*([A-Za-z\s]+),\s*[A-Z]{2}/);
      const addr = addrFromParts(undefined, cityMatch?.[1]?.trim(), stateMatch?.[1], zipMatch?.[1], addrText);
      if (index === 0) primaryAddress = addr;
      else previousAddresses.push(addr);
      index++;
      if (index >= 6) break;
    }
  }

  const relatives: DetailRelation[] = [];
  const relativesSection = doc.querySelector("#relatives") || doc.querySelector('[id*="relative" i]');
  if (relativesSection) {
    const seen = new Set<string>();
    for (const link of relativesSection.querySelectorAll("a")) {
      const relName = textOf(link);
      const key = relName.toLowerCase();
      if (relName.length > 2 && relName.length < 50 && !seen.has(key)) {
        seen.add(key);
        relatives.push({ name: relName, relation: "family" });
      }
    }
  }

  return { fullName, age, primaryAddress, previousAddresses, phoneNumbers, emails, relatives, associates: [] };
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

const DETAIL_PARSERS: Partial<Record<BrokerName, (html: string) => BrokerDetailProfile>> = {
  [BrokerName.FPS]: parseFpsDetail,
  [BrokerName.ANYWHO]: parseAnywhoDetail,
  [BrokerName.ZABA]: parseZabaDetail,
  [BrokerName.NPD]: parseNpdDetail,
};

/**
 * Visit every member's profile_url in parallel and parse the real detail page.
 * Each broker gets its own timeout — one slow/blocked broker never holds up the rest.
 * Falls back to the flat Phase 1 summary data (already known) if a detail fetch
 * fails, times out, or the page has nothing the parser recognizes.
 */
export async function scrapeBrokerDetails(
  members: DedupMember[],
  timeoutMs = DEFAULT_DETAIL_TIMEOUT_MS,
): Promise<Record<string, unknown>> {
  const settled = await Promise.allSettled(
    members.map(async (member) => {
      const { broker, profile_url } = member.summary;
      if (!profile_url) return { broker, profile: summaryFallback(member.summary) };

      try {
        const page = await scrapeHtml(profile_url, { timeoutMs });
        if (page.notFound || !page.html) return { broker, profile: summaryFallback(member.summary) };

        const parser = DETAIL_PARSERS[broker];
        const detail = parser?.(page.html);
        if (!detail || !detail.fullName) {
          console.warn(`⚠️ ${broker} detail page parsed empty — falling back to summary data`);
          return { broker, profile: summaryFallback(member.summary) };
        }
        return { broker, profile: detail };
      } catch (error) {
        console.warn(`⚠️ ${broker} detail scrape failed/timed out (${timeoutMs}ms): ${(error as Error).message}`);
        return { broker, profile: summaryFallback(member.summary) };
      }
    }),
  );

  const out: Record<string, unknown> = {};
  for (const result of settled) {
    if (result.status === "fulfilled") {
      out[result.value.broker] = result.value.profile;
    }
  }
  return out;
}
