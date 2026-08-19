/**
 * QuickScan Phase 1 & 2 Data Models
 * Ported from scraper-lab Python system to TypeScript
 *
 * Phase 1: Summary scraping + deduplication (4 brokers parallel)
 * Phase 2: Full profile enrichment (email extraction + Holehe + Leakcheck)
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum BrokerName {
  FPS = "fps",
  NPD = "npd",
  ANYWHO = "anywho",
  ZABA = "zaba",
}

export type BrokerKey = keyof typeof BrokerName;

// ============================================================================
// PHASE 1: SUMMARY SCRAPING & DEDUPLICATION
// ============================================================================

/**
 * User input for QuickScan search
 */
export interface QuickScanInput {
  first_name: string;
  last_name: string;
  city: string;
  state: string;
  zip?: string;
}

/**
 * Single summary result from a broker
 */
export interface SummaryResult {
  broker: BrokerName;
  full_name: string;
  address: string; // e.g., "Austin, TX"
  age_range: string; // e.g., "37", empty if not available
  age?: number; // Parsed integer
  location: string;
  profile_url: string; // Link to profile detail page
  result_id?: string;
  phone?: string;
  email?: string;
  aliases?: string;
  relatives?: string;
  /** Semicolon-separated former addresses — commas are part of the address. */
  previous_addresses?: string;
}

/**
 * Member of a dedup group (one broker's match)
 */
export interface DedupMember {
  summary: SummaryResult;
  match_score: number; // 0-100
}

/**
 * Group of matched summaries (same person from different brokers)
 */
export interface DedupGroup {
  dedup_id: string; // Unique ID for this group (hash of name, city, state)
  members: DedupMember[];

  // Metadata
  age_conflict: boolean; // Age differs by > 3 years
  age_note?: string; // e.g., "Most sources say 37, one says 61"
}

/**
 * Result from a single broker's scrape
 */
export interface ScrapeResult {
  broker: BrokerName;
  summaries: SummaryResult[];
  status: "success" | "failed" | "no_results";
  error?: string;
  timing_ms: number;
}

/**
 * Output from Phase 1 (summary scraping + deduplication)
 */
export interface SequenceOutput {
  dedup_groups: DedupGroup[];
  raw_results: Record<string, ScrapeResult>;
  metadata: Record<string, unknown>;
}

// ============================================================================
// PHASE 2: FULL PROFILE ENRICHMENT
// ============================================================================

/**
 * Contact information
 */
export interface ContactInfo {
  formatted: string; // Full formatted address
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
}

/**
 * Person relation (relative or associate)
 */
export interface PersonRelation {
  name: string;
  relation?: string; // "spouse", "child", "sibling", etc.
  age?: number;
  address?: string;
}

/**
 * Property record
 */
export interface PropertyRecord {
  address: ContactInfo;
  owner_name?: string;
  property_type?: string;
  estimated_value?: number;
  purchase_date?: string;
  lot_size?: string;
}

/**
 * Data breach record
 */
export interface BreachRecord {
  name: string; // Breach name (e.g., "LinkedIn 2021")
  date?: string; // Date of breach
  exposures?: number; // Number of records exposed
  url?: string; // Breach info URL
}

/**
 * Consolidated profile combining data from all brokers
 */
export interface ConsolidatedProfile {
  // Core identity
  person_id: string;
  full_name: string;
  age?: number;

  // Addresses (deduplicated)
  primary_address?: ContactInfo;
  previous_addresses: ContactInfo[];

  // Contact info (deduplicated)
  phone_numbers: string[];
  emails: string[];

  // Relations
  relatives: PersonRelation[];
  associates: PersonRelation[];

  // Properties
  properties: PropertyRecord[];

  // Enrichment data
  services_found: string[]; // Online services (from Holehe)
  breaches: BreachRecord[]; // Data breaches (from Leakcheck)

  // Raw data (for audit trail)
  raw_profiles: Record<string, unknown>; // Raw profile data from each broker

  // Metadata
  confidence: number; // 0-100
  sources: string[]; // List of broker sources
  metadata: Record<string, unknown>;
}

/**
 * Phase 2 enrichment result
 */
export interface Phase2Result {
  consolidated_profile: ConsolidatedProfile;
  enrichment_data: {
    holehe_services: string[];
    leakcheck_breaches: BreachRecord[];
  };
  metadata: Record<string, unknown>;
}

// ============================================================================
// DATABASE SCHEMAS (for storing results)
// ============================================================================

/**
 * Dedup group record (for storing in database)
 */
export interface DedupGroupRecord {
  id: string; // UUID
  scan_id: string; // Reference to quick_scan
  dedup_id: string; // Hash ID
  rank: number; // Rank in list (1, 2, 3...)
  name: string; // Primary name from group
  age?: number; // Resolved age
  city: string;
  state: string;
  confidence: number; // Average match score
  sources: string[]; // List of brokers
  members_count: number; // Number of members in group
  full_data: Record<string, unknown>; // Full group data as JSONB
  created_at: string; // ISO timestamp
}

/**
 * Phase 2 result record (for storing in database)
 */
export interface Phase2ResultRecord {
  id: string; // UUID
  scan_id: string; // Reference to quick_scan
  dedup_group_id: string; // Reference to dedup group
  consolidated_profile: ConsolidatedProfile; // Full consolidated profile
  holehe_services: string[]; // Services found via Holehe
  leakcheck_breaches: BreachRecord[]; // Breaches found via Leakcheck
  created_at: string; // ISO timestamp
  updated_at: string; // ISO timestamp
}

// ============================================================================
// HELPER TYPES
// ============================================================================

/**
 * Scoring thresholds for deduplication
 */
export interface DedupThresholds {
  MERGE_THRESHOLD: number; // Merge if score >= this (default: 75)
  GROUP_THRESHOLD: number; // Group if score >= this (default: 50)
}

/**
 * Match score breakdown (for debugging)
 */
export interface MatchScoreBreakdown {
  name_score: number; // 0-45 points
  location_score: number; // 0-35 points
  age_score: number; // 0-10 points
  broker_score: number; // 0-10 points
  total: number; // 0-100
}

/**
 * API request for Phase 1
 */
export interface QuickScanRequest {
  firstName: string;
  lastName: string;
  city: string;
  state: string;
}

/**
 * API response for Phase 1
 */
export interface QuickScanResponse {
  success: boolean;
  dedup_groups: Array<{
    dedup_id: string;
    name: string;
    age?: number;
    age_note?: string;
    city: string;
    state: string;
    sources: string[];
    confidence: number;
    members: Array<{
      broker: string;
      summary: SummaryResult;
      match_score: number;
    }>;
  }>;
  metadata: {
    total_time_ms: number;
    phase: string;
    profiles_found: number;
    brokers_scraped: string[];
    phase_timings?: Record<string, number>;
  };
}

/**
 * API request for Phase 2
 */
export interface Phase2Request {
  dedup_group_id: string;
  user_input: QuickScanInput;
}

/**
 * API response for Phase 2
 */
export interface Phase2Response {
  success: boolean;
  consolidated_profile: ConsolidatedProfile;
  enrichment: {
    holehe_services: string[];
    leakcheck_breaches: BreachRecord[];
  };
  metadata: {
    total_time_ms: number;
    phase: string;
    sources: string[];
  };
}
