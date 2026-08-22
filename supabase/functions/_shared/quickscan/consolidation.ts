/**
 * Full-profile-stage consolidation: normalize + dedup candidate values into
 * quickscan.{phones,addresses,relatives,aliases,emails}, then roll the
 * canonical rows up into quickscan.consolidated_profile.
 *
 * Called only from the full-profile-scan step (post-selection), never from
 * summary-scan — writing per-type rows for every match-time candidate would
 * put a rejected/wrong-person's data in a real user's rollup.
 */
import { normalizeEmail, isValidEmail } from "./email-extractor.ts";
import { parseAddress } from "./address-parser.ts";
import type { BrokerDetailProfile } from "./detail-scrapers.ts";
import type { SummaryResult } from "./quickscan-phase1-phase2-models.ts";

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * street|city|state via the existing component parser (suffix-canonicalized,
 * state resolved to a 2-letter code) — not a raw string strip. Zip is
 * deliberately excluded: brokers disagree on whether they include it at all
 * for the same real address, so requiring it to match would break far more
 * pairs than it protects (confirmed against real scrape output — see
 * docs/intro-scan/journal.md).
 */
export function normalizeAddress(raw: string): string {
  const parsed = parseAddress(raw);
  if (parsed.street || parsed.city) {
    return [parsed.street, parsed.city, parsed.state].filter(Boolean).join("|");
  }
  // Parser found no structure (e.g. a lone city/state fragment) — fall back
  // to a plain strip so it still gets *some* normalized_value.
  return raw.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeName(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Format + MX-record existence. Not full mailbox deliverability (no SMTP probe). */
export async function checkMxRecord(email: string): Promise<boolean | null> {
  const domain = email.split("@")[1];
  if (!domain) return false;
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
      { headers: { accept: "application/dns-json" }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const body = await res.json() as { Answer?: unknown[] };
    return Array.isArray(body.Answer) && body.Answer.length > 0;
  } catch {
    return null; // network hiccup — don't punish the email for it
  }
}

// ---------------------------------------------------------------------------
// Generic per-type upsert: keep every raw row, link duplicates to the first
// canonical (duplicate_of IS NULL) row seen for the same normalized_value.
// ---------------------------------------------------------------------------

async function upsertTyped(
  supabase: SupabaseClient,
  table: "phones" | "addresses" | "aliases",
  quickscansId: string,
  fullProfileResultId: string,
  rawValue: string,
  normalizedValue: string,
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (!rawValue.trim() || !normalizedValue) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from(table)
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalizedValue)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("quickscan")
    .from(table)
    .insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      raw_value: rawValue.trim(),
      normalized_value: normalizedValue,
      duplicate_of: existing?.id ?? null,
      ...extra,
    });

  if (error) console.error(`✗ ${table} insert failed (scan=${quickscansId}): ${error.message}`);
}

async function upsertRelative(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  kind: "relative" | "associate",
  name: string,
  relation?: string,
  age?: number,
  gender?: string,
  birthMonth?: string,
): Promise<void> {
  const normalized = normalizeName(name);
  if (!name.trim() || !normalized) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("relatives")
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("quickscan")
    .from("relatives")
    .insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      kind,
      raw_value: name.trim(),
      normalized_value: normalized,
      relation: relation ?? null,
      age: age ?? null,
      gender: gender ?? null,
      birth_month: birthMonth ?? null,
      duplicate_of: existing?.id ?? null,
    });

  if (error) console.error(`✗ relatives insert failed (scan=${quickscansId}): ${error.message}`);
}

/**
 * employment: normalized_value keys on employer+title so the same job
 * reported by more than one broker can dedup, same idea as phones/addresses.
 */
async function upsertEmployment(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  kind: "current" | "history",
  job: { employer?: string; title?: string; since?: string; duration?: string; location?: string },
): Promise<void> {
  const rawValue = [job.title, job.employer].filter(Boolean).join(" at ").trim();
  const normalized = normalizeName([job.employer, job.title].filter(Boolean).join("|"));
  if (!rawValue || !normalized) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("employment")
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("quickscan")
    .from("employment")
    .insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      kind,
      raw_value: rawValue,
      normalized_value: normalized,
      employer: job.employer ?? null,
      title: job.title ?? null,
      since: job.since ?? null,
      duration: job.duration ?? null,
      location: job.location ?? null,
      duplicate_of: existing?.id ?? null,
    });

  if (error) console.error(`✗ employment insert failed (scan=${quickscansId}): ${error.message}`);
}

/**
 * education: normalized_value keys on school when known (FPS); falls back to
 * the normalized raw sentence when it isn't (Zaba, which publishes one
 * flowing sentence rather than separate school/degree/field values).
 */
async function upsertEducation(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  entry: { rawValue: string; school?: string; degree?: string; fieldOfStudy?: string },
): Promise<void> {
  const rawValue = entry.rawValue.trim();
  const normalized = normalizeName(entry.school || entry.rawValue);
  if (!rawValue || !normalized) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("education")
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("quickscan")
    .from("education")
    .insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      raw_value: rawValue,
      normalized_value: normalized,
      school: entry.school ?? null,
      degree: entry.degree ?? null,
      field_of_study: entry.fieldOfStudy ?? null,
      duplicate_of: existing?.id ?? null,
    });

  if (error) console.error(`✗ education insert failed (scan=${quickscansId}): ${error.message}`);
}

/**
 * properties: keyed on the address it describes (raw_value/normalized_value)
 * rather than a property identity of its own, same reasoning as employment/
 * education -- the same property could plausibly be reported by a second
 * broker for the same address later.
 */
async function upsertProperty(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  address: string,
  property: Record<string, unknown>,
): Promise<void> {
  const rawValue = address.trim();
  const normalized = normalizeAddress(address);
  if (!rawValue || !normalized) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("properties")
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .schema("quickscan")
    .from("properties")
    .insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      raw_value: rawValue,
      normalized_value: normalized,
      beds: property.beds ?? null,
      baths: property.baths ?? null,
      square_feet: property.squareFeet ?? null,
      year_built: property.yearBuilt ?? null,
      estimated_value: property.estimatedValue ?? null,
      estimated_equity: property.estimatedEquity ?? null,
      last_sale_amount: property.lastSaleAmount ?? null,
      last_sale_date: property.lastSaleDate ?? null,
      occupancy_type: property.occupancyType ?? null,
      ownership_type: property.ownershipType ?? null,
      land_use: property.landUse ?? null,
      property_class: property.propertyClass ?? null,
      subdivision: property.subdivision ?? null,
      lot_sqft: property.lotSqFt ?? null,
      duplicate_of: existing?.id ?? null,
    });

  if (error) console.error(`✗ properties insert failed (scan=${quickscansId}): ${error.message}`);
}

/** Broker-sourced only — user-added emails go through manage-emails instead. */
async function upsertBrokerEmail(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  rawValue: string,
): Promise<void> {
  const normalized = normalizeEmail(rawValue);
  if (!isValidEmail(rawValue)) return;

  const { data: existing } = await supabase
    .schema("quickscan")
    .from("emails")
    .select("id")
    .eq("quickscans_id", quickscansId)
    .eq("normalized_value", normalized)
    .is("duplicate_of", null)
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Already canonical for this quickscan — just record the extra sighting.
    const { error } = await supabase.schema("quickscan").from("emails").insert({
      quickscans_id: quickscansId,
      full_profile_result_id: fullProfileResultId,
      source: "broker",
      raw_value: rawValue.trim(),
      normalized_value: normalized,
      duplicate_of: existing.id,
    });
    if (error) console.error(`✗ emails insert failed (scan=${quickscansId}): ${error.message}`);
    return;
  }

  const mxValid = await checkMxRecord(normalized);
  const { error } = await supabase.schema("quickscan").from("emails").insert({
    quickscans_id: quickscansId,
    full_profile_result_id: fullProfileResultId,
    source: "broker",
    raw_value: rawValue.trim(),
    normalized_value: normalized,
    mx_valid: mxValid,
    confirmed: mxValid !== false, // default in unless the check actively failed
  });
  if (error) console.error(`✗ emails insert failed (scan=${quickscansId}): ${error.message}`);
}

// ---------------------------------------------------------------------------
// Per-source extraction
// ---------------------------------------------------------------------------

const DELIM = /\s*[,;|]\s*|(?:\s+and\s+)/i;

function splitList(raw?: string): string[] {
  if (!raw) return [];
  return raw.split(DELIM).map((s) => s.trim()).filter((s) => s.length > 1);
}

/** Zaba's summary IS its full profile — this runs on its SummaryResult, comma-joined fields and all. */
export async function populateFromSummaryResult(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  summary: SummaryResult,
): Promise<void> {
  for (const phone of splitList(summary.phone)) {
    await upsertTyped(supabase, "phones", quickscansId, fullProfileResultId, phone, normalizePhone(phone));
  }
  for (const email of splitList(summary.email)) {
    await upsertBrokerEmail(supabase, quickscansId, fullProfileResultId, email);
  }
  if (summary.address) {
    await upsertTyped(supabase, "addresses", quickscansId, fullProfileResultId, summary.address, normalizeAddress(summary.address), { is_current: true });
  }
  for (const addr of summary.previous_addresses?.split(";").map((s) => s.trim()).filter(Boolean) ?? []) {
    await upsertTyped(supabase, "addresses", quickscansId, fullProfileResultId, addr, normalizeAddress(addr), { is_current: false });
  }
  for (const name of splitList(summary.relatives)) {
    await upsertRelative(supabase, quickscansId, fullProfileResultId, "relative", name);
  }
  for (const name of splitList(summary.associates)) {
    await upsertRelative(supabase, quickscansId, fullProfileResultId, "associate", name);
  }
  for (const alias of splitList(summary.aliases)) {
    await upsertTyped(supabase, "aliases", quickscansId, fullProfileResultId, alias, normalizeName(alias));
  }
  // Zaba's job_history/education are semicolon-joined strings (see
  // parseZabaSummaries). job_history entries are "<title> at <employer>" --
  // the exact join populateFromSummaryResult's own upsertEmployment call
  // below re-derives, since this codebase controls both ends of that format.
  for (const entry of summary.job_history?.split(";").map((s) => s.trim()).filter(Boolean) ?? []) {
    const [title, employer] = entry.split(/\s+at\s+/);
    await upsertEmployment(supabase, quickscansId, fullProfileResultId, "history", { title, employer });
  }
  for (const entry of summary.education?.split(";").map((s) => s.trim()).filter(Boolean) ?? []) {
    await upsertEducation(supabase, quickscansId, fullProfileResultId, { rawValue: entry });
  }
}

/** FPS/NPD/AnyWho after their detail-page fetch. */
export async function populateFromBrokerDetail(
  supabase: SupabaseClient,
  quickscansId: string,
  fullProfileResultId: string,
  profile: BrokerDetailProfile,
): Promise<void> {
  for (const alias of profile.aliases ?? []) {
    await upsertTyped(supabase, "aliases", quickscansId, fullProfileResultId, alias, normalizeName(alias));
  }

  // phoneDetails is a parallel array to phoneNumbers (same order) -- matched
  // by number since that's the one value both arrays agree on.
  const phoneDetailsByNumber = new Map((profile.phoneDetails ?? []).map((d) => [d.number, d]));
  for (const phone of profile.phoneNumbers ?? []) {
    const detail = phoneDetailsByNumber.get(phone);
    await upsertTyped(supabase, "phones", quickscansId, fullProfileResultId, phone, normalizePhone(phone), {
      phone_type: detail?.type ?? null,
      carrier: detail?.carrier ?? null,
      first_reported: detail?.firstReported ?? null,
      location: detail?.location ?? null,
    });
  }

  for (const email of profile.emails ?? []) {
    await upsertBrokerEmail(supabase, quickscansId, fullProfileResultId, email);
  }
  if (profile.primaryAddress?.formatted) {
    const addr = profile.primaryAddress;
    await upsertTyped(
      supabase, "addresses", quickscansId, fullProfileResultId,
      addr.formatted, normalizeAddress(addr.formatted),
      { is_current: true, county: addr.county ?? null, recorded_date: addr.recordedDate ?? null, property_type: addr.propertyType ?? null },
    );
  }
  for (const addr of profile.previousAddresses ?? []) {
    if (!addr.formatted) continue;
    await upsertTyped(
      supabase, "addresses", quickscansId, fullProfileResultId,
      addr.formatted, normalizeAddress(addr.formatted),
      { is_current: false, county: addr.county ?? null, recorded_date: addr.recordedDate ?? null, property_type: addr.propertyType ?? null },
    );
  }
  for (const rel of profile.relatives ?? []) {
    if (rel.name) {
      await upsertRelative(supabase, quickscansId, fullProfileResultId, "relative", rel.name, rel.relation, rel.age, rel.gender, rel.birthMonth);
    }
  }
  for (const assoc of profile.associates ?? []) {
    if (assoc.name) {
      await upsertRelative(supabase, quickscansId, fullProfileResultId, "associate", assoc.name, assoc.relation, assoc.age, assoc.gender, assoc.birthMonth);
    }
  }
  for (const job of profile.employment ?? []) {
    await upsertEmployment(supabase, quickscansId, fullProfileResultId, "current", job);
  }
  for (const job of profile.jobHistory ?? []) {
    await upsertEmployment(supabase, quickscansId, fullProfileResultId, "history", job);
  }
  for (const entry of profile.education ?? []) {
    const rawValue = [entry.school, ...(entry.details ?? [])].filter(Boolean).join(", ");
    if (!rawValue) continue;
    await upsertEducation(supabase, quickscansId, fullProfileResultId, {
      rawValue,
      school: entry.school,
      degree: entry.details?.[0],
      fieldOfStudy: entry.details?.[1],
    });
  }
  // Properties describe the current address -- the only one FPS's
  // #current_property_data section is ever scoped to.
  if (profile.primaryAddress?.formatted) {
    for (const property of profile.properties ?? []) {
      await upsertProperty(supabase, quickscansId, fullProfileResultId, profile.primaryAddress.formatted, property);
    }
  }
}

// ---------------------------------------------------------------------------
// Rollup
// ---------------------------------------------------------------------------

/**
 * Rebuild consolidated_profile from the current canonical rows. name/age come
 * from the record the user actually selected (they visually confirmed that
 * card), not a cross-broker vote — the age-conflict problem is already
 * handled at match time.
 */
export async function buildConsolidatedProfile(
  supabase: SupabaseClient,
  quickscansId: string,
  matchGroupId: string | null,
  identity: { full_name?: string; age?: number },
): Promise<void> {
  const canonical = (table: string, extra: Record<string, unknown> = {}) =>
    supabase.schema("quickscan").from(table).select("*").eq("quickscans_id", quickscansId).is("duplicate_of", null).match(extra);

  const [phones, addresses, relatives, aliases, emails, employment, education, properties, fullProfileResults] = await Promise.all([
    canonical("phones"),
    canonical("addresses"),
    canonical("relatives"),
    canonical("aliases"),
    supabase.schema("quickscan").from("emails").select("*").eq("quickscans_id", quickscansId).is("duplicate_of", null).eq("confirmed", true),
    canonical("employment"),
    canonical("education"),
    canonical("properties"),
    // legal_records/birth_date live on full_profile_results itself (a
    // broker's own per-scrape facts, not per-type rows) -- not a
    // canonical()/duplicate_of query.
    supabase.schema("quickscan").from("full_profile_results").select("legal_records_county, legal_records_county_count, legal_records_nationwide_count").eq("quickscans_id", quickscansId),
  ]);

  const addrRows = (addresses.data ?? []) as { raw_value: string; is_current: boolean }[];

  // AnyWho's own estimate -- not deduped/merged across brokers, just taken
  // from whichever full_profile_results row has it (only one broker ever
  // does today).
  const legalRecordsRow = (fullProfileResults.data ?? []).find(
    (r: { legal_records_nationwide_count: number | null; legal_records_county_count: number | null }) =>
      r.legal_records_nationwide_count != null || r.legal_records_county_count != null,
  ) as { legal_records_county: string | null; legal_records_county_count: number | null; legal_records_nationwide_count: number | null } | undefined;

  const { error } = await supabase
    .schema("quickscan")
    .from("consolidated_profile")
    .upsert({
      quickscans_id: quickscansId,
      match_group_id: matchGroupId,
      full_name: identity.full_name ?? null,
      age: identity.age ?? null,
      primary_address: addrRows.find((a) => a.is_current)?.raw_value ?? null,
      previous_addresses: addrRows.filter((a) => !a.is_current).map((a) => a.raw_value),
      phones: ((phones.data ?? []) as { raw_value: string }[]).map((r) => r.raw_value),
      emails: ((emails.data ?? []) as { raw_value: string }[]).map((r) => r.raw_value),
      relatives: ((relatives.data ?? []) as { raw_value: string; relation: string | null; age: number | null }[])
        .map((r) => ({ name: r.raw_value, relation: r.relation, age: r.age })),
      aliases: ((aliases.data ?? []) as { raw_value: string }[]).map((r) => r.raw_value),
      employment: ((employment.data ?? []) as Record<string, unknown>[]).map((r) => ({
        kind: r.kind, employer: r.employer, title: r.title, since: r.since, duration: r.duration, location: r.location,
      })),
      education: ((education.data ?? []) as Record<string, unknown>[]).map((r) => ({
        school: r.school, degree: r.degree, fieldOfStudy: r.field_of_study, rawValue: r.raw_value,
      })),
      properties: ((properties.data ?? []) as Record<string, unknown>[]).map((r) => ({
        address: r.raw_value, beds: r.beds, baths: r.baths, squareFeet: r.square_feet, yearBuilt: r.year_built,
        estimatedValue: r.estimated_value, estimatedEquity: r.estimated_equity, lastSaleAmount: r.last_sale_amount,
        lastSaleDate: r.last_sale_date, occupancyType: r.occupancy_type, ownershipType: r.ownership_type,
        landUse: r.land_use, propertyClass: r.property_class, subdivision: r.subdivision, lotSqFt: r.lot_sqft,
      })),
      legal_records: legalRecordsRow
        ? {
            countyRecords: legalRecordsRow.legal_records_county
              ? { location: legalRecordsRow.legal_records_county, count: legalRecordsRow.legal_records_county_count }
              : undefined,
            nationwideCount: legalRecordsRow.legal_records_nationwide_count ?? undefined,
          }
        : {},
    });

  if (error) console.error(`✗ consolidated_profile upsert failed (scan=${quickscansId}): ${error.message}`);
}

/**
 * Re-derive just consolidated_profile.emails from the emails table's current
 * confirmed set. Used by manage-emails on every add/remove — cheap, no
 * re-scrape, keeps the rollup in sync without a full buildConsolidatedProfile
 * pass (which needs identity info this caller doesn't have on hand).
 */
export async function syncConfirmedEmails(supabase: SupabaseClient, quickscansId: string): Promise<void> {
  const { data } = await supabase
    .schema("quickscan")
    .from("emails")
    .select("raw_value")
    .eq("quickscans_id", quickscansId)
    .is("duplicate_of", null)
    .eq("confirmed", true);

  const { error } = await supabase
    .schema("quickscan")
    .from("consolidated_profile")
    .update({ emails: ((data ?? []) as { raw_value: string }[]).map((r) => r.raw_value) })
    .eq("quickscans_id", quickscansId);

  if (error) console.error(`✗ consolidated_profile emails sync failed (scan=${quickscansId}): ${error.message}`);
}
