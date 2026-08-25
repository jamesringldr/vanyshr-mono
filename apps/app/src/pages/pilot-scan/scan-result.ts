/** Parsed Phase 1 payload stored in sessionStorage as `pilotScanResult`. */

export type ScanMember = {
  broker?: string;
  name?: string;
  address?: string;
  age?: number | string;
  age_range?: string;
  location?: string;
  profile_url?: string;
  phone?: string;
  email?: string;
  aliases?: string;
  relatives?: string;
  previous_addresses?: string;
  result_id?: string;
  match_score?: number;
};

export type ScanGroup = {
  id?: string | null;
  name?: string;
  age?: number | string;
  city?: string;
  state?: string;
  sources?: string[];
  confidence?: number;
  age_conflict?: boolean;
  age_note?: string;
  members?: ScanMember[];
};

export type ScanResult = {
  success?: boolean;
  /**
   * The quick_scans row both Phase 1 tiers converged on. Echoed back to the
   * edge function on the Phase 2 call so the selected group and its enrichment
   * hang off the same scan, and used to read results back from the database.
   */
  quick_scan_id?: string | null;
  dedup_groups?: ScanGroup[];
  metadata?: {
    total_time_ms?: number;
    brokers_scraped?: string[];
    profiles_found?: number;
    used_scraper_lab?: boolean;
  };
};

export type Finding = {
  label: string;
  value: string;
  source?: string;
};

/**
 * Phase 2 enrichment data returned by get_pilot_scan_result().
 * All fields are optional; presence indicates the check was run.
 */
export type EnrichmentData = {
  emails_found?: string[];
  services_found?: string[];
  breaches?: Array<{
    name: string;
    date?: string;
    exposures?: number;
    url?: string;
  }>;
  breach_count?: number;
  holehe_status?: "success" | "no_results" | "unavailable" | "pending" | "failed" | "no_auth" | "timeout";
  leakcheck_status?: "success" | "no_results" | "unavailable" | "pending" | "failed" | "no_auth" | "timeout";
  services_checked?: number;
  services_unavailable?: number | null;
  fields_exposed?: string[];
};

export type AreaId =
  | "critical"
  | "scam"
  | "family"
  | "identity"
  | "accounts"
  | "spam"
  | "property"
  | "other";

function splitList(raw?: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(/[,;|]|(?:\s+and\s+)/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/** Former addresses are semicolon-separated; commas are part of the address. */
function splitSemi(raw?: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 3);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

function brokerLabel(raw?: string): string {
  const b = (raw || "").toLowerCase();
  if (b === "fps") return "FastPeopleSearch";
  if (b === "npd") return "NPD";
  if (b === "anywho") return "AnyWho";
  if (b === "zaba") return "ZabaSearch";
  return raw || "Listing";
}

export function loadScanResult(): { result: ScanResult | null; error: string | null } {
  if (typeof sessionStorage === "undefined") {
    return { result: null, error: null };
  }
  const err = sessionStorage.getItem("pilotScanError");
  const raw = sessionStorage.getItem("pilotScanResult");
  if (!raw) return { result: null, error: err };
  try {
    return { result: JSON.parse(raw) as ScanResult, error: err };
  } catch {
    return { result: null, error: err || "Could not read scan results" };
  }
}

export function groupToSummary(group: ScanGroup, index: number) {
  const members = group.members ?? [];
  const phones = members.flatMap((m) => splitList(m.phone));
  const relatives = members.flatMap((m) => splitList(m.relatives));
  const aliases = members.flatMap((m) => splitList(m.aliases));
  const addresses = members.map((m) => m.address).filter((a): a is string => Boolean(a));
  const ageRaw = group.age ?? members[0]?.age;
  const age =
    typeof ageRaw === "number"
      ? ageRaw
      : ageRaw
        ? parseInt(String(ageRaw), 10) || undefined
        : undefined;
  return {
    id: group.id || `group-${index}`,
    fullName: group.name || members[0]?.name || "Unknown",
    age,
    aliases: unique(aliases),
    phones: unique(phones),
    relatives: unique(relatives),
    // One address only — these are per-broker addresses (each member is a
    // different broker's record for the same person), and brokers disagree
    // on which address is current. Joining two different brokers' addresses
    // together under one "Current Address" label reads as one garbled address.
    currentAddress: addresses.length ? [addresses[0]] : [],
  };
}

/**
 * Reshape a picked ScanGroup back into the DedupGroup shape the pilot-scan
 * edge function's Phase 2 (selectedGroup) expects — { summary, match_score }
 * per member, carrying each broker's profile_url through for the detail-page
 * scrape. Kept as a plain object (not a shared type import) to match how this
 * file already mirrors the backend response shape independently.
 */
export function scanGroupToPhase2Payload(group: ScanGroup) {
  return {
    dedup_id: group.id || `group-${Date.now()}`,
    age_conflict: !!group.age_conflict,
    age_note: group.age_note,
    members: (group.members ?? []).map((m) => ({
      match_score: m.match_score ?? 0,
      summary: {
        broker: m.broker || "",
        full_name: m.name || "",
        address: m.address || "",
        age_range: m.age_range || (m.age != null ? String(m.age) : ""),
        age: typeof m.age === "number" ? m.age : m.age ? parseInt(String(m.age), 10) : undefined,
        location: m.location || m.address || "",
        profile_url: m.profile_url || "",
        result_id: m.result_id,
        phone: m.phone,
        email: m.email,
        aliases: m.aliases,
        relatives: m.relatives,
        previous_addresses: m.previous_addresses,
      },
    })),
  };
}

/** One member as stored in quickscan_dedup_groups.full_data. */
type StoredMember = {
  match_score?: number;
  summary?: {
    broker?: string;
    full_name?: string;
    address?: string;
    age_range?: string;
    age?: number;
    location?: string;
    profile_url?: string;
    result_id?: string;
    phone?: string;
    email?: string;
    aliases?: string;
    relatives?: string;
    previous_addresses?: string;
  };
};

/** The `selected_group` object returned by public.get_pilot_scan_result. */
export type StoredGroup = {
  full_data?: { dedup_id?: string; members?: StoredMember[] };
  primary_name?: string;
  primary_age?: number | null;
  primary_city?: string;
  primary_state?: string;
  sources?: string[];
  average_confidence?: number;
  age_conflict?: boolean;
  age_note?: string | null;
};

/**
 * Inverse of scanGroupToPhase2Payload: turn the stored dedup group back into
 * the ScanGroup shape the results pages render from.
 *
 * The scalar columns (primary_name, primary_city, …) are preferred over
 * re-deriving them from full_data, because they are what the backend committed
 * at write time — re-splitting `address` on the client would risk drifting from
 * the row the rest of the system reasons about.
 */
export function storedGroupToScanGroup(stored: StoredGroup): ScanGroup {
  const members = stored.full_data?.members ?? [];
  return {
    // Null keeps identity positional, matching how live Phase 1 results behave
    // so both paths flow through the same selection logic downstream.
    id: null,
    name: stored.primary_name || members[0]?.summary?.full_name || "",
    age: stored.primary_age ?? members[0]?.summary?.age,
    city: stored.primary_city || "",
    state: stored.primary_state || "",
    sources: stored.sources ?? [],
    confidence: stored.average_confidence,
    age_conflict: !!stored.age_conflict,
    age_note: stored.age_note ?? undefined,
    members: members.map((m) => ({
      broker: m.summary?.broker,
      name: m.summary?.full_name,
      address: m.summary?.address,
      age: m.summary?.age,
      age_range: m.summary?.age_range,
      location: m.summary?.location,
      profile_url: m.summary?.profile_url,
      phone: m.summary?.phone,
      email: m.summary?.email,
      aliases: m.summary?.aliases,
      relatives: m.summary?.relatives,
      previous_addresses: m.summary?.previous_addresses,
      result_id: m.summary?.result_id,
      match_score: m.match_score,
    })),
  };
}

export function selectGroup(result: ScanResult, groupId: string): ScanResult {
  const groups = [...(result.dedup_groups ?? [])];
  const idx = groups.findIndex((g, i) => (g.id || `group-${i}`) === groupId);
  if (idx <= 0) return result;
  const [picked] = groups.splice(idx, 1);
  return { ...result, dedup_groups: [picked, ...groups] };
}

export function primaryGroup(result: ScanResult | null): ScanGroup | null {
  const groups = result?.dedup_groups ?? [];
  return groups[0] ?? null;
}

function normName(name?: string): string {
  return (name || "").toLowerCase().trim().replace(/[^a-z\s]/g, "");
}

function groupMatchKey(group: ScanGroup): { first: string; last: string; state: string } {
  const name = normName(group.name || group.members?.[0]?.name);
  const parts = name.split(/\s+/).filter(Boolean);
  return {
    first: parts[0] || "",
    last: parts[parts.length - 1] || "",
    state: (group.state || "").toLowerCase(),
  };
}

/**
 * Fold the slow-tier batch (FPS/NPD/AnyWho) into the fast-tier batch (Zaba) the
 * user is already looking at — matching groups by normalized name + state so
 * the same person's cards merge instead of duplicating. Used for the two-tier
 * fast/slow Phase 1 split in loading.tsx; not a re-run of the server's
 * phone/address dedupe, just a display-level fold of two already-deduped batches.
 */
export function mergeScanResults(fast: ScanResult | null, slow: ScanResult | null): ScanResult {
  const fastGroups = fast?.dedup_groups ?? [];
  const slowGroups = slow?.dedup_groups ?? [];
  // Both tiers upsert the same quick_scans row, so either one carries the id.
  // Taking whichever is present keeps it even when one tier fails outright.
  const quickScanId = fast?.quick_scan_id ?? slow?.quick_scan_id ?? null;
  if (!slowGroups.length) return { ...(fast ?? { success: true, dedup_groups: [] }), quick_scan_id: quickScanId };
  if (!fastGroups.length) return { ...(slow ?? { success: true, dedup_groups: [] }), quick_scan_id: quickScanId };

  const merged: ScanGroup[] = fastGroups.map((g) => ({ ...g, members: [...(g.members ?? [])] }));

  for (const slowGroup of slowGroups) {
    const key = groupMatchKey(slowGroup);
    const match = merged.find((g) => {
      const gk = groupMatchKey(g);
      return gk.first === key.first && gk.last === key.last && (!key.state || !gk.state || gk.state === key.state);
    });
    if (match) {
      match.members = [...(match.members ?? []), ...(slowGroup.members ?? [])];
      match.sources = [...new Set([...(match.sources ?? []), ...(slowGroup.sources ?? [])])];
    } else {
      merged.push(slowGroup);
    }
  }

  // `slow` is non-null whenever slowGroups is non-empty (the early return above
  // covers the empty case), but that is not something the compiler can prove —
  // so guard it rather than assert it.
  return {
    success: true,
    quick_scan_id: quickScanId,
    dedup_groups: merged,
    metadata: slow?.metadata ?? fast?.metadata,
  };
}

export function buildAreas(result: ScanResult | null, enrichment?: EnrichmentData | null) {
  const group = primaryGroup(result);
  const others = (result?.dedup_groups ?? []).slice(1);
  const members = group?.members ?? [];

  const phones: Finding[] = [];
  const emails: Finding[] = [];
  const relatives: Finding[] = [];
  const aliases: Finding[] = [];
  const addresses: Finding[] = [];
  const previous: Finding[] = [];
  const listings: Finding[] = [];
  const holehe: Finding[] = [];
  const breaches: Finding[] = [];
  const ages: Finding[] = [];
  const names: Finding[] = [];

  for (const m of members) {
    const src = brokerLabel(m.broker);
    if (m.name) names.push({ label: "Name on file", value: m.name, source: src });
    const ageVal = m.age ?? m.age_range;
    if (ageVal !== undefined && ageVal !== null && String(ageVal).trim()) {
      ages.push({ label: "Age", value: String(ageVal), source: src });
    }
    if (m.address) addresses.push({ label: "Current address", value: m.address, source: src });
    for (const p of splitList(m.phone)) {
      phones.push({ label: "Phone", value: p, source: src });
    }
    for (const e of splitList(m.email)) {
      emails.push({ label: "Email", value: e, source: src });
    }
    for (const r of splitList(m.relatives)) {
      relatives.push({ label: "Relative", value: r, source: src });
    }
    for (const a of splitList(m.aliases)) {
      aliases.push({ label: "Alias", value: a, source: src });
    }
    for (const prev of splitSemi(m.previous_addresses)) {
      previous.push({ label: "Previous address", value: prev, source: src });
    }
    if (m.profile_url) {
      listings.push({
        label: `${src} profile`,
        value: m.profile_url,
        source: src,
      });
    } else if (m.broker) {
      listings.push({ label: "Listed on", value: src, source: src });
    }
  }

  // Phase 2: Holehe services (only if the check actually ran)
  if (enrichment?.holehe_status === "success" || enrichment?.holehe_status === "no_results") {
    const services = enrichment.services_found ?? [];
    for (const service of services) {
      holehe.push({
        label: "Account found",
        value: service.charAt(0).toUpperCase() + service.slice(1),
      });
    }
  }

  // Phase 2: Leakcheck breaches
  if (enrichment?.breaches && enrichment.breaches.length > 0) {
    for (const breach of enrichment.breaches) {
      const parts = [];
      if (breach.date) parts.push(breach.date);
      if (breach.exposures) {
        const millions = (breach.exposures / 1000000).toFixed(1);
        parts.push(`${millions}M exposed`);
      }
      const value = parts.length > 0 ? parts.join(" · ") : breach.name;
      breaches.push({
        label: "Data breach",
        value: breach.name && breach.name !== value ? `${breach.name} (${value})` : value,
        ...(breach.url ? undefined : {}),
      });
    }
  }

  const uniqAddresses = unique(addresses.map((a) => a.value));
  const ageConflict = Boolean(group?.age_conflict);

  const criticalItems: Finding[] = [];
  if (group?.sources?.length) {
    criticalItems.push({
      label: "Public broker records",
      value: `Found on ${unique(group.sources.map(brokerLabel)).join(", ")}`,
    });
  }
  if (ageConflict && group?.age_note) {
    criticalItems.push({ label: "Age conflict", value: group.age_note });
  }
  if (uniqAddresses.length > 1) {
    criticalItems.push({
      label: "Address disagreement",
      value: `${uniqAddresses.length} different current addresses across brokers`,
    });
  }
  if (addresses[0]) criticalItems.push(addresses[0]);

  // Add the most recent breach to critical area (if any)
  if (breaches.length > 0) {
    criticalItems.push(breaches[0]);
  }

  const otherItems: Finding[] = [
    ...others.map((g, i) => ({
      label: `Other match ${i + 1}`,
      value: [g.name, g.age ? `age ${g.age}` : "", g.city, g.state].filter(Boolean).join(" · "),
      source: (g.sources ?? []).map(brokerLabel).join(", "),
    })),
    // Move broker listings to other area
    ...listings,
  ];

  function score(count: number, cap: number, extra = 0) {
    return Math.min(1, Math.max(0.08, count / cap + extra));
  }

  return {
    group,
    others,
    areas: [
      {
        id: "critical" as const,
        label: "Critical",
        summary: (() => {
          const parts = [];
          if (breaches.length > 0) parts.push(`${breaches.length} breach${breaches.length === 1 ? "" : "es"}`);
          if (group?.sources?.length) parts.push(`${group.sources.length} broker${group.sources.length === 1 ? "" : "s"}`);
          if (ageConflict) parts.push("age conflict");
          if (uniqAddresses.length > 1) parts.push("address conflict");
          return parts.length > 0 ? parts.join(", ") : "No critical flags in this scan";
        })(),
        detail:
          "Data breaches, people-search listings, and the details that make you easiest to find and impersonate — how many brokers have you, whether they agree on who you are, and your current address.",
        score: score(
          (group?.sources?.length ?? 0) + (breaches.length ? 3 : 0) + (ageConflict ? 2 : 0) + (uniqAddresses.length > 1 ? 1 : 0),
          10,
        ),
        items: criticalItems,
      },
      {
        id: "scam" as const,
        label: "Scam",
        summary: ageConflict || uniqAddresses.length > 1
          ? "Conflicting public records"
          : "No conflict signals",
        detail:
          "Mismatched ages and addresses across sites are what scammers use to sound convincing — they pick the version that matches whatever they already know.",
        score: score((ageConflict ? 2 : 0) + Math.max(0, uniqAddresses.length - 1), 4),
        items: [
          ...(ageConflict && group?.age_note
            ? [{ label: "Age conflict", value: group.age_note }]
            : []),
          ...uniqAddresses.slice(0, 6).map((v) => ({ label: "Address variant", value: v })),
        ],
      },
      {
        id: "spam" as const,
        label: "Spam",
        summary:
          phones.length + emails.length
            ? `${phones.length + emails.length} contact point${phones.length + emails.length === 1 ? "" : "s"}`
            : "No phones or emails in this scan",
        detail:
          "Phone numbers and emails published on people-search sites are the usual feed for spam, robocalls, and phishing.",
        score: score(phones.length + emails.length, 6),
        items: [...phones, ...emails],
      },
      {
        id: "identity" as const,
        label: "Identity Theft",
        summary:
          unique(names.map((n) => n.value)).length + aliases.length
            ? `${unique(names.map((n) => n.value)).length} name variant${unique(names.map((n) => n.value)).length === 1 ? "" : "s"}`
            : "No identity variants",
        detail:
          "Name spellings, aliases, and ages that brokers attach to you — the raw material for opening accounts or resetting logins.",
        score: score(unique(names.map((n) => n.value)).length + aliases.length + unique(ages.map((a) => a.value)).length, 8),
        items: [
          ...unique(names.map((n) => n.value)).map((v) => ({ label: "Name variant", value: v })),
          ...aliases,
          ...unique(ages.map((a) => `${a.value} (${a.source})`)).map((v) => ({
            label: "Reported age",
            value: v,
          })),
        ],
      },
      {
        id: "accounts" as const,
        label: "Accounts",
        summary: (() => {
          // Show account discovery status: found, checked/none, or not checked
          if (enrichment?.holehe_status === "success" && holehe.length > 0) {
            return `${holehe.length} account${holehe.length === 1 ? "" : "s"} found`;
          }
          if (enrichment?.holehe_status === "no_results") {
            return "None found on monitored services";
          }
          if (enrichment?.holehe_status === "unavailable" || !enrichment?.holehe_status) {
            return "Account check unavailable";
          }
          return "Checking accounts…";
        })(),
        detail:
          "Accounts we found linked to your identity on popular services. These are places where attackers might try to reset passwords or access data.",
        score: score(
          enrichment?.holehe_status === "success" || enrichment?.holehe_status === "no_results"
            ? holehe.length
            : 0,
          6,
        ),
        items: holehe,
      },
      {
        id: "family" as const,
        label: "Family",
        summary: relatives.length
          ? `${relatives.length} relative${relatives.length === 1 ? "" : "s"} named`
          : "No relatives in this scan",
        detail:
          "Relatives and household names brokers attach to your file. Those names are used for security questions and for targeting people around you.",
        score: score(relatives.length, 6),
        items: relatives,
      },
      {
        id: "property" as const,
        label: "Property",
        summary:
          addresses.length + previous.length
            ? `${uniqAddresses.length} current, ${previous.length} previous`
            : "No property records in this scan",
        detail:
          "Current and previous addresses from the scan. Full FPS house specs (beds, baths, value) land here once Phase 2 is wired — Phase 1 only has the address lines.",
        score: score(uniqAddresses.length + previous.length, 5, addresses.length ? 0.15 : 0),
        items: [
          ...addresses,
          ...previous,
        ],
      },
      ...(otherItems.length
        ? [
            {
              id: "other" as const,
              label: "Other matches",
              summary: `${otherItems.length} other ${otherItems.length === 1 ? "person" : "people"} with a similar name`,
              detail:
                "The scan also grouped other people who share your name. These are not folded into your file — they are separate records.",
              score: score(otherItems.length, 5),
              items: otherItems,
            },
          ]
        : []),
    ],
  };
}
