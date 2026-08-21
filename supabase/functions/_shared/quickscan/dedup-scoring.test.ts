/**
 * DedupEngine scoring — regression tests built from a real production scan.
 * Run: deno test supabase/functions/_shared/quickscan/dedup-scoring.test.ts
 *
 * On 2026-08-20 one person came back as TWO cards: zaba's record grouped
 * alone, and fps/npd/anywho grouped separately. Same street address. The
 * cause was address parsing, not the scoring weights — these tests pin that
 * down so it cannot regress.
 */
import { DedupEngine } from "./DedupEngine.ts";
import { BrokerName, type SummaryResult } from "./quickscan-phase1-phase2-models.ts";

const engine = new DedupEngine();

function summary(
  broker: BrokerName, full_name: string, address: string, age?: number,
): SummaryResult {
  return {
    broker, full_name, address,
    age_range: age ? String(age) : "",
    age,
    location: address,
    profile_url: `https://example.test/${broker}`,
  } as SummaryResult;
}

// The four records exactly as the brokers returned them.
const ZABA   = summary(BrokerName.ZABA,   "James Oehring",   "413 Lovers LN Cameron, Missouri 64429", 37);
const FPS    = summary(BrokerName.FPS,    "James Oehring",   "413 Lovers Ln, Cameron MO 64429", 61);
const NPD    = summary(BrokerName.NPD,    "James Oehring",   "413 Lovers Ln, Cameron, MO", 62);
const ANYWHO = summary(BrokerName.ANYWHO, "James A Oehring", "1225 Union Ave, Apt 502, Kansas City, MO", 37);

Deno.test("THE BUG: zaba and fps now clear the merge threshold", () => {
  const score = engine.calculateMatchScore(ZABA, FPS);
  if (score < DedupEngine.MERGE_THRESHOLD) {
    throw new Error(
      `same street address scored ${score.toFixed(1)}, below merge threshold ` +
      `${DedupEngine.MERGE_THRESHOLD} — this is the two-card bug`,
    );
  }
});

Deno.test("all three same-address records merge with each other", () => {
  for (const [a, b, label] of [[ZABA, FPS, "zaba/fps"], [ZABA, NPD, "zaba/npd"], [FPS, NPD, "fps/npd"]] as const) {
    const score = engine.calculateMatchScore(a, b);
    if (score < DedupEngine.MERGE_THRESHOLD) {
      throw new Error(`${label} scored ${score.toFixed(1)}, expected >= ${DedupEngine.MERGE_THRESHOLD}`);
    }
  }
});

Deno.test("a 24-year age gap lowers the score but does not veto a match", () => {
  // Age is contextual (10 of 100 points) by design -- brokers publish wrong
  // ages constantly, so it must not be able to split a same-address match.
  const withGap = engine.calculateMatchScore(ZABA, FPS);      // 37 vs 61
  const sameAge = engine.calculateMatchScore(ZABA, { ...FPS, age: 37 });
  if (!(sameAge > withGap)) throw new Error("age should still contribute something");
  if (withGap < DedupEngine.MERGE_THRESHOLD) throw new Error("age gap must not veto");
});

Deno.test("different city, same state stays below merge", () => {
  // Kansas City vs Cameron is genuinely weaker evidence. It may still GROUP
  // as a possible match, but must not silently MERGE as certain.
  const score = engine.calculateMatchScore(FPS, ANYWHO);
  if (score >= DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`different cities scored ${score.toFixed(1)} — too eager`);
  }
});

Deno.test("Jim and James at one address are the same person", () => {
  const jim = summary(BrokerName.FPS, "Jim Oehring", "413 Lovers Ln, Cameron, MO", 37);
  const score = engine.calculateMatchScore(ZABA, jim);
  if (score < DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`Jim/James scored ${score.toFixed(1)}, below merge threshold`);
  }
});

Deno.test("LN vs Lane does not break the match", () => {
  const spelledOut = summary(BrokerName.NPD, "James Oehring", "413 Lovers Lane, Cameron, MO", 37);
  const score = engine.calculateMatchScore(ZABA, spelledOut);
  if (score < DedupEngine.MERGE_THRESHOLD) throw new Error(`scored ${score.toFixed(1)}`);
});

Deno.test("genuinely different people still separate", () => {
  const other = summary(BrokerName.FPS, "Susan Delgado", "88 Ocean Blvd, Miami, FL 33139", 44);
  const score = engine.calculateMatchScore(ZABA, other);
  if (score >= DedupEngine.GROUP_THRESHOLD) {
    throw new Error(`unrelated people scored ${score.toFixed(1)} — too loose`);
  }
});

Deno.test("end-to-end: one group, not two", () => {
  const groups = engine.deduplicate({
    zaba: { broker: BrokerName.ZABA, summaries: [ZABA], status: "success", timing_ms: 1 },
    fps:  { broker: BrokerName.FPS,  summaries: [FPS],  status: "success", timing_ms: 1 },
    npd:  { broker: BrokerName.NPD,  summaries: [NPD],  status: "success", timing_ms: 1 },
  } as never);

  if (groups.length !== 1) {
    throw new Error(`expected 1 group for one person, got ${groups.length}`);
  }
  if (groups[0].members.length !== 3) {
    throw new Error(`expected 3 members, got ${groups[0].members.length}`);
  }
  if (!groups[0].age_conflict) {
    throw new Error("37/61/62 must still be flagged as an age conflict");
  }
});
