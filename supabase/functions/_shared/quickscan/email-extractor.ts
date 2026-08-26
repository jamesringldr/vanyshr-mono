/**
 * Email Extractor
 * Extracts emails from broker profile data, validates, and deduplicates
 */

/**
 * Email validation regex (simple but effective)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * System email patterns to exclude (test accounts, noreply, etc.)
 */
const EXCLUDED_EMAIL_PATTERNS = [
  /^noreply@/i,
  /^no-reply@/i,
  /^donotreply@/i,
  /^test[._@-]/i,
  /^demo@/i,
  /^admin@/i,
  /^info@/i,
  /^support@/i,
  /^contact@/i,
  /^hello@/i,
  /^fake/i,
  /^example\./i,
  /^localhost/i,
  /127\.0\.0\.1/,
];

/**
 * Extract emails from broker profile data
 * @param profiles Object with broker names as keys and profile data as values
 * @returns Deduplicated array of valid email addresses
 */
export function extractEmails(profiles: Record<string, unknown>): string[] {
  const emailSet = new Set<string>();

  for (const [broker, profileData] of Object.entries(profiles)) {
    if (!profileData || typeof profileData !== "object") {
      continue;
    }

    const emails = extractFromProfile(profileData as Record<string, unknown>);
    for (const email of emails) {
      emailSet.add(email.toLowerCase());
    }
  }

  // Convert to array and sort
  return Array.from(emailSet).sort();
}

/**
 * Extract emails from a single profile object (recursive)
 * @param profile Profile data object
 * @param maxDepth Maximum recursion depth
 * @returns Array of valid emails found
 */
function extractFromProfile(profile: Record<string, unknown>, maxDepth = 5): string[] {
  if (maxDepth <= 0) {
    return [];
  }

  const emails: string[] = [];

  for (const [key, value] of Object.entries(profile)) {
    // Check if this key looks like it contains email data
    const keyLower = key.toLowerCase();
    if (keyLower.includes("email") || keyLower.includes("mail")) {
      emails.push(...extractFromValue(value));
    }

    // Recursively search nested objects (but not too deep)
    if (maxDepth > 1 && typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "object" && item !== null) {
            emails.push(...extractFromProfile(item as Record<string, unknown>, maxDepth - 1));
          }
        }
      } else {
        emails.push(...extractFromProfile(value as Record<string, unknown>, maxDepth - 1));
      }
    }
  }

  return emails;
}

/**
 * Extract emails from a value (string, array, etc.)
 * @param value Value to extract emails from
 * @returns Array of valid emails
 */
function extractFromValue(value: unknown): string[] {
  const emails: string[] = [];

  if (typeof value === "string") {
    if (isValidEmail(value)) {
      emails.push(value);
    }
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" && isValidEmail(item)) {
        emails.push(item);
      }
    }
  }

  return emails;
}

/**
 * Validate email address
 * @param email Email to validate
 * @returns True if email is valid
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== "string") {
    return false;
  }

  email = email.trim();

  // Check basic format
  if (!EMAIL_REGEX.test(email)) {
    return false;
  }

  // Check excluded patterns
  for (const pattern of EXCLUDED_EMAIL_PATTERNS) {
    if (pattern.test(email)) {
      return false;
    }
  }

  // Reject if too short or too long
  if (email.length < 5 || email.length > 254) {
    return false;
  }

  return true;
}

/**
 * Normalize email for deduplication (lowercase, trim)
 * @param email Email to normalize
 * @returns Normalized email
 */
/**
 * Cyrillic characters that render identically to Latin ones. A broker page
 * carrying one of these produces an address that looks the same on screen but
 * is a different string -- which is how ja_studly@hotmail.com showed up twice.
 *
 * Must stay in sync with CYRILLIC_TO_LATIN in
 * apps/app/src/pages/pilot-scan/email-confirmation.tsx.
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  "\u0430": "a", "\u0435": "e", "\u043e": "o", "\u0440": "p", "\u0441": "c",
  "\u0443": "y", "\u0445": "x", "\u0456": "i", "\u0455": "s", "\u04bb": "h",
  "\u0501": "d", "\u04cf": "l", "\u217f": "m",
};

export function normalizeEmail(email: string): string {
  return email
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/mailto:/g, "")
    // Fold look-alikes to their Latin equivalent BEFORE stripping. Stripping
    // first turns ja_studly@ into j_studly@ -- a different, wrong address --
    // instead of collapsing the two variants onto one.
    .replace(/[\u0400-\u04FF\u2100-\u218F]/g, (ch) => CYRILLIC_TO_LATIN[ch] ?? "")
    .replace(/[^a-z0-9@._+-]/g, "");
}

/**
 * Deduplicate emails (case-insensitive, hidden chars stripped)
 */
export function deduplicateEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const email of emails) {
    if (!email || typeof email !== "string") continue;
    const key = normalizeEmail(email);
    if (!key.includes("@") || !key.includes(".") || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out.sort();
}

/**
 * Extract and validate emails from profiles
 * @param profiles Object with broker names as keys
 * @returns Deduplicated, validated emails
 */
export function extractAndValidateEmails(profiles: Record<string, unknown>): string[] {
  const emails = extractEmails(profiles);
  return deduplicateEmails(emails.filter(isValidEmail));
}

/**
 * Email extraction result
 */
export interface EmailExtractionResult {
  success: boolean;
  emails: string[];
  count: number;
  sources: string[]; // which brokers provided emails
  error?: string;
}

/**
 * Extract emails from multiple broker profiles
 * @param profiles Object with broker names as keys
 * @returns Extraction result
 */
export function extractEmailsFromBrokers(profiles: Record<string, unknown>): EmailExtractionResult {
  try {
    const emails = extractAndValidateEmails(profiles);

    // Track which brokers provided emails
    const sources: string[] = [];
    const emailSet = new Set(emails);

    for (const [broker, profileData] of Object.entries(profiles)) {
      if (!profileData || typeof profileData !== "object") {
        continue;
      }

      const brokerEmails = extractFromProfile(profileData as Record<string, unknown>);
      for (const email of brokerEmails) {
        if (emailSet.has(normalizeEmail(email))) {
          if (!sources.includes(broker)) {
            sources.push(broker);
          }
          break;
        }
      }
    }

    return {
      success: true,
      emails: emails,
      count: emails.length,
      sources: sources,
    };
  } catch (error) {
    console.error("Email extraction error:", error);
    return {
      success: false,
      emails: [],
      count: 0,
      sources: [],
      error: (error as Error).message,
    };
  }
}
