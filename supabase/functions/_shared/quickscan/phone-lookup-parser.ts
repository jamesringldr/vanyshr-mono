/**
 * Phone-page parsers for reversephonelookup.com (primary) and zabasearch.com
 * (fallback). Fetch is context.dev; parse is local.
 *
 * RPL (live 2026-08-27, /number/{10 digits}/):
 *   - JSON-LD Person (name, alias, birth year, phones, masked emails)
 *   - JSON-LD FAQPage (age, last-known address, relatives, job, school)
 *   - Visible "Owner Information" h3 (name + address) and
 *     "Phone Number Information" labeled <li> (line type, carrier, coverage)
 *
 * Zaba phone pages still use the older Intelius #result-top-content template.
 */

import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

export type PhoneLookupSource = "rpl" | "zaba";

export type PhoneLookupResult = {
  phone: string;
  source: PhoneLookupSource;
  source_url: string;
  name: string | null;
  age: string | null;
  birth_year: string | null;
  line_type: string | null;
  carrier: string | null;
  location: string | null;
  time_zone: string | null;
  aliases: string[];
  related_persons: Array<{ name: string; href: string }>;
  most_recent_address: string | null;
  previous_addresses: string[];
  email_domains: string[];
  previous_phones: string[];
  social_media: string[];
  jobs: string[];
  education: string[];
  professional_licenses: string[];
};

export type PhoneParseOutcome = {
  result: PhoneLookupResult;
  found: boolean;
};

type El = {
  nodeName: string;
  textContent: string | null;
  innerHTML?: string;
  parentElement: El | null;
  getAttribute: (name: string) => string | null;
  querySelector: (sel: string) => El | null;
  querySelectorAll: (sel: string) => El[];
};

const NA = /^(n\/?a|none|unknown|-)$/i;

function parseDoc(html: string): El | null {
  return new DOMParser().parseFromString(html, "text/html") as unknown as El | null;
}

function textOf(el: El | null | undefined): string {
  return (el?.textContent || "").replace(/\s+/g, " ").trim();
}

function titleCaseName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

function isBlank(value: string | null | undefined): boolean {
  return !value || NA.test(value.trim());
}

function pushUnique(list: string[], value: string): void {
  const v = value.replace(/\s+/g, " ").trim();
  if (!v || isBlank(v) || list.includes(v)) return;
  list.push(v);
}

function emailDomain(email: string): string | null {
  const at = email.lastIndexOf("@");
  if (at < 0) return null;
  const domain = email.slice(at).toLowerCase().trim();
  if (!/^@[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return null;
  return domain;
}

function digitsOf(value: string): string {
  return value.replace(/\D/g, "");
}

function formatUsPhone(digits: string): string | null {
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function carrierDisplay(raw: string): string {
  const paren = raw.match(/\(([^)]+)\)/);
  const chosen = (paren?.[1] || raw).replace(/\s+/g, " ").trim();
  return chosen.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function emptyPhoneResult(
  phone: string,
  sourceUrl: string,
  source: PhoneLookupSource,
): PhoneLookupResult {
  return {
    phone,
    source,
    source_url: sourceUrl,
    name: null,
    age: null,
    birth_year: null,
    line_type: null,
    carrier: null,
    location: null,
    time_zone: null,
    aliases: [],
    related_persons: [],
    most_recent_address: null,
    previous_addresses: [],
    email_domains: [],
    jobs: [],
    education: [],
    social_media: [],
    previous_phones: [],
    professional_licenses: [],
  };
}

export function buildRplUrl(phone: string): string {
  return `https://www.reversephonelookup.com/number/${phone}/`;
}

export function buildZabaPhoneUrl(phone: string): string {
  const formatted = `${phone.slice(0, 3)}-${phone.slice(3, 6)}-${phone.slice(6)}`;
  return `https://www.zabasearch.com/phone/${formatted}`;
}

function parseJsonLd(doc: El): unknown[] {
  const blocks: unknown[] = [];
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const raw = (script.textContent || "").trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // Live RPL pages sometimes emit a leading space; JSON.parse still works
      // on valid JSON. Malformed blocks are skipped.
    }
  }
  return blocks;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function ldType(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return "";
  const t = rec["@type"];
  if (typeof t === "string") return t;
  if (Array.isArray(t)) return t.map(String).join(" ");
  return "";
}

function stringVal(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  return "";
}

function stringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(stringVal).filter(Boolean);
  const one = stringVal(value);
  return one ? [one] : [];
}

function applyPersonLd(result: PhoneLookupResult, person: Record<string, unknown>): void {
  const name = stringVal(person.name);
  if (name && !result.name) result.name = name;

  for (const alias of stringList(person.alternateName)) {
    if (alias.toLowerCase() !== (result.name || "").toLowerCase()) {
      pushUnique(result.aliases, alias);
    }
  }

  const birth = stringVal(person.birthDate);
  const year = birth.match(/\d{4}/);
  if (year && !result.birth_year) result.birth_year = year[0];

  for (const tel of stringList(person.telephone)) {
    const formatted = formatUsPhone(digitsOf(tel));
    if (!formatted) continue;
    if (digitsOf(formatted) === result.phone) continue;
    pushUnique(result.previous_phones, formatted);
  }

  for (const email of stringList(person.email)) {
    const domain = emailDomain(email);
    if (domain) pushUnique(result.email_domains, domain);
  }
}

function applyFaqLd(result: PhoneLookupResult, faq: Record<string, unknown>): void {
  const entities = Array.isArray(faq.mainEntity) ? faq.mainEntity : [];
  for (const entity of entities) {
    const rec = asRecord(entity);
    if (!rec) continue;
    const question = stringVal(rec.name).toLowerCase();
    const answer = stringVal(asRecord(rec.acceptedAnswer)?.text);
    if (!answer) continue;

    if (question.includes("how old") && !result.age) {
      const age = answer.match(/(\d+)\s+years?\s+old/i);
      if (age) result.age = age[1];
      const born = answer.match(/born in ([A-Za-z]+ \d{4}|\d{4})/i);
      if (born && !result.birth_year) {
        const year = born[1].match(/\d{4}/);
        if (year) result.birth_year = year[0];
      }
    }

    if ((question.includes("where does") || question.includes("live")) && !result.most_recent_address) {
      const loc = answer.match(/last known one is\s+(.+?)\.?\s*$/i);
      if (loc) result.most_recent_address = loc[1].trim();
    }

    if (question.includes("related")) {
      const names = answer.match(/relatives include\s+(.+?)\.?\s*$/i);
      if (names) {
        for (const name of names[1].split(",")) {
          const trimmed = name.replace(/\band\b/gi, " ").trim();
          if (trimmed) {
            result.related_persons.push({ name: trimmed, href: "" });
          }
        }
      }
    }

    if (question.includes("living") || question.includes("do for a living")) {
      const job = answer.match(/could be an?\s+(.+?)(?:\s+and might|\.|$)/i);
      if (job) pushUnique(result.jobs, job[1].trim());
    }

    if (question.includes("school") || question.includes("go to school")) {
      const school = answer.match(/attended\s+(.+?)(?:\s+where|\.|$)/i);
      if (school) pushUnique(result.education, school[1].trim());
    }
  }
}

function applyRplDom(result: PhoneLookupResult, doc: El): boolean {
  let sawResult = false;
  const h1 = textOf(doc.querySelector("h1"));
  if (/results found for/i.test(h1)) sawResult = true;

  const headings = doc.querySelectorAll("h2");
  for (const h2 of headings) {
    const label = textOf(h2).toLowerCase();
    if (label.includes("owner information")) {
      const ownerH3 = h2.parentElement?.querySelector("h3") ?? null;
      if (ownerH3) {
        const span = ownerH3.querySelector("span");
        const full = textOf(ownerH3);
        const address = textOf(span);
        const name = address && full.endsWith(address)
          ? full.slice(0, full.length - address.length).trim()
          : full;
        if (name && !result.name) result.name = titleCaseName(name);
        if (address && !result.most_recent_address) result.most_recent_address = address;
        if (name) sawResult = true;
      }
    }
  }

  for (const li of doc.querySelectorAll("ul.column2 li, ul.nolist li")) {
    const raw = textOf(li);
    const split = raw.match(/^([^:]+):\s*(.+)$/);
    if (!split) continue;
    const key = split[1].trim().toLowerCase();
    const value = split[2].trim();
    if (isBlank(value)) continue;
    if (key.includes("service type") && !result.line_type) {
      result.line_type = value;
    } else if (key.includes("carrier") && !result.carrier) {
      result.carrier = carrierDisplay(value);
    } else if (key.includes("coverage area") && !result.location) {
      result.location = titleCaseName(value);
    }
  }

  if (!result.location && result.most_recent_address) {
    const cityState = result.most_recent_address.match(/,\s*([^,]+,\s*[A-Za-z]{2})\b/);
    if (cityState) result.location = cityState[1].trim();
  }

  return sawResult;
}

function mapInteliusField(result: PhoneLookupResult, key: string, value: string | null): void {
  if (!value || isBlank(value)) return;
  switch (key) {
    case "age":
      if (!result.age) result.age = value;
      break;
    case "birth year":
      if (!result.birth_year) result.birth_year = value;
      break;
    case "line type":
      if (!result.line_type) result.line_type = value;
      break;
    case "carrier":
      if (!result.carrier) result.carrier = value;
      break;
    case "location":
      if (!result.location) result.location = value;
      break;
    case "time zone":
      if (!result.time_zone) result.time_zone = value;
      break;
  }
}

function applyInteliusTemplate(result: PhoneLookupResult, doc: El): boolean {
  const top = doc.querySelector("#result-top-content");
  if (!top) return false;

  const h3 = top.querySelector("h3");
  if (h3 && !result.name) result.name = textOf(h3) || null;

  const keys = Array.from(top.querySelectorAll("th")).map((th) => textOf(th).toLowerCase()).filter(Boolean);
  const values = Array.from(top.querySelectorAll("td")).map((td) => textOf(td));
  for (let i = 0; i < keys.length; i++) {
    mapInteliusField(result, keys[i] ?? "", values[i] ?? null);
  }

  for (const li of doc.querySelectorAll("#phone-number-names ul li")) {
    pushUnique(result.aliases, textOf(li));
  }

  for (const a of doc.querySelectorAll("#phone-number-related ul li a")) {
    const name = textOf(a);
    if (name) result.related_persons.push({ name, href: a.getAttribute("href") || "" });
  }

  let locationCtx: "most-recent" | "previous" | null = null;
  const locRoot = doc.querySelector("#phone-number-locations");
  if (locRoot) {
    for (const child of locRoot.querySelectorAll("h5, li")) {
      const tag = (child.nodeName || "").toLowerCase();
      if (tag === "h5") {
        const t = textOf(child).toLowerCase();
        locationCtx = t.includes("most recent") ? "most-recent"
          : t.includes("previous") ? "previous"
          : null;
        continue;
      }
      const t = textOf(child);
      if (!t) continue;
      if (locationCtx === "most-recent" && !result.most_recent_address) {
        result.most_recent_address = t;
      } else if (locationCtx === "previous") {
        pushUnique(result.previous_addresses, t);
      }
    }
  }

  for (const li of doc.querySelectorAll("#phone-number-previous ul li")) {
    pushUnique(result.previous_phones, textOf(li));
  }
  for (const li of doc.querySelectorAll("#phone-number-socialmedia ul li")) {
    pushUnique(result.social_media, textOf(li));
  }
  for (const li of doc.querySelectorAll("#phone-number-jobs ul li")) {
    pushUnique(result.jobs, textOf(li));
  }
  for (const li of doc.querySelectorAll("#phone-number-education ul li")) {
    pushUnique(result.education, textOf(li));
  }
  for (const li of doc.querySelectorAll("#phone-number-licenses ul li")) {
    pushUnique(result.professional_licenses, textOf(li));
  }

  return true;
}

export function parsePhoneLookupHtml(
  html: string,
  phone: string,
  sourceUrl: string,
  source: PhoneLookupSource,
): PhoneParseOutcome {
  const result = emptyPhoneResult(phone, sourceUrl, source);
  const doc = parseDoc(html);
  if (!doc) return { result, found: false };

  let found = false;

  if (source === "rpl" || /reversephonelookup\.com/i.test(sourceUrl)) {
    found = applyRplDom(result, doc) || found;
  }

  for (const block of parseJsonLd(doc)) {
    const rec = asRecord(block);
    if (!rec) continue;
    const type = ldType(rec).toLowerCase();
    if (type.includes("person")) {
      applyPersonLd(result, rec);
      found = true;
    }
    if (type.includes("faqpage")) {
      applyFaqLd(result, rec);
    }
  }

  found = applyInteliusTemplate(result, doc) || found;

  if (!found && result.name) found = true;
  return { result, found };
}
