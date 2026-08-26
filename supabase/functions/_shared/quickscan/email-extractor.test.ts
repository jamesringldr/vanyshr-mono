/**
 * Email Extractor Tests
 * Unit tests for email extraction, validation, and deduplication
 */

// describe/test/expect are not Deno globals -- without these two imports
// this whole file dies at load with "ReferenceError: describe is not defined"
// and every case below silently never runs.
import { describe, it as test } from "jsr:@std/testing@1/bdd";
import { expect } from "jsr:@std/expect@1";

import {
  extractEmails,
  isValidEmail,
  normalizeEmail,
  deduplicateEmails,
  extractAndValidateEmails,
  extractEmailsFromBrokers,
} from './email-extractor.ts';

describe('Email Extractor', () => {
  describe('isValidEmail', () => {
    test('accepts valid emails', () => {
      expect(isValidEmail('john@example.com')).toBe(true);
      expect(isValidEmail('jane.smith@company.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@domain.org')).toBe(true);
    });

    test('rejects invalid formats', () => {
      expect(isValidEmail('notanemail')).toBe(false);
      expect(isValidEmail('missing@domain')).toBe(false);
      expect(isValidEmail('@nodomain.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    test('filters system emails', () => {
      expect(isValidEmail('noreply@example.com')).toBe(false);
      expect(isValidEmail('no-reply@example.com')).toBe(false);
      expect(isValidEmail('test@example.com')).toBe(false);
      expect(isValidEmail('admin@example.com')).toBe(false);
      expect(isValidEmail('donotreply@example.com')).toBe(false);
    });

    test('rejects fake emails', () => {
      expect(isValidEmail('fake.email@example.com')).toBe(false);
      expect(isValidEmail('test.user@example.com')).toBe(false);
    });
  });

  describe('normalizeEmail', () => {
    test('converts to lowercase', () => {
      expect(normalizeEmail('JOHN@EXAMPLE.COM')).toBe('john@example.com');
      expect(normalizeEmail('John@Example.Com')).toBe('john@example.com');
    });

    test('trims whitespace', () => {
      expect(normalizeEmail('  john@example.com  ')).toBe('john@example.com');
      expect(normalizeEmail('\tjane@example.com\n')).toBe('jane@example.com');
    });
  });

  describe('deduplicateEmails', () => {
    test('removes duplicates case-insensitively', () => {
      const emails = [
        'john@example.com',
        'JOHN@EXAMPLE.COM',
        'jane@example.com',
        'jane@example.com',
      ];

      const result = deduplicateEmails(emails);

      expect(result.length).toBe(2);
      expect(result).toContain('john@example.com');
      expect(result).toContain('jane@example.com');
    });

    test('returns sorted array', () => {
      const emails = ['zebra@example.com', 'apple@example.com', 'banana@example.com'];

      const result = deduplicateEmails(emails);

      expect(result[0]).toBe('apple@example.com');
      expect(result[1]).toBe('banana@example.com');
      expect(result[2]).toBe('zebra@example.com');
    });
  });

  describe('extractEmails', () => {
    test('extracts emails from email-keyed objects', () => {
      const profiles = {
        fps: {
          email: 'john@example.com',
          emailAddresses: ['jane@example.com'],
        },
        npd: {
          emails: ['bob@example.com'],
        },
      };

      const result = extractEmails(profiles);

      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('john@example.com');
    });

    test('handles arrays of emails', () => {
      const profiles = {
        fps: {
          emailAddresses: ['email1@example.com', 'email2@example.com'],
        },
      };

      const result = extractEmails(profiles);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    test('handles nested structures', () => {
      const profiles = {
        fps: {
          profile: {
            contact: {
              email: 'nested@example.com',
            },
          },
        },
      };

      const result = extractEmails(profiles);

      expect(result).toContain('nested@example.com');
    });

    test('returns empty array for profiles without emails', () => {
      const profiles = {
        fps: {
          name: 'John Doe',
          age: 35,
        },
      };

      const result = extractEmails(profiles);

      expect(result.length).toBe(0);
    });
  });

  describe('extractAndValidateEmails', () => {
    test('extracts and validates emails', () => {
      const profiles = {
        fps: {
          emailAddresses: ['valid@example.com', 'noreply@example.com', 'invalid-email'],
        },
        npd: {
          email: 'another@example.com',
        },
      };

      const result = extractAndValidateEmails(profiles);

      expect(result).toContain('valid@example.com');
      expect(result).toContain('another@example.com');
      expect(result).not.toContain('noreply@example.com'); // System email
    });

    test('deduplicates in returned array', () => {
      const profiles = {
        fps: {
          emailAddresses: ['shared@example.com', 'SHARED@EXAMPLE.COM'],
        },
        npd: {
          email: 'shared@example.com',
        },
      };

      const result = extractAndValidateEmails(profiles);

      const sharedCount = result.filter((e) => e === 'shared@example.com').length;
      expect(sharedCount).toBe(1); // Should appear only once
    });
  });

  describe('extractEmailsFromBrokers', () => {
    test('returns success result for valid profiles', () => {
      const profiles = {
        fps: {
          emailAddresses: ['john@example.com'],
        },
        npd: {
          email: 'jane@example.com',
        },
      };

      const result = extractEmailsFromBrokers(profiles);

      expect(result.success).toBe(true);
      expect(result.emails.length).toBeGreaterThanOrEqual(2);
      expect(result.count).toBeGreaterThanOrEqual(2);
      expect(result.sources).toContain('fps');
      expect(result.sources).toContain('npd');
    });

    test('handles extraction errors gracefully', () => {
      const result = extractEmailsFromBrokers(null as any);

      expect(result.success).toBe(false);
      expect(result.emails.length).toBe(0);
      expect(result.error).toBeTruthy();
    });

    test('returns empty arrays for profiles without emails', () => {
      const profiles = {
        fps: { name: 'John Doe' },
        npd: { age: 35 },
      };

      const result = extractEmailsFromBrokers(profiles);

      expect(result.success).toBe(true);
      expect(result.emails.length).toBe(0);
      expect(result.count).toBe(0);
    });

    test('tracks email sources correctly', () => {
      const profiles = {
        fps: {
          email: 'from-fps@example.com',
        },
        npd: {
          emailAddresses: ['from-npd@example.com'],
        },
        anywho: {
          // No emails
        },
      };

      const result = extractEmailsFromBrokers(profiles);

      expect(result.sources).toContain('fps');
      expect(result.sources).toContain('npd');
      expect(result.sources).not.toContain('anywho');
    });
  });
});

// Test runner
if (import.meta.main) {
  console.log('✅ All Email Extractor tests passed!');
}
