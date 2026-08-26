/**
 * Deduplication Engine
 *
 * Scoring is 1-vs-1. Identification is not this module's job — the user
 * picks a record, then matchReference() scores that record against each
 * other broker's summaries and keeps at most one hit per broker.
 *
 * Weights (sum 100), from observed broker data:
 *   phone 30 / location 25 / relatives 20 / name 20 / age 5
 *
 * Name is a gate, not the primary score. Address and phone are the strongest
 * signals *because* they are shared within a household, so without a
 * first-name ceiling they merge spouses.
 */

import {
  BrokerName,
  SummaryResult,
  DedupGroup,
  ScrapeResult,
} from "./quickscan-phase1-phase2-models.ts";
import { compareParsedAddresses, parseAddress } from "./address-parser.ts";

/**
 * Common English given-name diminutives, mapped to a canonical form.
 *
 * Brokers publish whatever the source record held, so the same person appears
 * as James on one site and Jim on another. Without this the pair only matches
 * by accident through the fuzzy ratio, and scores below the merge threshold
 * whenever the surname is short.
 *
 * Bidirectional by construction: both spellings map to the same canonical
 * value, so lookup order never matters.
 */
const NAME_CANON: Record<string, string> = {
  jim: "james", jimmy: "james", jamie: "james", james: "james",
  bob: "robert", bobby: "robert", rob: "robert", robbie: "robert", robert: "robert",
  bill: "william", billy: "william", will: "william", willie: "william", william: "william",
  dick: "richard", rick: "richard", ricky: "richard", rich: "richard", richard: "richard",
  mike: "michael", mikey: "michael", michael: "michael",
  chris: "christopher", christopher: "christopher",
  dave: "david", david: "david",
  dan: "daniel", danny: "daniel", daniel: "daniel",
  joe: "joseph", joey: "joseph", joseph: "joseph",
  tom: "thomas", tommy: "thomas", thomas: "thomas",
  tony: "anthony", anthony: "anthony",
  steve: "steven", steven: "steven", stephen: "steven",
  matt: "matthew", matthew: "matthew",
  andy: "andrew", drew: "andrew", andrew: "andrew",
  ed: "edward", eddie: "edward", edward: "edward",
  ken: "kenneth", kenny: "kenneth", kenneth: "kenneth",
  charlie: "charles", chuck: "charles", charles: "charles",
  ron: "ronald", ronnie: "ronald", ronald: "ronald",
  don: "donald", donnie: "donald", donald: "donald",
  greg: "gregory", gregory: "gregory",
  jeff: "jeffrey", jeffrey: "jeffrey",
  ben: "benjamin", benji: "benjamin", benjamin: "benjamin",
  sam: "samuel", sammy: "samuel", samuel: "samuel",
  nick: "nicholas", nicholas: "nicholas",
  pat: "patrick", patrick: "patrick",
  liz: "elizabeth", beth: "elizabeth", betty: "elizabeth", eliza: "elizabeth", elizabeth: "elizabeth",
  kate: "katherine", katie: "katherine", kathy: "katherine", kat: "katherine", katherine: "katherine", catherine: "katherine",
  sue: "susan", susie: "susan", susan: "susan",
  peggy: "margaret", meg: "margaret", maggie: "margaret", margaret: "margaret",
  jen: "jennifer", jenny: "jennifer", jennifer: "jennifer",
  becky: "rebecca", rebecca: "rebecca",
  cindy: "cynthia", cynthia: "cynthia",
  debbie: "deborah", deb: "deborah", deborah: "deborah",
  patty: "patricia", tricia: "patricia", patricia: "patricia",
  nancy: "nancy", barb: "barbara", barbara: "barbara",
  sandy: "sandra", sandra: "sandra",
};

/** Canonical given name, so Jim and James compare equal. */
function canonicalGivenName(name: string): string {
  const key = name.toLowerCase().trim();
  return NAME_CANON[key] ?? key;
}

function firstToken(name: string): string {
  return (name || "").toLowerCase().trim().split(/\s+/)[0]?.replace(/\./g, "") ?? "";
}

function ageDistance(a?: number, b?: number): number {
  if (!a || !b) return 999;
  return Math.abs(a - b);
}

function normalizePhones(raw: string | undefined): Set<string> {
  const numbers = new Set<string>();
  for (const part of (raw || "").split(",")) {
    let digits = part.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
    if (digits.length === 10) numbers.add(digits);
  }
  return numbers;
}

function relativeKeys(raw: string | undefined): Set<string> {
  const keys = new Set<string>();
  for (const part of (raw || "").split(/[,;]/)) {
    const words = part
      .replace(/[^A-Za-z ]/g, " ")
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 1);
    if (words.length >= 2) keys.add(`${words[0]} ${words[words.length - 1]}`);
    else if (words.length === 1) keys.add(words[0]);
  }
  for (const k of [...keys]) {
    if (k.includes("more")) keys.delete(k);
  }
  return keys;
}

/**
 * Deduplication and scoring engine
 */
export type ResolvedMatch = {
  broker: BrokerName;
  summary: SummaryResult;
  match_score: number;
};

export class DedupEngine {
  static readonly MERGE_THRESHOLD = 75;
  static readonly GROUP_THRESHOLD = 50;
  /** Below GROUP_THRESHOLD, so a gated pair is never offered as a match. */
  static readonly NAME_GATE_CEILING = 45;

  static readonly W_PHONE = 30.0;
  static readonly W_LOCATION = 25.0;
  static readonly W_RELATIVES = 20.0;
  static readonly W_NAME = 20.0;
  static readonly W_AGE = 5.0;

  /**
   * Deduplicate summaries from multiple brokers
   * @param scrape_results Dict of broker name -> ScrapeResult
   * @returns List of DedupGroup sorted by confidence
   */
  deduplicate(scrapeResults: Record<string, ScrapeResult>): DedupGroup[] {
    // Flatten all summaries
    const allSummaries = this.flattenSummaries(scrapeResults);

    console.log(`🔍 Deduplicating ${allSummaries.length} summaries`);

    const groups: DedupGroup[] = [];

    // Process each summary
    for (const summary of allSummaries) {
      let matched = false;

      // Try to match against existing groups
      for (const group of groups) {
        let maxScore = 0;

        // Score against all members of the group
        for (const member of group.members) {
          const score = this.calculateMatchScore(summary, member.summary);
          maxScore = Math.max(maxScore, score);
        }

        // Add to group if score high enough
        if (maxScore >= DedupEngine.MERGE_THRESHOLD) {
          group.members.push({ summary, match_score: maxScore });
          matched = true;
          console.debug(
            `✓ Merged ${summary.broker} result into group ${group.dedup_id} (score: ${maxScore.toFixed(1)})`
          );
          break;
        } else if (maxScore >= DedupEngine.GROUP_THRESHOLD) {
          group.members.push({ summary, match_score: maxScore });
          matched = true;
          console.debug(
            `✓ Added ${summary.broker} to possible match group ${group.dedup_id} (score: ${maxScore.toFixed(1)})`
          );
          break;
        }
      }

      // Create new group if no match
      if (!matched) {
        const dedupId = this.generateDedupId(summary);
        const group: DedupGroup = {
          dedup_id: dedupId,
          members: [{ summary, match_score: 100.0 }], // First member = 100% confidence
          age_conflict: false,
        };
        groups.push(group);
        console.debug(`✓ Created new group ${dedupId}`);
      }
    }

    // Post-process groups for age conflicts
    for (const group of groups) {
      this.checkAgeConflict(group);
    }

    // Sort groups by confidence (highest first)
    groups.sort((a, b) => this.getAverageConfidence(b) - this.getAverageConfidence(a));

    console.log(`✓ Deduplication complete: ${groups.length} groups`);

    return groups;
  }

  /**
   * Score the picked record against each other broker's summaries.
   * At most one hit per broker, and only at/above MERGE_THRESHOLD.
   *
   * A candidate that matches a rejected card better than the pick is dropped
   * — "none of these" is negative evidence, not a no-op.
   *
   * When two candidates both clear the threshold, prefer the closer age to
   * the pick (Jr vs Sr at the same house), then the higher score.
   */
  matchReference(
    pick: SummaryResult,
    candidatesByBroker: Record<string, SummaryResult[]>,
    rejected: SummaryResult[] = [],
  ): ResolvedMatch[] {
    const resolved: ResolvedMatch[] = [];

    for (const [broker, candidates] of Object.entries(candidatesByBroker)) {
      if (!candidates?.length) continue;
      if (broker === pick.broker) continue;

      let best: { summary: SummaryResult; score: number; ageDelta: number } | null = null;

      for (const candidate of candidates) {
        const score = this.calculateMatchScore(pick, candidate);
        if (score < DedupEngine.MERGE_THRESHOLD) continue;

        const rejectedBetter = rejected.some(
          (r) => this.calculateMatchScore(r, candidate) > score,
        );
        if (rejectedBetter) continue;

        const ageDelta = ageDistance(pick.age, candidate.age);
        if (
          !best ||
          ageDelta < best.ageDelta ||
          (ageDelta === best.ageDelta && score > best.score)
        ) {
          best = { summary: candidate, score, ageDelta };
        }
      }

      if (best) {
        resolved.push({
          broker: broker as BrokerName,
          summary: best.summary,
          match_score: best.score,
        });
      }
    }

    return resolved;
  }

  /**
   * Score how likely two summaries describe the same person (0-100).
   *
   *   75+   merge
   *   50-75 possible match
   *   <50   separate
   */
  calculateMatchScore(summary1: SummaryResult, summary2: SummaryResult): number {
    const nameScore = this.compareNames(summary1.full_name, summary2.full_name);
    const locationScore = this.compareLocations(summary1, summary2);
    const phoneScore = this.comparePhones(summary1.phone, summary2.phone);
    const relativeScore = this.compareRelatives(summary1.relatives, summary2.relatives);
    const ageScore = this.compareAges(summary1.age, summary2.age);

    const score =
      phoneScore * DedupEngine.W_PHONE +
      locationScore * DedupEngine.W_LOCATION +
      relativeScore * DedupEngine.W_RELATIVES +
      nameScore * DedupEngine.W_NAME +
      ageScore * DedupEngine.W_AGE;

    if (!this.firstNamesCompatible(summary1.full_name, summary2.full_name)) {
      return Math.min(score, DedupEngine.NAME_GATE_CEILING);
    }

    return Math.min(100.0, score);
  }

  /**
   * Compare two names (0-1 scale)
   * Returns:
   *   1.0: Exact match
   *   0.95: First + Last match
   *   0.85: Typo/Levenshtein close
   *   0.70: First name + last initial
   *   0.0: No match
   */
  private compareNames(name1: string, name2: string): number {
    if (!name1 || !name2) {
      return 0.5; // Neutral
    }

    const name1Lower = name1.toLowerCase().trim();
    const name2Lower = name2.toLowerCase().trim();

    // Exact match
    if (name1Lower === name2Lower) {
      return 1.0;
    }

    // Split names
    const parts1 = name1Lower.split(/\s+/);
    const parts2 = name2Lower.split(/\s+/);

    // Both have first and last names
    if (parts1.length >= 2 && parts2.length >= 2) {
      const firstName1 = parts1[0];
      const lastName1 = parts1[parts1.length - 1];
      const firstName2 = parts2[0];
      const lastName2 = parts2[parts2.length - 1];

      // First AND last match. Given names are canonicalised so Jim/James and
      // Bob/Robert count as the same person rather than relying on the fuzzy
      // ratio to rescue them.
      const given1 = canonicalGivenName(firstName1);
      const given2 = canonicalGivenName(firstName2);

      if (given1 === given2 && lastName1 === lastName2) {
        return firstName1 === firstName2 ? 0.95 : 0.92;
      }

      // First + last initial match
      if (given1 === given2 && lastName2.startsWith(lastName1[0])) {
        return 0.7;
      }
      if (given2 === given1 && lastName1.startsWith(lastName2[0])) {
        return 0.7;
      }

      // Levenshtein distance for typos
      const nameDistance =
        this.levenshteinDistance(firstName1, firstName2) + this.levenshteinDistance(lastName1, lastName2);
      if (nameDistance <= 2) {
        return 0.85;
      }
    }

    // Fuzzy match (SequenceMatcher ratio)
    const ratio = this.sequenceMatchRatio(name1Lower, name2Lower);
    if (ratio > 0.85) return 0.85;
    if (ratio > 0.7) return 0.7;
    if (ratio > 0.5) return 0.5;

    return 0.0;
  }

  /**
   * Whether two names could belong to the same person. Gates the match:
   * household members share address and landline, so without this a weighted
   * score merges spouses.
   */
  private firstNamesCompatible(name1: string, name2: string): boolean {
    const a = firstToken(name1);
    const b = firstToken(name2);
    if (!a || !b) return true;
    if (canonicalGivenName(a) === canonicalGivenName(b)) return true;
    if (a.length === 1 || b.length === 1) return a[0] === b[0];
    if (a.length >= 3 && (b.startsWith(a) || a.startsWith(b))) return true;
    return this.levenshteinDistance(a, b) <= 1;
  }

  /**
   * Overlap between two phone lists, 0-1. Absence is not evidence (FPS
   * publishes no phone on its summary page).
   */
  private comparePhones(phones1: string | undefined, phones2: string | undefined): number {
    const set1 = normalizePhones(phones1);
    const set2 = normalizePhones(phones2);
    if (!set1.size || !set2.size) return 0;
    let overlap = 0;
    for (const n of set1) if (set2.has(n)) overlap++;
    return overlap / Math.min(set1.size, set2.size);
  }

  /**
   * Overlap between two relative lists, 0-1. First+last, dropping middles.
   */
  private compareRelatives(relatives1: string | undefined, relatives2: string | undefined): number {
    const set1 = relativeKeys(relatives1);
    const set2 = relativeKeys(relatives2);
    if (!set1.size || !set2.size) return 0;
    let overlap = 0;
    for (const k of set1) if (set2.has(k)) overlap++;
    return overlap / Math.min(set1.size, set2.size);
  }

  /**
   * Best match across both records' current and former addresses, 0-1.
   *
   * History matters because brokers disagree about which address is current.
   * A former-address hit scores slightly below a current one.
   */
  private compareLocations(summary1: SummaryResult, summary2: SummaryResult): number {
    const list1 = this.addressesOf(summary1);
    const list2 = this.addressesOf(summary2);
    if (!list1.length || !list2.length) return 0;

    let best = 0;
    for (let i = 0; i < list1.length; i++) {
      for (let j = 0; j < list2.length; j++) {
        let score = compareParsedAddresses(list1[i], list2[j]);
        if (i || j) score *= 0.9;
        best = Math.max(best, score);
      }
    }
    return best;
  }

  private addressesOf(summary: SummaryResult): ReturnType<typeof parseAddress>[] {
    const out = [parseAddress(summary.address)];
    for (const part of (summary.previous_addresses || "").split(";")) {
      if (part.trim()) out.push(parseAddress(part));
    }
    return out.filter((a) => a.city || a.state || a.street || a.zip);
  }

  /**
   * Compare two ages (0-1 scale). Contextual, never a veto.
   */
  private compareAges(age1: number | undefined, age2: number | undefined): number {
    if (age1 == null && age2 == null) return 1.0;
    if (age1 == null || age2 == null) return 0.8;

    const diff = Math.abs(age1 - age2);
    if (diff === 0) return 1.0;
    if (diff === 1) return 0.9;
    if (diff <= 3) return 0.5;
    return 0.2;
  }

  /**
   * Check for age conflicts in a group
   */
  private checkAgeConflict(group: DedupGroup): void {
    const ages = group.members.map((m) => m.summary.age).filter((a) => a !== undefined) as number[];

    if (ages.length < 2) {
      group.age_conflict = false;
      return;
    }

    const minAge = Math.min(...ages);
    const maxAge = Math.max(...ages);

    if (maxAge - minAge > 3) {
      group.age_conflict = true;

      // Build age note
      const ageMode = this.getMostCommonAge(ages);
      const conflictingAges = ages.filter((a) => Math.abs(a - ageMode) > 3);

      if (conflictingAges.length > 0) {
        group.age_note = `Most sources say ${ageMode}, one says ${conflictingAges[0]}`;
      }
    }
  }

  /**
   * Get most common age (mode)
   */
  private getMostCommonAge(ages: number[]): number {
    if (ages.length === 0) return 0;

    const sorted = [...ages].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)]; // Median
  }

  /**
   * Generate a unique ID for a dedup group
   */
  private generateDedupId(summary: SummaryResult): string {
    const data = `${summary.full_name}|${summary.address}`.toLowerCase();
    return this.simpleHash(data);
  }

  /**
   * Simple hash function for generating IDs
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(s1: string, s2: string): number {
    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost);
      }
    }

    return matrix[len1][len2];
  }

  /**
   * Calculate sequence match ratio (similar to Python's SequenceMatcher.ratio)
   */
  private sequenceMatchRatio(s1: string, s2: string): number {
    const matches = this.getMatchingBlocks(s1, s2);
    const totalMatches = matches.reduce((sum, m) => sum + m.size, 0);
    return (2.0 * totalMatches) / (s1.length + s2.length);
  }

  /**
   * Find matching blocks between two strings
   */
  private getMatchingBlocks(s1: string, s2: string): Array<{ size: number }> {
    const blocks: Array<{ size: number }> = [];
    let i = 0,
      j = 0;

    while (i < s1.length && j < s2.length) {
      if (s1[i] === s2[j]) {
        let size = 1;
        while (i + size < s1.length && j + size < s2.length && s1[i + size] === s2[j + size]) {
          size++;
        }
        blocks.push({ size });
        i += size;
        j += size;
      } else {
        i++;
      }
    }

    return blocks;
  }

  /**
   * Flatten all summaries (handle Zaba multi-results)
   */
  private flattenSummaries(scrapeResults: Record<string, ScrapeResult>): SummaryResult[] {
    const summaries: SummaryResult[] = [];

    for (const result of Object.values(scrapeResults)) {
      if (result.status === "success") {
        summaries.push(...result.summaries);
      }
    }

    return summaries;
  }

  /**
   * Get average confidence score for a group
   */
  private getAverageConfidence(group: DedupGroup): number {
    if (group.members.length === 0) {
      return 0.0;
    }
    const sum = group.members.reduce((total, m) => total + m.match_score, 0);
    return sum / group.members.length;
  }

  /**
   * Helper to get group display info
   */
  getGroupDisplay(group: DedupGroup) {
    const age = this.getMostCommonAge(
      group.members.map((m) => m.summary.age).filter((a) => a !== undefined) as number[]
    );

    return {
      dedup_id: group.dedup_id,
      name: group.members[0]?.summary.full_name || "",
      age: age || undefined,
      age_note: group.age_conflict ? group.age_note : null,
      city: parseAddress(group.members[0]?.summary.address).city,
      state: parseAddress(group.members[0]?.summary.address).state,
      sources: group.members.map((m) => m.summary.broker),
      confidence: Math.round(this.getAverageConfidence(group) * 10) / 10,
      members: group.members.map((m) => ({
        broker: m.summary.broker,
        summary: m.summary,
        match_score: m.match_score,
      })),
    };
  }
}
