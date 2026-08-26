/**
 * Phase 1 HTML parsers — ported from vanyshr-scraper-lab *_html_scraper.py.
 * Fetch is context.dev; parse is local. Camoufox path is not used here.
 */

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import {
  BrokerName,
  type QuickScanInput,
  type ScrapeResult,
  type SummaryResult,
} from "./quickscan-phase1-phase2-models.ts";
import { ContextDevError, scrapeHtml } from "./context-dev-client.ts";

const MAX_RESULTS = 5;
// Was 5 -- confirmed against the Python scraper-lab's real captured fixtures
// to silently drop phones (7->5, 9->5) and aliases (10->5) on real Zaba
// profiles. Raised with headroom above observed maxima (see
// vanyshr-scraper-lab's zaba_html_scraper.py for the same fix).
const MAX_VALUES = 20;

const STATE_NAMES: Record<string, string> = {
  AL: "alabama", AK: "alaska", AZ: "arizona", AR: "arkansas",
  CA: "california", CO: "colorado", CT: "connecticut", DE: "delaware",
  DC: "district-of-columbia", FL: "florida", GA: "georgia", HI: "hawaii",
  ID: "idaho", IL: "illinois", IN: "indiana", IA: "iowa",
  KS: "kansas", KY: "kentucky", LA: "louisiana", ME: "maine",
  MD: "maryland", MA: "massachusetts", MI: "michigan", MN: "minnesota",
  MS: "mississippi", MO: "missouri", MT: "montana", NE: "nebraska",
  NV: "nevada", NH: "new-hampshire", NJ: "new-jersey", NM: "new-mexico",
  NY: "new-york", NC: "north-carolina", ND: "north-dakota", OH: "ohio",
  OK: "oklahoma", OR: "oregon", PA: "pennsylvania", RI: "rhode-island",
  SC: "south-carolina", SD: "south-dakota", TN: "tennessee", TX: "texas",
  UT: "utah", VT: "vermont", VA: "virginia", WA: "washington",
  WV: "west-virginia", WI: "wisconsin", WY: "wyoming",
};

const STATE_ABBR: Record<string, string> = Object.fromEntries(
  Object.entries(STATE_NAMES)
    .filter(([k]) => k !== "DC")
    .map(([abbr, name]) => [name.replace(/-/g, " "), abbr]),
);

type El = {
  nodeType: number;
  nodeName: string;
  textContent: string | null;
  childNodes: El[];
  children?: El[];
  parentElement: El | null;
  classList?: { contains: (c: string) => boolean };
  className?: string;
  getAttribute: (name: string) => string | null;
  querySelector: (sel: string) => El | null;
  querySelectorAll: (sel: string) => El[];
  getElementsByTagName?: (tag: string) => El[];
};

function parseDoc(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

function textOf(el: El | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/'/g, "").replace(/\s+/g, "-");
}

function absUrl(base: string, href: string): string {
  if (!href) return "";
  if (/^https?:\/\//i.test(href)) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseAge(raw?: string | null): number | undefined {
  if (!raw) return undefined;
  const digits = String(raw).match(/\d+/);
  if (!digits) return undefined;
  const n = parseInt(digits[0], 10);
  return n < 150 ? n : undefined;
}

function joinUnique(values: string[], limit = MAX_VALUES): string {
  const seen: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || seen.includes(v)) continue;
    seen.push(v);
  }
  return seen.slice(0, limit).join(", ");
}

function closestClass(el: El | null, className: string): El | null {
  let cur = el;
  while (cur) {
    if (cur.classList?.contains(className)) return cur;
    const cn = typeof cur.className === "string" ? cur.className : "";
    if (cn.split(/\s+/).includes(className)) return cur;
    cur = cur.parentElement;
  }
  return null;
}

function allTags(root: El | { querySelectorAll: (s: string) => El[] }, tag: string): El[] {
  return Array.from(root.querySelectorAll(tag));
}

function jsonLdBlocks(html: string): unknown[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const out: unknown[] = [];
  for (const script of Array.from(doc.querySelectorAll('script[type="application/ld+json"]'))) {
    const raw = script.textContent?.trim();
    if (!raw) continue;
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) out.push(...data);
      else out.push(data);
    } catch {
      /* ignore */
    }
  }
  return out;
}

function jsonLdPersons(html: string): Record<string, unknown>[] {
  return jsonLdBlocks(html).filter((b): b is Record<string, unknown> => {
    if (!b || typeof b !== "object") return false;
    const t = (b as { "@type"?: unknown })["@type"];
    if (t === "Person") return true;
    return Array.isArray(t) && t.includes("Person");
  });
}

function emptySummary(broker: BrokerName, extra: Partial<SummaryResult> & { full_name: string }): SummaryResult {
  return {
    broker,
    full_name: extra.full_name,
    address: extra.address || "",
    age_range: extra.age_range || (extra.age !== undefined ? String(extra.age) : ""),
    age: extra.age,
    location: extra.location || extra.address || "",
    profile_url: extra.profile_url || "",
    result_id: extra.result_id,
    phone: extra.phone || "",
    email: extra.email || "",
    aliases: extra.aliases || "",
    relatives: extra.relatives || "",
    associates: extra.associates || "",
    previous_addresses: extra.previous_addresses || "",
    birth_date: extra.birth_date || "",
    job_history: extra.job_history || "",
    education: extra.education || "",
  };
}

// ---------------------------------------------------------------------------
// FPS
// ---------------------------------------------------------------------------

export function buildFpsUrl(input: QuickScanInput): string {
  const first = input.first_name.toLowerCase().replace(/'/g, "");
  const last = input.last_name.toLowerCase().replace(/'/g, "");
  const city = slug(input.city);
  const state = input.state.toLowerCase();
  return `https://www.fastpeoplesearch.com/name/${first}-${last}_${city}-${state}`;
}

export function parseFpsSummaries(html: string): SummaryResult[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const results: SummaryResult[] = [];

  for (const card of Array.from(doc.querySelectorAll("div.card-block"))) {
    const nameEl = card.querySelector("h3.card-title a span.larger") ||
      card.querySelector("span.larger");
    const name = textOf(nameEl as El);
    if (!name || name.length < 2) continue;

    const greyEl = card.querySelector("h3.card-title a span.grey") ||
      card.querySelector("span.grey");
    const greyText = textOf(greyEl as El);
    let address = "";
    let age: number | undefined;
    if (greyText) {
      const ageMatch = greyText.match(/(?:Age|age)\s*:?\s*(\d{1,3})/);
      if (ageMatch) {
        const n = parseInt(ageMatch[1], 10);
        if (n < 150) age = n;
      }
      if (greyText.includes("•")) address = greyText.split("•")[1].trim();
    }

    const addrLink = card.querySelector('a[href*="/address/"]') as El | null;
    if (addrLink) {
      const title = (addrLink.getAttribute("title") || "").trim();
      const match = title.match(/address\s+(.+)$/i);
      if (match) address = match[1].trim();
      else if (!address) address = textOf(addrLink);
    }

    let relatives = "";
    for (const heading of allTags(card as El, "h4")) {
      if (!textOf(heading).toLowerCase().includes("relative")) continue;
      const parent = heading.parentElement;
      if (!parent) break;
      const names = allTags(parent, "a").map(textOf).filter(Boolean);
      relatives = joinUnique(names);
      break;
    }

    let aliases = "";
    for (const heading of allTags(card as El, "h4")) {
      if (!textOf(heading).toLowerCase().includes("aka")) continue;
      const parent = heading.parentElement;
      if (!parent) break;
      const headingText = textOf(heading);
      const after = textOf(parent).slice(headingText.length);
      aliases = joinUnique(after.split("•"));
      break;
    }

    const profileLink = card.querySelector("h3.card-title a") as El | null;
    const href = profileLink?.getAttribute("href") || "";

    results.push(emptySummary(BrokerName.FPS, {
      result_id: `fps_${results.length}`,
      full_name: name,
      address,
      age,
      profile_url: absUrl("https://www.fastpeoplesearch.com", href),
      relatives,
      aliases,
    }));
    if (results.length >= MAX_RESULTS) break;
  }

  // Cards are richer (age, street) when present. JSON-LD Person is the
  // fallback: context.dev can return a results page whose cards don't
  // parse but whose Person nodes still carry name, city, relatives, and
  // the /name_id_G… profile URL. Bot-check HTML has no Person, so this
  // stays empty there.
  if (results.length === 0) return parseFpsJsonLd(html);
  return results;
}

function jsonLdPostalLine(place: Record<string, unknown>): string {
  const addr = (place.address && typeof place.address === "object")
    ? place.address as Record<string, string>
    : {};
  return [addr.streetAddress, addr.addressLocality, addr.addressRegion]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");
}

function parseFpsJsonLd(html: string): SummaryResult[] {
  const results: SummaryResult[] = [];
  for (const person of jsonLdPersons(html)) {
    const name = String(person.name || "").trim();
    if (!name) continue;
    const url = String(person.url || person["@id"] || "");
    // Search-page JSON-LD also emits Organization / nav graphs; Person
    // profile nodes carry /name_id_G… URLs. Skip anything else.
    if (url && !/_id_/i.test(url)) continue;

    const homes = Array.isArray(person.homeLocation) ? person.homeLocation : [];
    const places = homes.filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object");
    const recent = places.find((p) =>
      /recent|current/i.test(String(p.description || "")),
    ) || places[0];
    const address = recent ? jsonLdPostalLine(recent) : "";
    const previous = places
      .filter((p) => p !== recent)
      .map(jsonLdPostalLine)
      .filter(Boolean);

    const related = Array.isArray(person.relatedTo) ? person.relatedTo : [];
    const relatives = joinUnique(
      related
        .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
        .map((r) => String(r.name || "")),
    );

    results.push(emptySummary(BrokerName.FPS, {
      result_id: url || `fps_jsonld_${results.length}`,
      full_name: name,
      address,
      profile_url: absUrl("https://www.fastpeoplesearch.com", url),
      relatives,
      previous_addresses: previous.join("; "),
    }));
    if (results.length >= MAX_RESULTS) break;
  }
  return results;
}

// ---------------------------------------------------------------------------
// NPD
// ---------------------------------------------------------------------------

export function buildNpdUrl(input: QuickScanInput): string {
  const first = input.first_name.toLowerCase().replace(/'/g, "");
  const last = input.last_name.toLowerCase().replace(/'/g, "");
  const stateRaw = input.state.trim();
  const stateAbbr = stateRaw.length === 2
    ? stateRaw.toLowerCase()
    : (STATE_ABBR[stateRaw.toLowerCase()] || stateRaw.slice(0, 2)).toLowerCase();
  const city = slug(input.city);
  return `https://nationalpublicdata.com/people/${last[0]}/${first}-${last}/${stateAbbr}/${city}/`;
}

function formatPhones(values: unknown): string {
  const list = !values ? [] : Array.isArray(values) ? values : [values];
  const formatted: string[] = [];
  for (const raw of list) {
    let digits = String(raw || "").replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (digits.length !== 10) continue;
    const number = `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    if (!formatted.includes(number)) formatted.push(number);
  }
  return formatted.slice(0, MAX_VALUES).join(", ");
}

function joinJsonLd(values: unknown): string {
  if (!values) return "";
  const list = Array.isArray(values) ? values : [values];
  return joinUnique(list.map((v) => String(v || "")));
}

function npdCurrentAddress(home: unknown): string {
  if (!Array.isArray(home)) return "";
  const places = home.filter((p): p is Record<string, unknown> => Boolean(p) && typeof p === "object");
  const current = places.find((p) =>
    String(p.description || "").toLowerCase().includes("current"),
  ) || places[0];
  if (!current) return "";
  const addr = (current.address && typeof current.address === "object")
    ? current.address as Record<string, string>
    : {};
  return [addr.streetAddress, addr.addressLocality, addr.addressRegion]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");
}

export function parseNpdSummaries(html: string): SummaryResult[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const persons = jsonLdPersons(html);
  const results: SummaryResult[] = [];

  for (const h2 of allTags(doc as unknown as El, "h2")) {
    const parent = closestClass(h2, "name-cards-head");
    if (!parent) continue;
    const h2Text = textOf(h2);
    const match = h2Text.match(/^([A-Za-z\s]+),\s*(\d+)([A-Za-z\s,]+)/);
    if (!match) continue;

    const name = match[1].trim();
    const ageStr = match[2];
    let fullAddress = match[3].trim();
    const age = parseInt(ageStr, 10);
    let phone = "";
    let email = "";
    let relatives = "";

    const street = textOf(parent).match(
      /(\d+\s+[A-Za-z\s]+(?:St|Ave|Rd|Dr|Ln|Way|Court|Blvd)\.?[,\s]+[\w\s,]+[A-Z]{2}\s+\d{5})/,
    );
    if (street) fullAddress = street[1];

    const person = persons.find((p) =>
      String(p.name || "").trim().toLowerCase() === name.toLowerCase(),
    );
    if (person) {
      phone = formatPhones(person.telephone);
      email = joinJsonLd(person.email);
      const related = Array.isArray(person.relatedTo) ? person.relatedTo : [];
      relatives = joinUnique(
        related.filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
          .map((r) => String(r.name || "")),
      );
      const fromLd = npdCurrentAddress(person.HomeLocation || person.homeLocation);
      if (fromLd) fullAddress = fromLd;
    }

    const link = (h2 as El).querySelector?.('a[href*="/people/"]') as El | null;
    const href = link?.getAttribute("href") ||
      ((parent.querySelector('a[href*="/people/"]') as El | null)?.getAttribute("href") || "");

    results.push(emptySummary(BrokerName.NPD, {
      result_id: `npd_${results.length}`,
      full_name: name,
      address: fullAddress,
      age: Number.isFinite(age) ? age : undefined,
      age_range: ageStr,
      profile_url: absUrl("https://nationalpublicdata.com", href),
      phone,
      email,
      relatives,
    }));
    if (results.length >= MAX_RESULTS) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// AnyWho
// ---------------------------------------------------------------------------

const MORE_AFFORDANCE = /^\+?\s*\d*\s*more$/i;

export function buildAnywhoUrl(input: QuickScanInput): string {
  const first = input.first_name.toLowerCase().replace(/'/g, "");
  const last = input.last_name.toLowerCase().replace(/'/g, "");
  const stateName = STATE_NAMES[input.state.toUpperCase()] || slug(input.state);
  const city = slug(input.city);
  return `https://www.anywho.com/people/${first}+${last}/${stateName}/${city}`;
}

function reconstruct(el: El | null | undefined): string {
  if (!el) return "";
  if (el.nodeType === 3) return el.textContent || "";
  const tag = (el.nodeName || "").toLowerCase();
  if (["svg", "script", "style", "noscript", "#comment"].includes(tag)) return "";
  let out = "";
  const dc = el.getAttribute?.("data-content");
  if (dc) out += dc;
  for (const child of el.childNodes || []) {
    out += reconstruct(child);
  }
  return out;
}

function joinSection(values: string[]): string {
  const cleaned: string[] = [];
  for (const raw of values) {
    const v = raw.trim();
    if (!v || MORE_AFFORDANCE.test(v)) continue;
    if (!cleaned.includes(v)) cleaned.push(v);
  }
  return cleaned.slice(0, MAX_VALUES).join(", ");
}

export function parseAnywhoSummaries(html: string): SummaryResult[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const results: SummaryResult[] = [];
  const seen = new Set<string>();

  const cards = Array.from(doc.querySelectorAll("div")).filter((div) => {
    const cn = (div as El).className || "";
    return /\bbg-white\b/.test(cn) && /\bshadow/.test(cn);
  }) as El[];

  for (const card of cards) {
    const h2 = card.querySelector("h2");
    if (!h2) continue;
    const name = textOf(h2);
    if (!name || seen.has(name) || name.split(/\s+/).length < 2) continue;
    if (/Summary|Numbers|FAQ|F\.A\.Q|Filter|Area Code|Find|People/.test(name)) continue;
    if (!/^[A-Za-z\s\-']+$/.test(name)) continue;
    seen.add(name);

    let address = "";
    let ageText = "";
    let profileUrl = "";
    let phone = "";
    let email = "";
    let aliases = "";
    let relatives = "";
    let previous = "";

    const header = h2.parentElement;
    if (header) {
      const ageMatch = reconstruct(header).match(/Age\s+(\d{1,3})/);
      if (ageMatch) {
        const n = parseInt(ageMatch[1], 10);
        if (n < 150) ageText = String(n);
      }
    }

    const h3s = allTags(card, "h3");
    for (let i = 0; i < h3s.length; i++) {
      const h3 = h3s[i];
      const label = textOf(h3).toUpperCase();
      let section = "";
      let sib = h3.nextElementSibling as El | null | undefined;
      // deno-dom: nextElementSibling may exist
      if (!sib && (h3 as unknown as { nextElementSibling?: El }).nextElementSibling) {
        sib = (h3 as unknown as { nextElementSibling: El }).nextElementSibling;
      }
      let el: El | null = sib || null;
      if (!el) {
        // walk following siblings via parent children
        const parent = h3.parentElement;
        const kids = parent ? Array.from(parent.children || []) : [];
        const idx = kids.indexOf(h3);
        for (let k = idx + 1; k < kids.length; k++) {
          if ((kids[k].nodeName || "").toLowerCase() === "h3") break;
          const chunk = reconstruct(kids[k]).replace(/\s+/g, " ").trim();
          if (chunk) section += " " + chunk;
        }
      } else {
        while (el && (el.nodeName || "").toLowerCase() !== "h3") {
          const chunk = reconstruct(el).replace(/\s+/g, " ").trim();
          if (chunk) section += " " + chunk;
          el = (el as unknown as { nextElementSibling?: El | null }).nextElementSibling || null;
        }
      }
      section = section.replace(/\s+/g, " ").trim();

      if (label.includes("USED TO LIVE")) {
        previous = section.split("•")
          .map((p) => p.trim())
          .filter((p) => p && !MORE_AFFORDANCE.test(p))
          .slice(0, 5)
          .join("; ");
      } else if (label.includes("LIVES IN")) {
        address = section.split("•")[0].trim().slice(0, 150);
      } else if (label.includes("PHONE")) {
        phone = joinSection(section.match(/\(\d{3}\)\s*\d{3}-\d{4}/g) || []);
      } else if (label.includes("EMAIL")) {
        email = joinSection(
          section.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+(?:\.[a-zA-Z]{2,})?/g) || [],
        );
      } else if (label.includes("AKA")) {
        aliases = joinSection(section.split("•"));
      } else if (label.includes("RELATED")) {
        relatives = joinSection(section.split("•"));
      }
    }

    const detail = Array.from(card.querySelectorAll("a")).find((a) =>
      /\/people\/.*?\/a\d+/.test((a as El).getAttribute("href") || ""),
    ) as El | undefined;
    if (detail) profileUrl = absUrl("https://www.anywho.com", detail.getAttribute("href") || "");

    results.push(emptySummary(BrokerName.ANYWHO, {
      result_id: `anywho_${results.length}`,
      full_name: name,
      address,
      age: parseAge(ageText),
      age_range: ageText,
      profile_url: profileUrl,
      phone,
      email,
      aliases,
      relatives,
      previous_addresses: previous,
    }));
    if (results.length >= MAX_RESULTS) break;
  }

  return results;
}

// ---------------------------------------------------------------------------
// Zaba
// ---------------------------------------------------------------------------

export function buildZabaUrl(input: QuickScanInput): string {
  const first = slug(input.first_name);
  const last = slug(input.last_name);
  const stateName = STATE_NAMES[input.state.toUpperCase()] || slug(input.state);
  const city = slug(input.city);
  return `https://www.zabasearch.com/people/${first}-${last}/${stateName}/${city}`;
}

function findSection(card: El, heading: string): El | null {
  for (const h of [...allTags(card, "h3"), ...allTags(card, "h4")]) {
    if (textOf(h).toLowerCase().includes(heading.toLowerCase())) {
      return h.parentElement;
    }
  }
  return null;
}

function listItems(card: El, heading: string): string[] {
  const section = findSection(card, heading);
  if (!section) return [];
  const items: string[] = [];
  for (const li of allTags(section, "li")) {
    const value = textOf(li);
    if (value && !items.includes(value)) items.push(value);
  }
  return items.slice(0, MAX_VALUES);
}

/**
 * Split an element's text on <br> into trimmed lines.
 *
 * Previously split el.textContent on "\n" -- but this deno_dom version does
 * not insert a newline (or any separator) at <br> boundaries, so that always
 * returned the whole text as one unsplit line ("7935 Holmes RDKansas City,
 * Missouri 64131"). Walking childNodes and breaking on the <br> node itself
 * is the reliable way to do this regardless of what textContent does.
 */
function linesOf(el: El | null): string[] {
  if (!el) return [];
  const parts: string[] = [];
  let current = "";
  for (const node of el.childNodes || []) {
    if ((node.nodeName || "").toLowerCase() === "br") {
      parts.push(current);
      current = "";
    } else {
      current += node.textContent || "";
    }
  }
  parts.push(current);
  return parts.map((ln) => ln.trim()).filter(Boolean);
}

function parseZabaAddress(lines: string[]): { formatted: string } {
  if (!lines.length) return { formatted: "" };
  const street = lines[0];
  const rest = lines[1] || "";
  return { formatted: [street, rest].filter(Boolean).join(", ") };
}

const MASKED_LOCAL = /^x+$/i;

function parseZabaPhones(card: El): string[] {
  const phones = new Map<string, string>();
  const associated = findSection(card, "Associated Phone Numbers");
  if (associated) {
    for (const li of allTags(associated, "li")) {
      const number = textOf(li);
      if (/^\(\d{3}\) \d{3}-\d{4}$/.test(number)) phones.set(number, number);
    }
  }
  const lastKnown = findSection(card, "Last Known Phone Numbers");
  if (lastKnown) {
    for (const h4 of allTags(lastKnown, "h4")) {
      const match = textOf(h4).match(/\(\d{3}\) \d{3}-\d{4}/);
      if (match) phones.set(match[0], match[0]);
    }
  }
  return [...phones.values()].slice(0, MAX_VALUES);
}

function parseZabaEmails(card: El): string[] {
  const section = findSection(card, "Associated Email Addresses");
  if (!section) return [];
  const emails: string[] = [];
  for (const li of allTags(section, "li")) {
    const value = textOf(li).replace(/\s+/g, "");
    if (!/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(value)) continue;
    if (MASKED_LOCAL.test(value.split("@")[0])) continue;
    if (!emails.includes(value)) emails.push(value);
  }
  return emails.slice(0, MAX_VALUES);
}

/**
 * "Job History": <li><p><strong>Name</strong><br>Title</p><p>Employer</p></li>
 * -- a distinct, overlapping-but-not-identical list from "Jobs" (not
 * extracted; a separately-formatted title/employer/date-range list with some
 * titles this one lacks and vice versa -- see vanyshr-scraper-lab's audit).
 */
function parseZabaJobHistory(card: El): string[] {
  const section = findSection(card, "Job History");
  if (!section) return [];
  const jobs: string[] = [];
  for (const li of allTags(section, "li")) {
    const paragraphs = allTags(li, "p");
    if (!paragraphs.length) continue;
    // First <p> is "<Name><br>Title" -- the name repeats on every entry, so
    // only the line after the <br> is the title.
    const lines = linesOf(paragraphs[0]);
    const title = lines.length > 1 ? lines[1] : (lines[0] || "");
    const employer = paragraphs.length > 1 ? textOf(paragraphs[1]) : "";
    const entry = [title, employer].filter(Boolean).join(" at ");
    if (entry) jobs.push(entry);
  }
  return jobs.slice(0, MAX_VALUES);
}

function ageFromBirthDate(value: unknown): number | undefined {
  const match = String(value ?? "").match(/\d{4}/);
  if (!match) return undefined;
  const age = new Date().getFullYear() - parseInt(match[0], 10);
  return age > 0 && age < 150 ? age : undefined;
}

function relatedToNames(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const names: string[] = [];
  for (const entry of value) {
    const name = entry && typeof entry === "object"
      ? String((entry as Record<string, unknown>).name || "").trim()
      : "";
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function parseZabaSummaries(html: string): SummaryResult[] {
  const doc = parseDoc(html);
  if (!doc) return [];
  const results: SummaryResult[] = [];
  const cards = Array.from(doc.querySelectorAll("div.person")).slice(0, MAX_RESULTS) as El[];

  for (const card of cards) {
    const nameEl = card.querySelector("#container-name h2") || card.querySelector("h2");
    const fullName = textOf(nameEl as El);
    if (!fullName) continue;

    let age: number | undefined;
    const rawAge = card.getAttribute("data-age") || "";
    if (/^\d+$/.test(rawAge) && parseInt(rawAge, 10) < 150) {
      age = parseInt(rawAge, 10);
    } else {
      const ageEl = card.querySelector(".container-age h3");
      age = parseAge(textOf(ageEl as El));
    }

    let address = "";
    const addrSection = findSection(card, "Last Known Address");
    if (addrSection) {
      const p = addrSection.querySelector("p");
      address = parseZabaAddress(linesOf(p as El)).formatted;
    }

    const past: string[] = [];
    const pastSection = findSection(card, "Past Addresses");
    if (pastSection) {
      for (const li of allTags(pastSection, "li").slice(0, MAX_VALUES)) {
        const formatted = parseZabaAddress(linesOf(li)).formatted;
        if (formatted) past.push(formatted);
      }
    }

    const aliases: string[] = [];
    const alt = card.querySelector("#container-alt-names") as El | null;
    if (alt) {
      for (const li of allTags(alt, "li")) {
        const v = textOf(li);
        if (v && !aliases.includes(v)) aliases.push(v);
      }
    }

    results.push(emptySummary(BrokerName.ZABA, {
      result_id: card.getAttribute("data-id") || `zaba_${results.length}`,
      full_name: fullName,
      address,
      age,
      phone: parseZabaPhones(card).join(", "),
      email: parseZabaEmails(card).join(", "),
      aliases: aliases.slice(0, MAX_VALUES).join(", "),
      relatives: listItems(card, "Possible Relatives").join(", "),
      associates: listItems(card, "Possible Associations").join(", "),
      previous_addresses: past.join("; "),
      job_history: parseZabaJobHistory(card).join("; "),
      education: listItems(card, "Education").join("; "),
    }));
  }

  // birthDate and a relatives fallback come from JSON-LD, which the rest of
  // this parser never reads. Zaba can publish more than one standalone
  // top-level Person block per page ("More than 1 record found"). Matched to
  // each card by position, since both render in the same order; only applied
  // when the counts agree and the JSON-LD person's derived age is close to
  // the card's own, as a guard against a mismatched pairing silently
  // attaching the wrong person's data (see vanyshr-scraper-lab's
  // zaba_html_scraper.py for the same fix and reasoning).
  const persons = jsonLdPersons(html);
  if (persons.length === results.length) {
    persons.forEach((person, i) => {
      const result = results[i];
      const computedAge = ageFromBirthDate(person.birthDate);
      if (
        result.age !== undefined && computedAge !== undefined &&
        Math.abs(result.age - computedAge) > 1
      ) {
        return;
      }
      if (person.birthDate) result.birth_date = String(person.birthDate);
      if (!result.relatives) {
        result.relatives = joinUnique(relatedToNames(person.relatedTo), MAX_VALUES);
      }
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

type Parser = (html: string) => SummaryResult[];
type UrlBuilder = (input: QuickScanInput) => string;

const BROKERS: { broker: BrokerName; url: UrlBuilder; parse: Parser }[] = [
  { broker: BrokerName.FPS, url: buildFpsUrl, parse: parseFpsSummaries },
  { broker: BrokerName.NPD, url: buildNpdUrl, parse: parseNpdSummaries },
  { broker: BrokerName.ANYWHO, url: buildAnywhoUrl, parse: parseAnywhoSummaries },
  { broker: BrokerName.ZABA, url: buildZabaUrl, parse: parseZabaSummaries },
];

// Fresh context.dev scrapes (maxAgeMs=0) take 15–25s+. The old 10s NPD cap
// and 25s default were tuned for cache hits (~0.6s) and abort uncached
// Zaba/NPD as "failed" before HTML arrives. FPS-first still overlaps the
// other three in the background, so they need the same window.
const DEFAULT_SCRAPE_TIMEOUT_MS = 60000;

async function scrapeOne(
  spec: (typeof BROKERS)[number],
  input: QuickScanInput,
  timeoutMs: number,
): Promise<ScrapeResult> {
  const effectiveTimeoutMs = timeoutMs;
  const started = Date.now();
  try {
    const searchUrl = spec.url(input);
    console.log(`🔗 ${spec.broker} context.dev ${searchUrl}`);
    const page = await scrapeHtml(searchUrl, { timeoutMs: effectiveTimeoutMs });
    const timing_ms = Date.now() - started;
    if (page.notFound) {
      return { broker: spec.broker, summaries: [], status: "no_results", timing_ms };
    }
    const summaries = spec.parse(page.html);
    return {
      broker: spec.broker,
      summaries,
      status: summaries.length ? "success" : "no_results",
      timing_ms,
    };
  } catch (err) {
    const timing_ms = Date.now() - started;
    const code = err instanceof ContextDevError ? err.errorCode : undefined;
    if (code === "NOT_FOUND") {
      return { broker: spec.broker, summaries: [], status: "no_results", timing_ms };
    }
    if (code === "WEBSITE_BLOCKED") {
      return {
        broker: spec.broker,
        summaries: [],
        status: "blocked",
        error: err instanceof Error ? err.message : String(err),
        timing_ms,
      };
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`✗ ${spec.broker} failed: ${message}`);
    return { broker: spec.broker, summaries: [], status: "failed", error: message, timing_ms };
  }
}

export async function scrapeAllBrokers(
  input: QuickScanInput,
  timeoutMs = DEFAULT_SCRAPE_TIMEOUT_MS,
  brokers?: BrokerName[],
): Promise<Record<string, ScrapeResult>> {
  const specs = brokers ? BROKERS.filter((b) => brokers.includes(b.broker)) : BROKERS;
  const results = await Promise.all(specs.map((spec) => scrapeOne(spec, input, timeoutMs)));
  const out: Record<string, ScrapeResult> = {};
  for (const r of results) out[r.broker] = r;
  return out;
}

/**
 * Same fetches as scrapeAllBrokers, kicked off together -- but returns each
 * broker's own Promise instead of one combined Promise.all. Lets a caller
 * await just the broker it needs right now (FPS, for the fast path to the
 * selection modal) while the rest keep running independently in the
 * background. scrapeAllBrokers is left as-is for phase1-orchestrator.ts,
 * which genuinely wants to wait for everything.
 */
export function scrapeBrokersConcurrently(
  input: QuickScanInput,
  timeoutMs = DEFAULT_SCRAPE_TIMEOUT_MS,
  brokers?: BrokerName[],
): Record<string, Promise<ScrapeResult>> {
  const specs = brokers ? BROKERS.filter((b) => brokers.includes(b.broker)) : BROKERS;
  const out: Record<string, Promise<ScrapeResult>> = {};
  for (const spec of specs) out[spec.broker] = scrapeOne(spec, input, timeoutMs);
  return out;
}
