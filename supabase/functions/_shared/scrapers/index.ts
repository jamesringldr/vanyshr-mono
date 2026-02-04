// Scraper Router - Central export point for all scrapers
import {
  PersonProfile,
  ProfileMatch,
  QuickScanProfileData,
  ScrapingStrategy,
  SearchInput,
  SearchType,
  ScraperRunResult,
  convertToQuickScanProfileData,
  convertToProfileMatch,
  mergeProfileData,
  createEmptyProfileData,
} from "./BaseScraper.ts";
import { AnyWhoScraper } from "./AnyWhoScraper.ts";
import { ZabasearchScraper } from "./ZabasearchScraper.ts";

// Re-export types
export type {
  PersonProfile,
  ProfileMatch,
  QuickScanProfileData,
  ScrapingStrategy,
  SearchInput,
  SearchType,
  ScraperRunResult,
} from "./BaseScraper.ts";

// Re-export utility functions
export {
  convertToQuickScanProfileData,
  convertToProfileMatch,
  mergeProfileData,
  createEmptyProfileData,
} from "./BaseScraper.ts";

// Debug helper
export function getScraperDebugInfo(): any {
  return {
    availableScrapers: Object.keys(scrapers),
  };
}

// Scraper registry - AnyWho and Zabasearch only
const scrapers: { [key: string]: ScrapingStrategy } = {
  anywho: new AnyWhoScraper(),
  zabasearch: new ZabasearchScraper(),
};

/**
 * Get a scraper by name (case-insensitive)
 */
export function getScraper(siteName: string): ScrapingStrategy | null {
  return scrapers[siteName.toLowerCase()] || null;
}

/**
 * Get list of available scraper names
 */
export function getAvailableScrapers(): string[] {
  return Object.keys(scrapers);
}

/**
 * Main scrape function - routes to the appropriate scraper
 */
export async function scrape(
  siteName: string,
  firstName: string,
  lastName: string,
  city?: string,
  state?: string,
): Promise<PersonProfile[]> {
  console.log(`🔍 ScraperRouter.scrape() called with:`, {
    siteName,
    firstName,
    lastName,
    city,
    state,
    availableSites: Object.keys(scrapers),
  });

  const scraper = getScraper(siteName);

  if (!scraper) {
    console.error(`❌ No scraper found for site: ${siteName}. Available: ${Object.keys(scrapers).join(", ")}`);
    return [];
  }

  console.log(`🚀 Starting scrape for ${siteName} -> ${firstName} ${lastName}, ${city || "no city"}, ${state || "no state"}`);

  try {
    const profiles = await scraper.scrape(firstName, lastName, city, state);
    console.log(`✅ ${siteName} returned ${profiles.length} profiles`);
    return profiles;
  } catch (error) {
    console.error(`❌ ${siteName} scrape error:`, error);
    return [];
  }
}

/**
 * Detail scrape function - routes to the appropriate scraper
 */
export async function scrapeDetails(
  siteName: string,
  url: string,
): Promise<PersonProfile | null> {
  const scraper = getScraper(siteName);

  if (!scraper) {
    console.error(`❌ No scraper found for site: ${siteName}`);
    return null;
  }

  if ("scrapeDetails" in scraper && typeof scraper.scrapeDetails === "function") {
    return await scraper.scrapeDetails(url);
  }

  console.warn(`⚠️ Scraper ${siteName} does not support detail scraping`);
  return null;
}

// ============================================================================
// JSONB-Based Functions
// ============================================================================

/**
 * Get scrapers that support a specific search type
 */
export function getScrapersForSearchType(searchType: SearchType): ScrapingStrategy[] {
  return Object.values(scrapers).filter(s => s.supportedSearchTypes.includes(searchType));
}

/**
 * Search for profiles using the JSONB interface
 * Returns ProfileMatch[] for user disambiguation
 */
export async function searchProfiles(
  siteName: string,
  input: SearchInput
): Promise<ProfileMatch[]> {
  const scraper = getScraper(siteName);

  if (!scraper) {
    console.error(`❌ No scraper found for site: ${siteName}`);
    return [];
  }

  console.log(`🔍 ScraperRouter.searchProfiles() - ${siteName}:`, input);

  try {
    if (scraper.searchProfiles) {
      const matches = await scraper.searchProfiles(input);
      console.log(`✅ ${siteName} returned ${matches.length} profile matches`);
      return matches;
    } else {
      // Fallback to legacy scrape method
      const profiles = await scraper.scrape(
        input.first_name || "",
        input.last_name || "",
        input.city,
        input.state
      );
      return profiles.map(convertToProfileMatch);
    }
  } catch (error) {
    console.error(`❌ ${siteName} searchProfiles error:`, error);
    return [];
  }
}

/**
 * Search across multiple scrapers in parallel
 * Returns combined ProfileMatch[] with source info
 */
export async function searchProfilesMulti(
  siteNames: string[],
  input: SearchInput
): Promise<{ matches: ProfileMatch[]; runs: ScraperRunResult[] }> {
  console.log(`🔍 ScraperRouter.searchProfilesMulti() - Sites: ${siteNames.join(", ")}`);

  const runs: ScraperRunResult[] = [];
  const allMatches: ProfileMatch[] = [];

  const promises = siteNames.map(async (siteName) => {
    const startTime = Date.now();
    try {
      const matches = await searchProfiles(siteName, input);
      runs.push({
        scraper: siteName,
        status: matches.length > 0 ? "success" : "no_results",
        profiles_found: matches.length,
        duration_ms: Date.now() - startTime,
      });
      return matches;
    } catch (error) {
      runs.push({
        scraper: siteName,
        status: "failed",
        duration_ms: Date.now() - startTime,
        error: (error as Error).message,
      });
      return [];
    }
  });

  const results = await Promise.all(promises);
  results.forEach(matches => allMatches.push(...matches));

  // Deduplicate by name + city_state
  const seen = new Set<string>();
  const uniqueMatches = allMatches.filter(m => {
    const key = `${m.name?.toLowerCase()}-${m.city_state?.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`✅ Multi-search complete: ${uniqueMatches.length} unique matches from ${siteNames.length} scrapers`);
  return { matches: uniqueMatches, runs };
}

/**
 * Scrape full profile data in JSONB format
 */
export async function scrapeFullProfile(
  siteName: string,
  url: string,
  selectedProfile?: Partial<PersonProfile>
): Promise<QuickScanProfileData | null> {
  const scraper = getScraper(siteName);

  if (!scraper) {
    console.error(`❌ No scraper found for site: ${siteName}`);
    return null;
  }

  console.log(`🔍 ScraperRouter.scrapeFullProfile() - ${siteName}: ${url}`);

  try {
    if (scraper.scrapeFullProfile) {
      const profileData = await scraper.scrapeFullProfile(url, selectedProfile);
      console.log(`✅ ${siteName} returned profile data`);
      return profileData;
    } else if (scraper.scrapeDetails) {
      // Fallback to legacy scrapeDetails and convert
      const profile = await scraper.scrapeDetails(url);
      if (profile) {
        return convertToQuickScanProfileData(profile);
      }
    }
    return null;
  } catch (error) {
    console.error(`❌ ${siteName} scrapeFullProfile error:`, error);
    return null;
  }
}

/**
 * Scrape full profile from multiple sources and merge
 * Useful when we have detail links from multiple scrapers
 */
export async function scrapeAndMergeProfiles(
  detailLinks: Array<{ siteName: string; url: string }>
): Promise<QuickScanProfileData | null> {
  console.log(`🔍 ScraperRouter.scrapeAndMergeProfiles() - ${detailLinks.length} sources`);

  const profiles: QuickScanProfileData[] = [];

  const promises = detailLinks.map(async ({ siteName, url }) => {
    const profile = await scrapeFullProfile(siteName, url);
    if (profile) profiles.push(profile);
  });

  await Promise.all(promises);

  if (profiles.length === 0) return null;
  if (profiles.length === 1) return profiles[0];

  // Merge all profiles
  return mergeProfileData(profiles);
}

// ============================================================================
// Legacy Interface (for backward compatibility)
// ============================================================================

export class UniversalPeopleScraper {
  async scrape(
    siteName: string,
    firstName: string,
    lastName: string,
    city?: string,
    state?: string,
  ): Promise<PersonProfile[]> {
    return scrape(siteName, firstName, lastName, city, state);
  }

  async scrapeDetails(siteName: string, url: string): Promise<PersonProfile | null> {
    return scrapeDetails(siteName, url);
  }

  async searchProfiles(siteName: string, input: SearchInput): Promise<ProfileMatch[]> {
    return searchProfiles(siteName, input);
  }

  async scrapeFullProfile(siteName: string, url: string): Promise<QuickScanProfileData | null> {
    return scrapeFullProfile(siteName, url);
  }

  getAvailableSites(): string[] {
    return getAvailableScrapers();
  }

  getScrapersForSearchType(searchType: SearchType): string[] {
    return getScrapersForSearchType(searchType).map(s => s.name);
  }
}

export const universalPeopleScraper = new UniversalPeopleScraper();
