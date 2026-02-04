// Deno-compatible Base Scraper for Edge Functions
import { DOMParser } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

// ============================================================================
// NEW JSONB Schema Types (for quick_scans table)
// ============================================================================

/**
 * Profile match for disambiguation - when multiple people match a search
 * Stored in quick_scans.profile_matches JSONB array
 */
export interface ProfileMatch {
  id: string;                    // Unique ID for this match (e.g., "aw-1", "zaba-2")
  name: string;                  // Full name
  age?: string;                  // Age if available
  city_state?: string;           // Location summary (e.g., "New York, NY")
  phone_snippet?: string;        // Masked phone (e.g., "(***) ***-1234")
  detail_link?: string;          // URL to fetch full details
  source: string;                // Scraper source (e.g., "AnyWho", "Zabasearch")
  match_score?: number;          // Optional confidence score 0-100
  // Optional: Full profile data for scrapers that already have it (e.g., ZabaSearch)
  fullProfile?: PersonProfile;
}

/**
 * Full profile data stored in quick_scans.profile_data JSONB
 * This is the consolidated format for ALL scraped data
 */
export interface QuickScanProfileData {
  // Identity
  name: string;
  first_name?: string;
  last_name?: string;
  middle_name?: string;
  age?: string;
  date_of_birth?: string;
  gender?: string;

  // Contact - Phones
  phones: Array<{
    number: string;
    type?: string;              // "mobile", "landline", "unknown"
    provider?: string;          // "Verizon", "AT&T", etc.
    is_primary?: boolean;
    first_reported?: string;
  }>;

  // Contact - Emails
  emails: Array<{
    email: string;
    type?: string;              // "personal", "work", "unknown"
  }>;

  // Addresses
  addresses: Array<{
    full_address?: string;
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    is_current?: boolean;
    years_lived?: string;
    move_in_date?: string;
    property_type?: string;     // "Single Family", "Apartment", etc.
    // Property details (if available)
    property?: {
      beds?: number;
      baths?: number;
      sq_ft?: number;
      lot_sq_ft?: number;
      year_built?: string;
      estimated_value?: string;
      subdivision?: string;
    };
  }>;

  // Relationships
  relatives: Array<{
    name: string;
    relationship?: string;      // "spouse", "child", "parent", "sibling", etc.
    age?: string;
    gender?: string;
  }>;

  // Alternative Names
  aliases: string[];            // Simple array of alias strings

  // Employment
  jobs: Array<{
    company?: string;
    title?: string;
    location?: string;
    is_current?: boolean;
    start_date?: string;
    end_date?: string;
    duration?: string;
  }>;

  // Education
  education: Array<{
    school?: string;
    degree?: string;
    field_of_study?: string;
    dates?: string;
  }>;

  // Social/Online Presence
  social_profiles: Array<{
    platform: string;           // "LinkedIn", "Facebook", "Twitter", etc.
    url?: string;
    handle?: string;
    match_confidence?: string;
  }>;

  // Records
  legal_records: Array<{
    record_type?: string;
    description?: string;
    location?: string;
    date?: string;
    count?: number;
  }>;

  background_records: Array<{
    record_type?: string;       // "Birth Record", "Marriage", "Death", etc.
    description?: string;
    date?: string;
    location?: string;
  }>;

  // Assets
  assets: Array<{
    type?: string;              // "Property", "Vehicle", etc.
    description?: string;
    count?: number;
    estimated_value?: string;
  }>;

  // Metadata
  scraped_at: string;           // ISO timestamp
  sources: string[];            // Array of scraper sources that contributed
  detail_link?: string;         // URL where full details were scraped from
}

/**
 * Scraper run result - tracks what happened during a scrape
 */
export interface ScraperRunResult {
  scraper: string;              // Scraper name
  status: "success" | "failed" | "blocked" | "no_results";
  profiles_found?: number;
  duration_ms?: number;
  error?: string;
}

// ============================================================================
// LEGACY Types (for backwards compatibility during migration)
// @deprecated - Use QuickScanProfileData instead
// ============================================================================

/** @deprecated Use ProfileMatch for search results, QuickScanProfileData for full details */
export interface PersonProfile {
  id: string;
  name: string;
  age?: string;
  phone_snippet?: string;
  city_state?: string;
  detail_link?: string;

  // qs_phones
  phones?: Array<{
    number: string;
    type?: string;
    provider?: string;
    primary?: boolean;
  }>;

  // qs_emails
  emails?: Array<{ email: string; type?: string }>;

  // qs_addresses
  addresses?: Array<{
    address?: string;
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    full_address?: string;
    years_lived?: string;
    is_last_known?: boolean;
    type?: string;
    property_type?: string;
  }>;

  // qs_relatives
  relatives?: Array<{
    name: string;
    relationship?: string;
    age?: string;
    gender?: string;
  }>;

  // qs_aliases
  aliases?: Array<{ alias: string }>;

  // qs_jobs
  jobs?: Array<{
    company?: string;
    title?: string;
    location?: string;
    current?: boolean;
    duration?: string;
    since?: string;
    date_range?: string;
  }>;

  // qs_education (FPS-specific)
  education?: Array<{
    school?: string;
    degree?: string;
    dates?: string;
  }>;

  // qs_current_address_spec (FPS-specific)
  current_address_spec?: {
    street?: string;
    street2?: string;
    city?: string;
    state?: string;
    zip?: string;
    county?: string;
    subdivision?: string;
    beds?: number;
    baths?: number;
    sq_ft?: number;
    lot_sq_ft?: number;
    yr_built?: string;
    est_value?: string;
  };

  // qs_socials
  online_presence?: Array<{
    platform: string;
    handle?: string;
    match_reason?: string;
    url?: string;
  }>;

  // qs_relatives (merged with family_records)
  family_records?: Array<{ name: string; age?: string; gender?: string }>;

  // qs_legal_records
  legal_records?: Array<{
    record_type?: string;
    record_count?: number;
    record_location?: string;
    description?: string;
  }>;

  // qs_gov_records
  background_records?: Array<{
    record_type?: string;
    description?: string;
    event_date?: string;
    location?: string;
  }>;

  // qs_professional
  professional_records?: Array<{
    company?: string;
    title?: string;
    location?: string;
    date_range?: string;
    record_type?: string;
    description?: string;
  }>;

  // qs_assets
  assets?: Array<{
    asset_count?: string;
    value?: string;
  }>;

  // pre_profiles fields
  current_phone?: string;
  additional_numbers?: string[];
  current_address?: string;
  past_addresses?: string[];

  source: string;
}

// ============================================================================
// Conversion Utilities
// ============================================================================

/**
 * Convert legacy PersonProfile to new QuickScanProfileData format
 */
export function convertToQuickScanProfileData(
  profile: PersonProfile,
  additionalSources: string[] = []
): QuickScanProfileData {
  const sources = [profile.source, ...additionalSources].filter(Boolean);

  // Parse name parts
  const nameParts = profile.name.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined;
  const middleName = nameParts.length > 2 ? nameParts.slice(1, -1).join(" ") : undefined;

  return {
    name: profile.name,
    first_name: firstName,
    last_name: lastName,
    middle_name: middleName,
    age: profile.age,

    phones: (profile.phones || []).map(p => ({
      number: p.number,
      type: p.type,
      provider: p.provider,
      is_primary: p.primary,
    })),

    emails: (profile.emails || []).map(e => ({
      email: e.email,
      type: e.type,
    })),

    addresses: (profile.addresses || []).map(a => ({
      full_address: a.full_address || a.address,
      street: a.street,
      street2: a.street2,
      city: a.city,
      state: a.state,
      zip: a.zip,
      county: a.county,
      is_current: a.is_last_known,
      years_lived: a.years_lived,
      property_type: a.property_type,
      property: profile.current_address_spec && a.is_last_known ? {
        beds: profile.current_address_spec.beds,
        baths: profile.current_address_spec.baths,
        sq_ft: profile.current_address_spec.sq_ft,
        lot_sq_ft: profile.current_address_spec.lot_sq_ft,
        year_built: profile.current_address_spec.yr_built,
        estimated_value: profile.current_address_spec.est_value,
        subdivision: profile.current_address_spec.subdivision,
      } : undefined,
    })),

    relatives: [
      ...(profile.relatives || []),
      ...(profile.family_records || []).map(f => ({
        name: f.name,
        age: f.age,
        gender: f.gender,
      })),
    ],

    aliases: (profile.aliases || []).map(a => a.alias),

    jobs: (profile.jobs || []).map(j => ({
      company: j.company,
      title: j.title,
      location: j.location,
      is_current: j.current,
      start_date: j.since,
      duration: j.duration || j.date_range,
    })),

    education: (profile.education || []).map(e => ({
      school: e.school,
      degree: e.degree,
      dates: e.dates,
    })),

    social_profiles: (profile.online_presence || []).map(s => ({
      platform: s.platform,
      url: s.url,
      handle: s.handle,
      match_confidence: s.match_reason,
    })),

    legal_records: (profile.legal_records || []).map(r => ({
      record_type: r.record_type,
      description: r.description,
      location: r.record_location,
      count: r.record_count,
    })),

    background_records: (profile.background_records || []).map(r => ({
      record_type: r.record_type,
      description: r.description,
      date: r.event_date,
      location: r.location,
    })),

    assets: (profile.assets || []).map(a => ({
      count: a.asset_count ? parseInt(a.asset_count) : undefined,
      estimated_value: a.value,
    })),

    scraped_at: new Date().toISOString(),
    sources: sources,
    detail_link: profile.detail_link,
  };
}

/**
 * Convert PersonProfile to ProfileMatch for disambiguation
 */
export function convertToProfileMatch(profile: PersonProfile): ProfileMatch {
  return {
    id: profile.id,
    name: profile.name,
    age: profile.age,
    city_state: profile.city_state,
    phone_snippet: profile.phone_snippet,
    detail_link: profile.detail_link,
    source: profile.source,
  };
}

/**
 * Create an empty QuickScanProfileData structure
 */
export function createEmptyProfileData(): QuickScanProfileData {
  return {
    name: "",
    phones: [],
    emails: [],
    addresses: [],
    relatives: [],
    aliases: [],
    jobs: [],
    education: [],
    social_profiles: [],
    legal_records: [],
    background_records: [],
    assets: [],
    scraped_at: new Date().toISOString(),
    sources: [],
  };
}

/**
 * Merge multiple QuickScanProfileData objects into one
 * Used when combining results from multiple scrapers
 */
export function mergeProfileData(
  profiles: QuickScanProfileData[]
): QuickScanProfileData {
  if (profiles.length === 0) return createEmptyProfileData();
  if (profiles.length === 1) return profiles[0];

  const merged = createEmptyProfileData();
  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const seenAddresses = new Set<string>();
  const seenRelatives = new Set<string>();
  const seenAliases = new Set<string>();

  for (const profile of profiles) {
    // Use first non-empty name
    if (!merged.name && profile.name) merged.name = profile.name;
    if (!merged.first_name && profile.first_name) merged.first_name = profile.first_name;
    if (!merged.last_name && profile.last_name) merged.last_name = profile.last_name;
    if (!merged.age && profile.age) merged.age = profile.age;
    if (!merged.date_of_birth && profile.date_of_birth) merged.date_of_birth = profile.date_of_birth;
    if (!merged.gender && profile.gender) merged.gender = profile.gender;

    // Merge phones (dedupe by number)
    for (const phone of profile.phones) {
      const normalized = phone.number.replace(/\D/g, "");
      if (!seenPhones.has(normalized)) {
        seenPhones.add(normalized);
        merged.phones.push(phone);
      }
    }

    // Merge emails (dedupe by email)
    for (const email of profile.emails) {
      const normalized = email.email.toLowerCase();
      if (!seenEmails.has(normalized)) {
        seenEmails.add(normalized);
        merged.emails.push(email);
      }
    }

    // Merge addresses (dedupe by full_address or street+city)
    for (const addr of profile.addresses) {
      const key = addr.full_address?.toLowerCase() ||
                  `${addr.street}-${addr.city}`.toLowerCase();
      if (!seenAddresses.has(key)) {
        seenAddresses.add(key);
        merged.addresses.push(addr);
      }
    }

    // Merge relatives (dedupe by name)
    for (const rel of profile.relatives) {
      const key = rel.name.toLowerCase();
      if (!seenRelatives.has(key)) {
        seenRelatives.add(key);
        merged.relatives.push(rel);
      }
    }

    // Merge aliases (dedupe)
    for (const alias of profile.aliases) {
      const key = alias.toLowerCase();
      if (!seenAliases.has(key)) {
        seenAliases.add(key);
        merged.aliases.push(alias);
      }
    }

    // Merge jobs, education, social_profiles, records (simple concat for now)
    merged.jobs.push(...profile.jobs);
    merged.education.push(...profile.education);
    merged.social_profiles.push(...profile.social_profiles);
    merged.legal_records.push(...profile.legal_records);
    merged.background_records.push(...profile.background_records);
    merged.assets.push(...profile.assets);

    // Merge sources
    for (const source of profile.sources) {
      if (!merged.sources.includes(source)) {
        merged.sources.push(source);
      }
    }
  }

  merged.scraped_at = new Date().toISOString();
  return merged;
}

// ============================================================================
// Scraping Strategy Interfaces
// ============================================================================

/**
 * Search type for scrapers
 */
export type SearchType = "name" | "phone" | "email" | "address";

/**
 * Search input parameters
 */
export interface SearchInput {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
}

/**
 * Scraping strategy interface - defines what a scraper must implement
 */
export interface ScrapingStrategy {
  name: string;

  /** What search types this scraper supports */
  supportedSearchTypes: SearchType[];

  /**
   * Search for profiles (returns matches for disambiguation)
   * @deprecated Use searchProfiles instead
   */
  scrape(
    firstName: string,
    lastName: string,
    city?: string,
    state?: string,
  ): Promise<PersonProfile[]>;

  /**
   * NEW: Search for profiles with flexible input
   * Returns ProfileMatch[] for user disambiguation
   */
  searchProfiles?(input: SearchInput): Promise<ProfileMatch[]>;

  /**
   * Scrape full details from a profile URL
   * @deprecated Use scrapeFullProfile instead
   */
  scrapeDetails?(url: string): Promise<PersonProfile | null>;

  /**
   * NEW: Scrape full profile data in JSONB format
   */
  scrapeFullProfile?(url: string, selectedProfile?: Partial<PersonProfile>): Promise<QuickScanProfileData | null>;
}

// ============================================================================
// Base Class for Shared Logic
// ============================================================================

export abstract class BaseScraper implements ScrapingStrategy {
  abstract name: string;
  abstract supportedSearchTypes: SearchType[];

  /**
   * @deprecated Use searchProfiles instead
   */
  abstract scrape(
    firstName: string,
    lastName: string,
    city?: string,
    state?: string,
  ): Promise<PersonProfile[]>;

  /**
   * NEW: Search for profiles with flexible input
   * Default implementation calls legacy scrape() and converts results
   */
  async searchProfiles(input: SearchInput): Promise<ProfileMatch[]> {
    const profiles = await this.scrape(
      input.first_name || "",
      input.last_name || "",
      input.city,
      input.state
    );
    return profiles.map(convertToProfileMatch);
  }

  /**
   * NEW: Scrape full profile data in JSONB format
   * Default implementation calls legacy scrapeDetails() and converts
   */
  async scrapeFullProfile(url: string): Promise<QuickScanProfileData | null> {
    if (this.scrapeDetails) {
      const profile = await this.scrapeDetails(url);
      if (profile) {
        return convertToQuickScanProfileData(profile);
      }
    }
    return null;
  }

  /**
   * Optional: Legacy detail scraping (to be overridden by subclasses)
   */
  scrapeDetails?(url: string): Promise<PersonProfile | null>;

  // --------------------------------------------------------------------------
  // Utility Methods
  // --------------------------------------------------------------------------

  protected formatNameForUrl(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
  }

  protected parseHtml(html: string): any {
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
  }

  /**
   * Mask a phone number for display (e.g., "(***) ***-1234")
   */
  protected maskPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(***) ***-${cleaned.slice(-4)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(***) ***-${cleaned.slice(-4)}`;
    }
    return phone;
  }

  /**
   * Format phone number consistently
   */
  protected formatPhone(phone: string): string {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    if (cleaned.length === 11 && cleaned.startsWith("1")) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }

  /**
   * State abbreviation to full name mapping
   */
  protected static stateNames: { [key: string]: string } = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas",
    CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
    DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii",
    ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
    KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine",
    MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
    MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska",
    NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
    NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
    OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
    SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas",
    UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
    WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  };

  /**
   * State full name to abbreviation mapping
   */
  protected static stateAbbreviations: { [key: string]: string } = {
    "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
    "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
    "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
    "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
    "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
    "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
    "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
    "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
    "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
    "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
    "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
    "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
    "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  };

  /**
   * Convert state abbreviation to full name
   */
  protected getStateName(abbr: string): string {
    return BaseScraper.stateNames[abbr.toUpperCase()] || abbr;
  }

  /**
   * Convert state name to abbreviation
   */
  protected getStateAbbr(name: string): string {
    return BaseScraper.stateAbbreviations[name.toLowerCase()] || name;
  }
}






