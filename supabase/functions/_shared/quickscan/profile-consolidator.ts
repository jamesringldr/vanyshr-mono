/**
 * Profile Consolidator
 * Merges profile data from multiple brokers into a single unified profile
 * Deduplicates addresses, phones, emails, and consolidates enrichment data
 */

import { ConsolidatedProfile, ContactInfo, PersonRelation, PropertyRecord, BreachRecord } from "./quickscan-phase1-phase2-models.ts";

/**
 * Address similarity threshold (0-1)
 */
const ADDRESS_SIMILARITY_THRESHOLD = 0.7;

/**
 * Phone number normalization and deduplication
 */
function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If US number (10+ digits), take last 10
  if (digits.length >= 10) {
    return digits.slice(-10);
  }

  return digits;
}

/**
 * Calculate string similarity (0-1)
 * Using simple token-based comparison
 */
function stringSimilarity(s1: string, s2: string): number {
  if (!s1 || !s2) return 0;

  s1 = s1.toLowerCase().trim();
  s2 = s2.toLowerCase().trim();

  // Exact match
  if (s1 === s2) return 1.0;

  // Split into tokens
  const tokens1 = new Set(s1.split(/\s+/));
  const tokens2 = new Set(s2.split(/\s+/));

  // Calculate Jaccard similarity
  const intersection = new Set([...tokens1].filter((x) => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Deduplicate addresses
 * @param addresses Array of address objects
 * @returns Deduplicated addresses
 */
function deduplicateAddresses(addresses: ContactInfo[]): ContactInfo[] {
  const deduped: ContactInfo[] = [];

  for (const addr of addresses) {
    let found = false;

    for (const existing of deduped) {
      const similarity = stringSimilarity(
        `${addr.street} ${addr.city} ${addr.state}`.trim(),
        `${existing.street} ${existing.city} ${existing.state}`.trim()
      );

      if (similarity >= ADDRESS_SIMILARITY_THRESHOLD) {
        found = true;
        break;
      }
    }

    if (!found) {
      deduped.push(addr);
    }
  }

  return deduped;
}

/**
 * Deduplicate phone numbers
 * @param phones Array of phone numbers
 * @returns Deduplicated phone numbers
 */
function deduplicatePhones(phones: string[]): string[] {
  const normalizedPhones = new Set<string>();

  for (const phone of phones) {
    const normalized = normalizePhone(phone);
    if (normalized.length > 0) {
      normalizedPhones.add(normalized);
    }
  }

  return Array.from(normalizedPhones).sort();
}

/**
 * Deduplicate emails
 * @param emails Array of emails
 * @returns Deduplicated emails
 */
function deduplicateEmails(emails: string[]): string[] {
  const uniqueEmails = new Set<string>();

  for (const email of emails) {
    if (email && typeof email === "string") {
      uniqueEmails.add(email.toLowerCase().trim());
    }
  }

  return Array.from(uniqueEmails).sort();
}

/**
 * Deduplicate relatives/associates
 * @param relations Array of person relations
 * @returns Deduplicated relations
 */
function deduplicateRelations(relations: PersonRelation[]): PersonRelation[] {
  const seen = new Set<string>();
  const deduped: PersonRelation[] = [];

  for (const rel of relations) {
    const key = `${rel.name}|${rel.relation}|${rel.age}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(rel);
    }
  }

  return deduped;
}

/**
 * Consolidate profiles from multiple brokers
 * @param profiles Object with broker name as key and profile data as value
 * @param personId Unique person identifier
 * @param confidence Dedup confidence from Phase 1 (0-100)
 * @returns Consolidated profile
 */
export function consolidateProfiles(
  profiles: Record<string, unknown>,
  personId: string,
  confidence: number = 0.0
): ConsolidatedProfile {
  const consolidated: ConsolidatedProfile = {
    person_id: personId,
    full_name: "",
    previous_addresses: [],
    phone_numbers: [],
    emails: [],
    relatives: [],
    associates: [],
    properties: [],
    services_found: [],
    breaches: [],
    raw_profiles: profiles,
    confidence: confidence,
    sources: Object.keys(profiles),
    metadata: {},
  };

  // Collect all data from all profiles
  const allAddresses: ContactInfo[] = [];
  const allPhones: string[] = [];
  const allEmails: string[] = [];
  const allRelatives: PersonRelation[] = [];
  const allAssociates: PersonRelation[] = [];
  const allProperties: PropertyRecord[] = [];
  const allAges: number[] = [];

  for (const [broker, profile] of Object.entries(profiles)) {
    if (!profile || typeof profile !== "object") {
      continue;
    }

    const p = profile as Record<string, unknown>;

    // Extract name (use first one found)
    if (!consolidated.full_name && p.fullName) {
      consolidated.full_name = String(p.fullName);
    } else if (!consolidated.full_name && p.full_name) {
      consolidated.full_name = String(p.full_name);
    }

    // Extract age
    if (p.age && typeof p.age === "number") {
      allAges.push(p.age);
    }

    // Extract primary address
    if (p.primaryAddress) {
      const addr = p.primaryAddress as Record<string, unknown>;
      if (!consolidated.primary_address) {
        consolidated.primary_address = {
          formatted: String(addr.formatted || ""),
          street: addr.street ? String(addr.street) : undefined,
          city: addr.city ? String(addr.city) : undefined,
          state: addr.state ? String(addr.state) : undefined,
          zip: addr.zip ? String(addr.zip) : undefined,
          country: addr.country ? String(addr.country) : undefined,
        };
      }
    }

    // Extract previous addresses
    if (Array.isArray(p.previousAddresses)) {
      for (const addr of p.previousAddresses as unknown[]) {
        if (typeof addr === "object" && addr !== null) {
          const a = addr as Record<string, unknown>;
          allAddresses.push({
            formatted: String(a.formatted || ""),
            street: a.street ? String(a.street) : undefined,
            city: a.city ? String(a.city) : undefined,
            state: a.state ? String(a.state) : undefined,
            zip: a.zip ? String(a.zip) : undefined,
          });
        }
      }
    }

    // Extract phones
    if (Array.isArray(p.phoneNumbers)) {
      for (const phone of p.phoneNumbers as unknown[]) {
        if (typeof phone === "string") {
          allPhones.push(phone);
        }
      }
    }

    // Extract emails
    if (Array.isArray(p.emails)) {
      for (const email of p.emails as unknown[]) {
        if (typeof email === "string") {
          allEmails.push(email);
        }
      }
    }

    // Extract relatives
    if (Array.isArray(p.relatives)) {
      for (const rel of p.relatives as unknown[]) {
        if (typeof rel === "object" && rel !== null) {
          const r = rel as Record<string, unknown>;
          allRelatives.push({
            name: String(r.name || ""),
            relation: r.relation ? String(r.relation) : undefined,
            age: r.age ? (typeof r.age === "number" ? r.age : parseInt(String(r.age))) : undefined,
            address: r.address ? String(r.address) : undefined,
          });
        }
      }
    }

    // Extract associates
    if (Array.isArray(p.associates)) {
      for (const assoc of p.associates as unknown[]) {
        if (typeof assoc === "object" && assoc !== null) {
          const a = assoc as Record<string, unknown>;
          allAssociates.push({
            name: String(a.name || ""),
            relation: a.relation ? String(a.relation) : undefined,
            age: a.age ? (typeof a.age === "number" ? a.age : parseInt(String(a.age))) : undefined,
            address: a.address ? String(a.address) : undefined,
          });
        }
      }
    }

    // Extract properties
    if (Array.isArray(p.properties)) {
      for (const prop of p.properties as unknown[]) {
        if (typeof prop === "object" && prop !== null) {
          const pr = prop as Record<string, unknown>;
          const address = pr.address as Record<string, unknown> | undefined;
          allProperties.push({
            address: {
              formatted: address ? String(address.formatted || "") : "",
              street: address?.street ? String(address.street) : undefined,
              city: address?.city ? String(address.city) : undefined,
              state: address?.state ? String(address.state) : undefined,
              zip: address?.zip ? String(address.zip) : undefined,
            },
            owner_name: pr.owner_name ? String(pr.owner_name) : undefined,
            property_type: pr.property_type ? String(pr.property_type) : undefined,
            estimated_value: pr.estimated_value ? Number(pr.estimated_value) : undefined,
            purchase_date: pr.purchase_date ? String(pr.purchase_date) : undefined,
            lot_size: pr.lot_size ? String(pr.lot_size) : undefined,
          });
        }
      }
    }
  }

  // Resolve age (median)
  if (allAges.length > 0) {
    const sorted = allAges.sort((a, b) => a - b);
    consolidated.age = sorted[Math.floor(sorted.length / 2)];
  }

  // Consolidate all collected data
  consolidated.previous_addresses = deduplicateAddresses(allAddresses);
  consolidated.phone_numbers = deduplicatePhones(allPhones);
  consolidated.emails = deduplicateEmails(allEmails);
  consolidated.relatives = deduplicateRelations(allRelatives);
  consolidated.associates = deduplicateRelations(allAssociates);
  consolidated.properties = allProperties.slice(0, 10); // Limit to 10 properties

  return consolidated;
}

/**
 * Add enrichment data to consolidated profile
 * @param profile Consolidated profile
 * @param services Services found via Holehe
 * @param breaches Breaches found via Leakcheck
 * @returns Updated profile
 */
export function addEnrichmentData(
  profile: ConsolidatedProfile,
  services: string[] = [],
  breaches: BreachRecord[] = []
): ConsolidatedProfile {
  profile.services_found = deduplicatePhones(services); // Reuse dedup logic
  profile.breaches = breaches;

  return profile;
}

/**
 * Generate summary statistics for a consolidated profile
 * @param profile Consolidated profile
 * @returns Summary statistics
 */
export function getProfileSummary(profile: ConsolidatedProfile) {
  return {
    person_id: profile.person_id,
    name: profile.full_name,
    age: profile.age,
    sources: profile.sources.length,
    phone_numbers: profile.phone_numbers.length,
    emails: profile.emails.length,
    addresses: 1 + profile.previous_addresses.length,
    relatives: profile.relatives.length,
    associates: profile.associates.length,
    properties: profile.properties.length,
    services: profile.services_found.length,
    breaches: profile.breaches.length,
    confidence: profile.confidence,
    data_completeness: calculateDataCompleteness(profile),
  };
}

/**
 * Calculate data completeness score (0-100)
 * @param profile Consolidated profile
 * @returns Completeness percentage
 */
function calculateDataCompleteness(profile: ConsolidatedProfile): number {
  let score = 0;
  let total = 0;

  // Name (20 points)
  total += 20;
  if (profile.full_name) score += 20;

  // Age (10 points)
  total += 10;
  if (profile.age) score += 10;

  // Address (20 points)
  total += 20;
  if (profile.primary_address?.formatted) score += 20;

  // Contact info (20 points)
  total += 20;
  if (profile.phone_numbers.length > 0 || profile.emails.length > 0) score += 20;

  // Relations (10 points)
  total += 10;
  if (profile.relatives.length > 0 || profile.associates.length > 0) score += 10;

  // Enrichment (10 points)
  total += 10;
  if (profile.services_found.length > 0 || profile.breaches.length > 0) score += 10;

  return Math.round((score / total) * 100);
}
