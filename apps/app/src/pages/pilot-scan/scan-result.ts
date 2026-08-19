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
    currentAddress: unique(addresses).slice(0, 2),
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
  if (!slowGroups.length) return fast ?? { success: true, dedup_groups: [] };
  if (!fastGroups.length) return slow ?? { success: true, dedup_groups: [] };

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

  return { success: true, dedup_groups: merged, metadata: slow.metadata ?? fast?.metadata };
}

export function buildAreas(result: ScanResult | null) {
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

  const otherItems: Finding[] = others.map((g, i) => ({
    label: `Other match ${i + 1}`,
    value: [g.name, g.age ? `age ${g.age}` : "", g.city, g.state].filter(Boolean).join(" · "),
    source: (g.sources ?? []).map(brokerLabel).join(", "),
  }));

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
        summary: criticalItems.length
          ? `${criticalItems.length} urgent exposure${criticalItems.length === 1 ? "" : "s"}`
          : "No critical flags in this scan",
        detail:
          "The details that make you easiest to find and impersonate — how many brokers have you, whether they agree on who you are, and your current address.",
        score: score(
          (group?.sources?.length ?? 0) + (ageConflict ? 2 : 0) + (uniqAddresses.length > 1 ? 1 : 0),
          6,
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
        summary: listings.length
          ? `${listings.length} public listing${listings.length === 1 ? "" : "s"}`
          : "No listings captured",
        detail:
          "People-search profiles we found. These are public pages anyone can open — not your bank or email logins, but they often link to both.",
        score: score(listings.length, 4),
        items: listings,
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
