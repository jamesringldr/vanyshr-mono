/**
 * Deduplication Engine
 * Ported from Python scraper-lab system
 *
 * Matches profiles across brokers and scores them using:
 * - Name similarity (45 points)
 * - Location match (35 points)
 * - Age compatibility (10 points)
 * - Broker credibility (10 points)
 */

import {
  BrokerName,
  SummaryResult,
  DedupGroup,
  DedupMember,
  ScrapeResult,
  DedupThresholds,
  MatchScoreBreakdown,
} from "./quickscan-phase1-phase2-models.ts";

/**
 * Deduplication and scoring engine
 */
export class DedupEngine {
  // Scoring thresholds
  static readonly MERGE_THRESHOLD = 75; // Merge if score >= this
  static readonly GROUP_THRESHOLD = 50; // Group if score >= this (possible match)

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
   * Calculate match score between two summaries (0-100)
   * Thresholds:
   *   75+: Merge (same person)
   *   50-75: Group (possible match)
   *   <50: Separate (different person)
   */
  calculateMatchScore(summary1: SummaryResult, summary2: SummaryResult): number {
    let score = 0.0;

    // NAME SIMILARITY (45 points) - PRIMARY
    const nameScore = this.compareNames(summary1.full_name, summary2.full_name);
    score += nameScore * 45.0;

    // LOCATION MATCH (35 points) - SECONDARY
    const locationScore = this.compareLocations(summary1, summary2);
    score += locationScore * 35.0;

    // AGE COMPATIBILITY (10 points) - CONTEXTUAL ONLY
    const ageScore = this.compareAges(summary1.age, summary2.age);
    score += ageScore * 10.0;

    // BROKER CREDIBILITY (10 points)
    // For now: all brokers equal weight
    score += 10.0;

    return Math.min(100.0, score); // Cap at 100
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

      // First AND last match
      if (firstName1 === firstName2 && lastName1 === lastName2) {
        return 0.95;
      }

      // First + last initial match
      if (firstName1 === firstName2 && lastName2.startsWith(lastName1[0])) {
        return 0.7;
      }
      if (firstName2 === firstName1 && lastName1.startsWith(lastName2[0])) {
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
   * Compare two locations (0-1 scale)
   */
  private compareLocations(summary1: SummaryResult, summary2: SummaryResult): number {
    const addr1 = summary1.address.toLowerCase().trim();
    const addr2 = summary2.address.toLowerCase().trim();

    // Exact match
    if (addr1 === addr2) {
      return 1.0;
    }

    // Both have addresses
    if (addr1 && addr2) {
      // Parse city, state from "City, State" format
      const parseLocation = (addr: string) => {
        const parts = addr.split(",").map((p) => p.trim());
        return {
          city: parts[0] || "",
          state: parts.length > 1 ? parts[parts.length - 1] : "",
        };
      };

      const loc1 = parseLocation(addr1);
      const loc2 = parseLocation(addr2);

      // Both city and state match
      if (loc1.city.toLowerCase() === loc2.city.toLowerCase() && loc1.state.toLowerCase() === loc2.state.toLowerCase()) {
        return 1.0;
      }

      // City match only (state might be abbreviated differently)
      if (loc1.city.toLowerCase() === loc2.city.toLowerCase()) {
        return 0.8;
      }

      // State match only
      if (loc1.state.toLowerCase() === loc2.state.toLowerCase()) {
        return 0.4;
      }
    }

    // Fuzzy location match
    const ratio = this.sequenceMatchRatio(addr1, addr2);
    return ratio > 0.7 ? 0.7 : ratio > 0.5 ? 0.5 : 0.0;
  }

  /**
   * Compare two ages (0-1 scale)
   */
  private compareAges(age1: number | undefined, age2: number | undefined): number {
    if (!age1 || !age2) {
      return 0.5; // Neutral if missing
    }

    const diff = Math.abs(age1 - age2);

    if (diff === 0) return 1.0; // Exact match
    if (diff <= 1) return 0.95;
    if (diff <= 2) return 0.9;
    if (diff <= 3) return 0.8;
    if (diff <= 5) return 0.6;
    if (diff <= 10) return 0.4;
    return 0.0;
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
      city: group.members[0]?.summary.address.split(",")[0]?.trim() || "",
      state: group.members[0]?.summary.address.split(",")[1]?.trim() || "",
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
