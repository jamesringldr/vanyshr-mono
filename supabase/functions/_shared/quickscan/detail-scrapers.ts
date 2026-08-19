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
}

export interface DetailRelation {
  name: string;
  relation?: string;
  age?: number;
  address?: string;
}

/** Shape consolidateProfiles() in profile-consolidator.ts expects per broker. */
export interface BrokerDetailProfile {
  fullName?: string;
  age?: number;
  primaryAddress?: DetailAddress;
  previousAddresses?: DetailAddress[];
  phoneNumbers?: string[];
  emails?: string[];
  relatives?: DetailRelation[];
  associates?: DetailRelation[];
  properties?: never[]; // none of the current parsers extract real property/asset records
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

export function parseFpsDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(html) as unknown as El;
  if (!doc) return {};

  const fullName =
    textOf(doc.querySelector("#full_name_section .fullname")) ||
    textOf(doc.querySelector("h1#details-header"));
  if (!fullName) return {};

  const ageMatch = textOf(doc.querySelector("#age-header")).match(/Age\s+(\d+)/i);
  const age = ageMatch ? parseInt(ageMatch[1], 10) : undefined;

  const phoneNumbers: string[] = [];
  for (const dl of doc.querySelectorAll("#phone_number_section .detail-box-phone dl")) {
    const number = textOf(dl.querySelector("dt a"));
    if (number.replace(/\D/g, "").length >= 10) phoneNumbers.push(number);
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
    previousAddresses.push(
      csMatch
        ? addrFromParts(csMatch[1].trim(), csMatch[2].trim(), csMatch[3], csMatch[4], text)
        : { formatted: text },
    );
  }

  const relatives: DetailRelation[] = [];
  for (const dl of doc.querySelectorAll("#relative-links dl")) {
    const name = textOf(dl.querySelector("dt a"));
    if (!name || name.length < 3) continue;
    const ageDd = textOf(dl.querySelector("dd"));
    const relAgeMatch = ageDd.match(/Age\s+(\d+)/i);
    relatives.push({ name, relation: "family", age: relAgeMatch ? parseInt(relAgeMatch[1], 10) : undefined });
  }

  return { fullName, age, primaryAddress, previousAddresses, phoneNumbers, emails, relatives, associates: [] };
}

// ---------------------------------------------------------------------------
// AnyWho — ported from AnyWhoScraper.parseDetailFromHtml
// ---------------------------------------------------------------------------

export function parseAnywhoDetail(html: string): BrokerDetailProfile {
  const doc = parseDoc(html) as unknown as El;
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
  const phonesSection = doc.querySelector("#phones");
  if (phonesSection) {
    for (const item of phonesSection.querySelectorAll(".show-more-item")) {
      const blurSpan = item.querySelector("span[data-content]");
      if (!blurSpan) continue;
      const visibleSpan = (blurSpan as unknown as { previousElementSibling?: El }).previousElementSibling;
      const visibleText = textOf(visibleSpan as El | undefined);
      const hiddenDigits = blurSpan.getAttribute("data-content") || "";
      const fullNumber = visibleText + hiddenDigits;
      if (fullNumber.replace(/\D/g, "").length >= 10) phoneNumbers.push(fullNumber);
    }
  }

  const emails: string[] = [];
  const emailPattern = /\b([a-zA-Z0-9*._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4})\b/g;
  const emailsSection = doc.querySelector("#emails");
  const emailSource = emailsSection ? textOf(emailsSection) : bodyText;
  for (const match of emailSource.matchAll(emailPattern)) {
    const email = match[1].toLowerCase();
    if (!email.includes("anywho") && !email.includes("example")) emails.push(email);
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
      if (isCurrent && !primaryAddress) primaryAddress = addr;
      else previousAddresses.push(addr);
      first = false;
    }
  }

  const relatives: DetailRelation[] = [];
  const relativePattern = /Relative\s+data\s+re\s*s?\s*ult[:\s]+([A-Za-z\s]+?)\s*(Female|Male)\s*[•·\-]\s*(\d+)/gi;
  for (const match of bodyText.matchAll(relativePattern)) {
    relatives.push({ name: match[1].trim(), relation: "family", age: parseInt(match[3], 10) });
  }

  return { fullName, age, primaryAddress, previousAddresses, phoneNumbers, emails, relatives, associates: [] };
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
