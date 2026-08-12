/**
 * Context.dev broker fetchers — FPS / NPD / AnyWho
 * Fetch HTML via Context.dev, parse with deno_dom → SummaryResult[]
 */

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";
import { BrokerName, QuickScanInput, ScrapeResult, SummaryResult } from "./quickscan-phase1-phase2-models.ts";
import { scrapeHtmlViaContextDev } from "./context-dev-client.ts";

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

const MAX_SUMMARIES = 8;

function slug(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function parseAgeFromText(text: string): number | undefined {
  const match = text.match(/(?:Age|age)\s*:?\s*(\d{1,3})/);
  if (!match) return undefined;
  const age = parseInt(match[1], 10);
  return age > 0 && age < 150 ? age : undefined;
}

function absoluteUrl(href: string, base: string): string {
  if (!href) return "";
  if (href.startsWith("http")) return href;
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseDocument(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}

function extractJsonLdPeople(html: string): Array<Record<string, unknown>> {
  const people: Array<Record<string, unknown>> = [];
  const scriptRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRe.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1].trim()) as unknown;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const obj = item as Record<string, unknown>;
        if (obj["@type"] === "Person") {
          people.push(obj);
        } else if (obj["@type"] === "ItemList" && Array.isArray(obj.itemListElement)) {
          for (const el of obj.itemListElement as unknown[]) {
            if (!el || typeof el !== "object") continue;
            const entry = el as Record<string, unknown>;
            const person = (entry.item ?? entry) as Record<string, unknown>;
            if (person["@type"] === "Person") people.push(person);
          }
        }
      }
    } catch {
      // ignore bad JSON-LD blocks
    }
  }
  return people;
}

function addressFromPersonJsonLd(person: Record<string, unknown>): string {
  const home = person.HomeLocation ?? person.address ?? person.homeLocation;
  const locs = Array.isArray(home) ? home : home ? [home] : [];
  for (const loc of locs) {
    if (!loc || typeof loc !== "object") continue;
    const addr = ((loc as Record<string, unknown>).address ?? loc) as Record<string, unknown>;
    if (typeof addr === "string") return addr;
    const city = String(addr.addressLocality ?? "").trim();
    const state = String(addr.addressRegion ?? "").trim();
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
  }
  return "";
}

function ageFromPersonJsonLd(person: Record<string, unknown>): number | undefined {
  const birth = person.birthDate;
  if (typeof birth === "number") {
    const age = new Date().getFullYear() - birth;
    return age > 0 && age < 150 ? age : undefined;
  }
  if (typeof birth === "string") {
    const year = parseInt(birth.slice(0, 4), 10);
    if (Number.isFinite(year) && year > 1900) {
      const age = new Date().getFullYear() - year;
      return age > 0 && age < 150 ? age : undefined;
    }
  }
  return undefined;
}

// ─── URL builders ───────────────────────────────────────────────────────────

export function buildFpsSearchUrl(input: QuickScanInput): string {
  const first = slug(input.first_name);
  const last = slug(input.last_name);
  const city = slug(input.city || "unknown");
  const state = slug(input.state);
  return `https://www.fastpeoplesearch.com/name/${first}-${last}_${city}-${state}`;
}

export function buildNpdSearchUrl(input: QuickScanInput): string {
  const first = input.first_name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const last = input.last_name.trim().replace(/\b\w/g, (c) => c.toUpperCase());
  const state = input.state.trim().toUpperCase().slice(0, 2);
  const city = (input.city || "").trim().replace(/\b\w/g, (c) => c.toUpperCase()) || "Unknown";
  const letter = last.charAt(0).toUpperCase();
  return `https://www.nationalpublicdata.com/people/${letter}/${first}-${last}/${state}/${city}`;
}

export function buildAnyWhoSearchUrl(input: QuickScanInput): string {
  const firstPart = input.first_name.trim().toLowerCase().replace(/\s+/g, "+");
  const lastPart = input.last_name.trim().toLowerCase().replace(/\s+/g, "+");
  const stateName = STATE_NAMES[input.state.toUpperCase()] || slug(input.state);
  let url = `https://www.anywho.com/people/${firstPart}+${lastPart}/${stateName}`;
  if (input.city) {
    url += `/${slug(input.city)}`;
  }
  return url;
}

// ─── Parsers ────────────────────────────────────────────────────────────────

export function parseFpsSummaries(html: string): SummaryResult[] {
  const doc = parseDocument(html);
  const results: SummaryResult[] = [];
  if (!doc) return results;

  const cards = Array.from(doc.querySelectorAll("div.card-block"));
  for (const card of cards) {
    const nameEl = card.querySelector("h3.card-title a span.larger");
    const name = nameEl?.textContent?.trim() || "";
    if (!name || name.length < 2) continue;

    const grey = card.querySelector("h3.card-title a span.grey")?.textContent?.trim() || "";
    const age = parseAgeFromText(grey);
    let address = "";
    if (grey.includes("•")) {
      address = grey.split("•").slice(1).join("•").trim();
    }
    if (!address) {
      const addrLink = card.querySelector('a[href*="/address/"]');
      address = addrLink?.textContent?.trim() || "";
    }

    const profileHref = card.querySelector("h3.card-title a")?.getAttribute("href") || "";
    results.push({
      broker: BrokerName.FPS,
      full_name: name,
      address,
      age_range: age != null ? String(age) : "",
      age,
      location: address,
      profile_url: absoluteUrl(profileHref, "https://www.fastpeoplesearch.com"),
    });
    if (results.length >= MAX_SUMMARIES) break;
  }

  if (results.length === 0) {
    for (const person of extractJsonLdPeople(html)) {
      const name = String(person.name ?? "").trim();
      if (!name) continue;
      const address = addressFromPersonJsonLd(person);
      const age = ageFromPersonJsonLd(person);
      results.push({
        broker: BrokerName.FPS,
        full_name: name,
        address,
        age_range: age != null ? String(age) : "",
        age,
        location: address,
        profile_url: String(person.url ?? person["@id"] ?? ""),
      });
      if (results.length >= MAX_SUMMARIES) break;
    }
  }

  return results;
}

export function parseNpdSummaries(html: string): SummaryResult[] {
  const results: SummaryResult[] = [];

  for (const person of extractJsonLdPeople(html)) {
    const name = String(person.name ?? "").trim();
    if (!name) continue;
    const address = addressFromPersonJsonLd(person);
    const age = ageFromPersonJsonLd(person);
    results.push({
      broker: BrokerName.NPD,
      full_name: name,
      address,
      age_range: age != null ? String(age) : "",
      age,
      location: address,
      profile_url: String(person.url ?? person["@id"] ?? ""),
    });
    if (results.length >= MAX_SUMMARIES) break;
  }

  if (results.length > 0) return results;

  // Fallback: profile links on search page
  const doc = parseDocument(html);
  if (!doc) return results;
  const links = Array.from(doc.querySelectorAll('a[href*="/people/"]'));
  const seen = new Set<string>();
  for (const link of links) {
    const name = link.textContent?.trim() || "";
    const href = link.getAttribute("href") || "";
    if (!name || name.split(/\s+/).length < 2) continue;
    if (/summary|numbers|faq|filter|find people/i.test(name)) continue;
    if (seen.has(name)) continue;
    seen.add(name);
    results.push({
      broker: BrokerName.NPD,
      full_name: name,
      address: "",
      age_range: "",
      location: "",
      profile_url: absoluteUrl(href, "https://www.nationalpublicdata.com"),
    });
    if (results.length >= MAX_SUMMARIES) break;
  }

  return results;
}

export function parseAnyWhoSummaries(html: string, firstName: string, lastName: string): SummaryResult[] {
  const doc = parseDocument(html);
  const results: SummaryResult[] = [];
  if (!doc) return results;

  const h2Elements = Array.from(doc.querySelectorAll("h2"));
  const seen = new Set<string>();

  for (const h2 of h2Elements) {
    const name = h2.textContent?.trim() || "";
    if (!name || name.split(/\s+/).length < 2) continue;
    if (/summary|numbers|faq|filter|area code|find people/i.test(name)) continue;
    if (!/^[A-Za-z\s\-']+$/.test(name)) continue;
    if (
      !name.toLowerCase().includes(firstName.toLowerCase()) &&
      !name.toLowerCase().includes(lastName.toLowerCase())
    ) {
      continue;
    }
    if (seen.has(name)) continue;
    seen.add(name);

    let parent = h2.parentElement;
    let cardText = "";
    for (let i = 0; i < 5 && parent; i++) {
      const text = parent.textContent || "";
      if (text.includes("Lives in:") || text.includes("Age")) {
        cardText = text;
        break;
      }
      parent = parent.parentElement;
    }
    if (!cardText) {
      // Collect sibling text until next h2
      let sibling = h2.nextElementSibling;
      const chunks: string[] = [name];
      for (let i = 0; i < 40 && sibling; i++) {
        if (sibling.tagName === "H2") break;
        chunks.push(sibling.textContent || "");
        sibling = sibling.nextElementSibling;
      }
      cardText = chunks.join("\n");
    }

    const age = parseAgeFromText(cardText);
    let address = "";
    const livesIn = cardText.match(/Lives in:\s*([^\n]+)/i);
    if (livesIn) {
      address = livesIn[1].trim();
    } else {
      const cityState = cardText.match(/([A-Za-z .'-]+,\s*[A-Z]{2}(?:\s+\d{5})?)/);
      if (cityState) address = cityState[1].trim();
    }

    let profileUrl = "";
    const nameLink = h2.querySelector("a");
    if (nameLink) {
      profileUrl = absoluteUrl(nameLink.getAttribute("href") || "", "https://www.anywho.com");
    } else if (h2.parentElement) {
      const parentLink = h2.parentElement.querySelector("a[href*='/people/']");
      if (parentLink) {
        profileUrl = absoluteUrl(parentLink.getAttribute("href") || "", "https://www.anywho.com");
      }
    }

    results.push({
      broker: BrokerName.ANYWHO,
      full_name: name,
      address,
      age_range: age != null ? String(age) : "",
      age,
      location: address,
      profile_url: profileUrl,
    });
    if (results.length >= MAX_SUMMARIES) break;
  }

  return results;
}

// ─── Fetch wrappers ─────────────────────────────────────────────────────────

async function scrapeBroker(
  broker: BrokerName,
  input: QuickScanInput,
  buildUrl: (input: QuickScanInput) => string,
  parse: (html: string) => SummaryResult[],
  timeoutMs: number,
): Promise<ScrapeResult> {
  const start = Date.now();
  try {
    if (!input.city && (broker === BrokerName.FPS || broker === BrokerName.NPD)) {
      throw new Error(`City required for ${broker} Context.dev search`);
    }
    const url = buildUrl(input);
    console.log(`🌐 Context.dev ${broker}: ${url}`);
    const { html } = await scrapeHtmlViaContextDev(url, { timeoutMs });
    const summaries = parse(html);
    const timing_ms = Date.now() - start;
    console.log(`✓ Context.dev ${broker}: ${summaries.length} summaries in ${timing_ms}ms`);
    return {
      broker,
      summaries,
      status: summaries.length > 0 ? "success" : "no_results",
      timing_ms,
    };
  } catch (error) {
    const timing_ms = Date.now() - start;
    const message = (error as Error).message;
    console.error(`✗ Context.dev ${broker}: ${message}`);
    return {
      broker,
      summaries: [],
      status: "failed",
      error: message,
      timing_ms,
    };
  }
}

export async function searchFpsViaContextDev(
  input: QuickScanInput,
  timeoutMs = 45000,
): Promise<ScrapeResult> {
  return scrapeBroker(BrokerName.FPS, input, buildFpsSearchUrl, parseFpsSummaries, timeoutMs);
}

export async function searchNpdViaContextDev(
  input: QuickScanInput,
  timeoutMs = 45000,
): Promise<ScrapeResult> {
  return scrapeBroker(BrokerName.NPD, input, buildNpdSearchUrl, parseNpdSummaries, timeoutMs);
}

export async function searchAnyWhoViaContextDev(
  input: QuickScanInput,
  timeoutMs = 45000,
): Promise<ScrapeResult> {
  return scrapeBroker(
    BrokerName.ANYWHO,
    input,
    buildAnyWhoSearchUrl,
    (html) => parseAnyWhoSummaries(html, input.first_name, input.last_name),
    timeoutMs,
  );
}
