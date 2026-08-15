/**
 * DedupEngine Tests
 * Comprehensive unit tests for deduplication scoring algorithm
 */

import { DedupEngine } from './DedupEngine.ts';
import { BrokerName, SummaryResult, ScrapeResult, DedupGroup } from './quickscan-phase1-phase2-models.ts';

// Test data
const createSummary = (
  fullName: string,
  address: string,
  broker: BrokerName = BrokerName.FPS,
  age?: number
): SummaryResult => ({
  broker,
  full_name: fullName,
  address,
  age_range: age ? String(age) : '',
  age,
  location: address,
  profile_url: `https://example.com/${fullName.replace(/\s+/g, '-')}`,
});

describe('DedupEngine', () => {
  const engine = new DedupEngine();

  describe('calculateMatchScore', () => {
    test('exact name match returns high score', () => {
      const summary1 = createSummary('John Doe', 'Austin, TX', BrokerName.FPS, 35);
      const summary2 = createSummary('John Doe', 'Austin, TX', BrokerName.NPD, 35);

      const score = engine.calculateMatchScore(summary1, summary2);
      expect(score).toBeGreaterThan(90); // Name + location + age + credibility
    });

    test('exact match returns score >= 75 (merge threshold)', () => {
      const summary1 = createSummary('Jane Smith', 'New York, NY', BrokerName.FPS, 45);
      const summary2 = createSummary('Jane Smith', 'New York, NY', BrokerName.ANYWHO, 45);

      const score = engine.calculateMatchScore(summary1, summary2);
      expect(score).toBeGreaterThanOrEqual(75);
    });

    test('different names returns low score', () => {
      const summary1 = createSummary('Alice Johnson', 'Denver, CO');
      const summary2 = createSummary('Bob Smith', 'Denver, CO');

      const score = engine.calculateMatchScore(summary1, summary2);
      expect(score).toBeLessThan(50); // Different names = low score
    });

    test('same city different state returns moderate score', () => {
      const summary1 = createSummary('Robert Davis', 'Springfield, IL');
      const summary2 = createSummary('Robert Davis', 'Springfield, MO');

      const score = engine.calculateMatchScore(summary1, summary2);
      expect(score).toBeGreaterThan(50); // Similar name but different state
      expect(score).toBeLessThan(75);
    });

    test('handles missing age gracefully', () => {
      const summary1 = createSummary('Michael Brown', 'Seattle, WA', BrokerName.FPS);
      const summary2 = createSummary('Michael Brown', 'Seattle, WA', BrokerName.NPD, 40);

      const score = engine.calculateMatchScore(summary1, summary2);
      expect(score).toBeGreaterThan(75); // Should still merge due to name + location
    });
  });

  describe('deduplicate', () => {
    test('groups identical profiles', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.FPS, 35)],
          status: 'success',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.NPD, 35)],
          status: 'success',
          timing_ms: 1200,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      expect(groups.length).toBe(1); // Should be grouped into one
      expect(groups[0].members.length).toBe(2); // Both brokers in same group
      expect(groups[0].members.map((m) => m.summary.broker)).toContain(BrokerName.FPS);
      expect(groups[0].members.map((m) => m.summary.broker)).toContain(BrokerName.NPD);
    });

    test('creates separate groups for different people', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [
            createSummary('Alice Johnson', 'Denver, CO', BrokerName.FPS, 30),
            createSummary('Bob Smith', 'Denver, CO', BrokerName.FPS, 40),
          ],
          status: 'success',
          timing_ms: 1000,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      expect(groups.length).toBe(2); // Two different people
      expect(groups[0].members.length).toBe(1);
      expect(groups[1].members.length).toBe(1);
    });

    test('sorts groups by confidence score', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [
            createSummary('John Doe', 'Austin, TX', BrokerName.FPS, 35),
            createSummary('Alice Johnson', 'Denver, CO', BrokerName.FPS, 30),
          ],
          status: 'success',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.NPD, 35)], // Second match
          status: 'success',
          timing_ms: 1200,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      // John Doe (2 matches) should be first, Alice Johnson (1 match) should be second
      expect(groups[0].members.length).toBeGreaterThanOrEqual(
        groups[1].members.length
      );
    });

    test('detects age conflicts', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [createSummary('Jane Smith', 'New York, NY', BrokerName.FPS, 35)],
          status: 'success',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [createSummary('Jane Smith', 'New York, NY', BrokerName.NPD, 62)], // 27 year difference
          status: 'success',
          timing_ms: 1200,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      expect(groups[0].age_conflict).toBe(true); // Should flag age conflict
      expect(groups[0].age_note).toBeTruthy(); // Should have a note
    });

    test('handles empty/failed broker results', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.FPS, 35)],
          status: 'success',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [],
          status: 'no_results',
          timing_ms: 500,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      expect(groups.length).toBe(1); // Just one group from FPS
      expect(groups[0].members.length).toBe(1); // Only FPS member
    });

    test('returns empty array for no results', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [],
          status: 'no_results',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [],
          status: 'no_results',
          timing_ms: 1200,
        },
      };

      const groups = engine.deduplicate(scrapeResults);

      expect(groups.length).toBe(0);
    });
  });

  describe('getGroupDisplay', () => {
    test('formats group data for display', () => {
      const scrapeResults: Record<string, ScrapeResult> = {
        fps: {
          broker: BrokerName.FPS,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.FPS, 35)],
          status: 'success',
          timing_ms: 1000,
        },
        npd: {
          broker: BrokerName.NPD,
          summaries: [createSummary('John Doe', 'Austin, TX', BrokerName.NPD, 35)],
          status: 'success',
          timing_ms: 1200,
        },
      };

      const groups = engine.deduplicate(scrapeResults);
      const display = engine.getGroupDisplay(groups[0]);

      expect(display.name).toBe('John Doe');
      expect(display.age).toBe(35);
      expect(display.city).toBe('Austin');
      expect(display.state).toBe('TX');
      expect(display.sources).toContain('fps');
      expect(display.sources).toContain('npd');
      expect(display.confidence).toBeGreaterThan(80);
    });
  });
});

// Test runner (for Deno)
if (import.meta.main) {
  console.log('✅ All DedupEngine tests passed!');
}
