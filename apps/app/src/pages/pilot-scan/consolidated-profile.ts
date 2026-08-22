/**
 * Shared data layer for the post-scan report carousel (risk-summary +
 * pre-profile slides) — quickscan.consolidated_profile, as returned inline
 * by full-profile-scan and refreshed by manage-emails' confirm step.
 * Already deduped/merged server-side, so no client-side broker-merge logic
 * needed here (unlike the old /pilot-scan Phase 1/2 pages, which did their
 * own Zaba-match merge on raw broker data — see scan-result.ts, still used
 * by start.tsx).
 */
import type { Finding } from "./scan-result";

export interface ConsolidatedProfile {
  full_name: string | null;
  age: number | null;
  primary_address: string | null;
  previous_addresses: string[];
  phones: string[];
  emails: string[];
  relatives: Array<{ name: string; relation?: string | null; age?: number | null }>;
  aliases: string[];
  employment: Array<{
    kind?: string | null;
    employer?: string | null;
    title?: string | null;
    since?: string | null;
    duration?: string | null;
    location?: string | null;
  }>;
  education: Array<{
    school?: string | null;
    degree?: string | null;
    fieldOfStudy?: string | null;
    rawValue?: string | null;
  }>;
  properties: Array<{
    address?: string | null;
    beds?: string | null;
    baths?: string | null;
    squareFeet?: number | null;
    yearBuilt?: number | null;
    estimatedValue?: number | null;
    estimatedEquity?: number | null;
    lastSaleAmount?: number | null;
    lastSaleDate?: string | null;
    occupancyType?: string | null;
    ownershipType?: string | null;
    landUse?: string | null;
    propertyClass?: string | null;
    subdivision?: string | null;
    lotSqFt?: number | null;
  }>;
  legal_records: {
    countyRecords?: { location: string; count?: number | null } | null;
    nationwideCount?: number | null;
  };
  /**
   * Holehe/Leakcheck results — NULL/empty until manage-emails' "confirm"
   * action runs (a later step than the pick that first populates this
   * profile), so these are absent on the copy loading.tsx stores right
   * after full-profile-scan and only appear once handleEmailsConfirmed()
   * overwrites sessionStorage with manage-emails' refreshed row.
   */
  services_found?: string[] | null;
  /**
   * Grouped by email, not flattened — Leakcheck's query unit is one email
   * address at a time, and fields_exposed is an aggregate over that whole
   * query (which field *types* turned up across all its breach sources),
   * not attributable to any single breach within it.
   */
  breaches?: Array<{
    email: string;
    breaches: Array<{ name: string; date?: string | null; year?: string | null }>;
    fields_exposed: string[];
  }> | null;
  breach_count?: number | null;
}

const STORAGE_KEY = "pilotConsolidatedProfile";

export interface StoredConsolidatedProfile {
  profile: ConsolidatedProfile;
  brokerCount: number;
}

/** Read the profile loading.tsx stored after the pick, or manage-emails refreshed after confirm. */
export function loadConsolidatedProfile(): { data: StoredConsolidatedProfile | null; error: string | null } {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return { data: null, error: "Nothing came through from this scan — run it again from the start." };
  try {
    return { data: JSON.parse(raw) as StoredConsolidatedProfile, error: null };
  } catch {
    return { data: null, error: "Could not read scan results" };
  }
}

/**
 * Overwrite the stored profile — used once right after the pick
 * (full-profile-scan's response) and again after email confirmation
 * (manage-emails returns the same row with services_found/breaches filled
 * in), so whichever page renders next always has the freshest copy.
 */
export function saveConsolidatedProfile(profile: ConsolidatedProfile, brokerCount: number): void {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ profile, brokerCount }));
}

// ---------------------------------------------------------------------------
// Formatting helpers shared by both slides
// ---------------------------------------------------------------------------

export function toProperCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatPhone(num: string): string {
  const digits = num.replace(/\D/g, "").slice(-10);
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return num;
}

export function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US")}`;
}

/** "Enterprise Account Executive at Ehawk, Inc." -- the display string for one job. */
export function formatJob(job: ConsolidatedProfile["employment"][number]): string {
  return [job.title, job.employer && `at ${job.employer}`].filter(Boolean).join(" ") || job.employer || "";
}

/** "Bachelor of Science in Organizational Communication from Northwest Missouri State University"
 *  -- FPS gives structured fields; Zaba gives one sentence (rawValue) with nothing else to build from. */
export function formatEducation(entry: ConsolidatedProfile["education"][number]): string {
  if (entry.school) {
    return [entry.degree, entry.fieldOfStudy && `in ${entry.fieldOfStudy}`, `from ${entry.school}`]
      .filter(Boolean).join(" ");
  }
  return entry.rawValue || "";
}

/** "413 Lovers Ln, Cameron, MO 64429" -> { street, cityStateZip } for two-line display. */
export function parseFullAddress(fullAddr: string): { street: string; cityStateZip: string } {
  const lastComma = fullAddr.lastIndexOf(",");
  if (lastComma !== -1) {
    return {
      street: fullAddr.slice(0, lastComma).trim(),
      cityStateZip: fullAddr.slice(lastComma + 1).trim(),
    };
  }
  return { street: fullAddr, cityStateZip: "" };
}

// ---------------------------------------------------------------------------
// Risk-summary hex chart data — the ConsolidatedProfile equivalent of the
// old scan-result.ts buildAreas(), which reads per-broker dedup_groups and
// doesn't apply here (this profile is already merged server-side).
// ---------------------------------------------------------------------------

export type RiskAreaId = "critical" | "scam" | "family" | "identity" | "accounts" | "spam" | "property" | "other";

/** One breached email, its breach sources, and the field types Leakcheck found exposed for it. */
export type BreachGroup = {
  email: string;
  breaches: Array<{ name: string; date?: string | null; year?: string | null }>;
  fieldsExposed: string[];
};

export type RiskArea = {
  id: RiskAreaId;
  label: string;
  summary: string;
  detail: string;
  score: number;
  items: Finding[];
  /** Critical only — the breach-by-email view replaces the generic Finding list for that area. */
  breachGroups?: BreachGroup[];
};

function score(count: number, cap: number, extra = 0): number {
  return Math.min(1, Math.max(0.08, count / cap + extra));
}

/**
 * Areas built straight from the consolidated (already-deduped) profile —
 * no per-broker breakdown available at this point, so items read as plain
 * facts rather than "reported by X" the way the old per-broker buildAreas()
 * did. "Other matches" (other same-name people) doesn't apply here either —
 * that was a Phase 1 multi-group concept; this profile is the one the user
 * already picked.
 */
export function buildRiskAreas(profile: ConsolidatedProfile): RiskArea[] {
  const phones = profile.phones ?? [];
  const emails = profile.emails ?? [];
  const relatives = profile.relatives ?? [];
  const aliases = profile.aliases ?? [];
  const previousAddresses = profile.previous_addresses ?? [];
  const employment = profile.employment ?? [];
  const education = profile.education ?? [];
  const properties = profile.properties ?? [];
  const servicesFound = profile.services_found ?? [];
  const breachesByEmail = profile.breaches ?? [];
  const breachCount = breachesByEmail.reduce((sum, e) => sum + e.breaches.length, 0);

  const addressCount = (profile.primary_address ? 1 : 0) + previousAddresses.length;

  // Critical is breach-only -- current address and legal records already
  // have their own home (pre-profile's Contact section / Legal records
  // card), so they don't need a second appearance here.
  const breachGroups: BreachGroup[] = breachesByEmail.map((e) => ({
    email: e.email,
    breaches: e.breaches,
    fieldsExposed: e.fields_exposed,
  }));

  const identityItems: Finding[] = [
    ...aliases.map((a) => ({ label: "Alias", value: a })),
    ...employment.map((job) => ({ label: job.kind === "current" ? "Current job" : "Past job", value: formatJob(job) })).filter((f) => f.value),
    ...education.map((entry) => ({ label: "Education", value: formatEducation(entry) })).filter((f) => f.value),
  ];

  const propertyItems: Finding[] = [
    ...(profile.primary_address ? [{ label: "Current address", value: profile.primary_address }] : []),
    ...previousAddresses.map((a) => ({ label: "Previous address", value: a })),
    ...properties.flatMap((p) => {
      const facts: Finding[] = [];
      if (p.estimatedValue) facts.push({ label: "Est. value", value: formatMoney(p.estimatedValue), source: p.address ?? undefined });
      if (p.beds || p.baths) facts.push({ label: "Beds/baths", value: [p.beds, p.baths].filter(Boolean).join(" / "), source: p.address ?? undefined });
      return facts;
    }),
  ];

  return [
    {
      id: "critical",
      label: "Critical",
      summary: breachCount > 0
        ? `${breachCount} breach${breachCount === 1 ? "" : "es"} across ${breachGroups.length} email${breachGroups.length === 1 ? "" : "s"}`
        : "No data breaches found",
      detail: "Data breaches your email addresses turned up in — where, when, and what kind of data was exposed.",
      score: score(breachCount, 4),
      items: [],
      breachGroups,
    },
    {
      id: "scam",
      label: "Scam",
      summary: addressCount > 1 ? `${addressCount} addresses on file` : "No conflict signals",
      detail:
        "Multiple addresses and reported ages across brokers are what scammers use to sound convincing — they pick the version that matches whatever they already know.",
      score: score(Math.max(0, addressCount - 1), 4),
      items: previousAddresses.slice(0, 6).map((v) => ({ label: "Previous address", value: v })),
    },
    {
      id: "spam",
      label: "Spam",
      summary:
        phones.length + emails.length
          ? `${phones.length + emails.length} contact point${phones.length + emails.length === 1 ? "" : "s"}`
          : "No phones or emails in this scan",
      detail:
        "Phone numbers and emails published on people-search sites are the usual feed for spam, robocalls, and phishing.",
      score: score(phones.length + emails.length, 6),
      items: [
        ...phones.map((p) => ({ label: "Phone", value: formatPhone(p) })),
        ...emails.map((e) => ({ label: "Email", value: e })),
      ],
    },
    {
      id: "identity",
      label: "Identity Theft",
      summary: identityItems.length ? `${identityItems.length} identity detail${identityItems.length === 1 ? "" : "s"}` : "No identity variants",
      detail:
        "Aliases, job history, and education brokers attach to you — the raw material for opening accounts or resetting logins.",
      score: score(identityItems.length, 8),
      items: identityItems,
    },
    {
      id: "accounts",
      label: "Accounts",
      summary: (() => {
        if (profile.services_found == null) return "Account check unavailable";
        if (servicesFound.length > 0) return `${servicesFound.length} account${servicesFound.length === 1 ? "" : "s"} found`;
        return "None found on monitored services";
      })(),
      detail:
        "Accounts we found linked to your identity on popular services. These are places where attackers might try to reset passwords or access data.",
      score: score(servicesFound.length, 6),
      items: servicesFound.map((s) => ({ label: "Account found", value: s.charAt(0).toUpperCase() + s.slice(1) })),
    },
    {
      id: "family",
      label: "Family",
      summary: relatives.length ? `${relatives.length} relative${relatives.length === 1 ? "" : "s"} named` : "No relatives in this scan",
      detail:
        "Relatives and household names brokers attach to your file. Those names are used for security questions and for targeting people around you.",
      score: score(relatives.length, 6),
      items: relatives.map((r) => ({
        label: "Relative",
        value: [toProperCase(r.name), r.relation, r.age != null ? `age ${r.age}` : ""].filter(Boolean).join(" · "),
      })),
    },
    {
      id: "property",
      label: "Property",
      summary: propertyItems.length ? `${addressCount} address${addressCount === 1 ? "" : "es"} on file` : "No property records in this scan",
      detail: "Current and previous addresses, plus home specifics where a broker had them.",
      score: score(addressCount, 5, properties.length ? 0.15 : 0),
      items: propertyItems,
    },
  ];
}
