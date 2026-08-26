/**
 * DedupEngine scoring + reference matching.
 * Run: deno test supabase/functions/_shared/quickscan/dedup-scoring.test.ts
 *
 * Fixtures match the four brokers' real records for James Oehring, including
 * the signals that actually distinguish him: shared phone, shared relative,
 * and 413 Lovers Ln in AnyWho's address *history* (current listing is KC).
 */
import { DedupEngine } from "./DedupEngine.ts";
import { BrokerName, type SummaryResult } from "./quickscan-phase1-phase2-models.ts";

const engine = new DedupEngine();

function summary(opts: {
  broker: BrokerName;
  full_name: string;
  address: string;
  age?: number;
  phone?: string;
  relatives?: string;
  previous_addresses?: string;
}): SummaryResult {
  return {
    broker: opts.broker,
    full_name: opts.full_name,
    address: opts.address,
    age_range: opts.age ? String(opts.age) : "",
    age: opts.age,
    location: opts.address,
    profile_url: `https://example.test/${opts.broker}`,
    phone: opts.phone,
    relatives: opts.relatives,
    previous_addresses: opts.previous_addresses,
  } as SummaryResult;
}

const FPS = summary({
  broker: BrokerName.FPS,
  full_name: "James Oehring",
  address: "413 Lovers Ln, Cameron MO 64429",
  age: 61,
  phone: "(816) 632-2218",
  relatives: "Rickilinda Oehring, Robert Mctarsney, Albert Mcgee",
});
const NPD = summary({
  broker: BrokerName.NPD,
  full_name: "James Oehring",
  address: "413 Lovers Ln, Cameron, MO",
  age: 62,
  phone: "(816) 632-2218, (816) 225-8592",
  relatives: "Rickilinda Oehring",
});
const ANYWHO = summary({
  broker: BrokerName.ANYWHO,
  full_name: "James A Oehring",
  address: "1225 Union Ave, Apt 502, Kansas City, MO",
  age: 37,
  phone: "(816) 632-2218",
  relatives: "Rickilinda Oehring",
  previous_addresses: "413 Lovers Ln, Cameron, MO; 380 W 22nd St, Kansas City, MO",
});
const ZABA = summary({
  broker: BrokerName.ZABA,
  full_name: "James Oehring",
  address: "413 Lovers LN, Cameron, Missouri 64429",
  age: 37,
  phone: "(816) 225-8592, (816) 632-2218",
  relatives: "Rickilinda R Oehring",
});
const RICKILINDA = summary({
  broker: BrokerName.ANYWHO,
  full_name: "Rickilinda Oehring",
  address: "413 Lovers Ln, Cameron MO 64429",
  age: 65,
  phone: "(816) 632-2218",
  relatives: "James Oehring",
});

Deno.test("same person across brokers clears merge, including AnyWho on address history", () => {
  for (const [other, label] of [[NPD, "fps/npd"], [ANYWHO, "fps/anywho"], [ZABA, "fps/zaba"]] as const) {
    const score = engine.calculateMatchScore(FPS, other);
    if (score < DedupEngine.MERGE_THRESHOLD) {
      throw new Error(`${label} scored ${score.toFixed(1)}`);
    }
  }
});

Deno.test("a 24-year age gap does not veto a match", () => {
  const withGap = engine.calculateMatchScore(FPS, ZABA);
  const sameAge = engine.calculateMatchScore(FPS, { ...ZABA, age: 61 });
  if (!(sameAge > withGap)) throw new Error("age should still contribute something");
  if (withGap < DedupEngine.MERGE_THRESHOLD) throw new Error("age gap must not veto");
});

Deno.test("AnyWho current-city mismatch still merges via address history", () => {
  const noHistory = { ...ANYWHO, previous_addresses: "" };
  if (!(engine.calculateMatchScore(FPS, ANYWHO) > engine.calculateMatchScore(FPS, noHistory))) {
    throw new Error("history should raise the AnyWho score");
  }
});

Deno.test("different city without history/phone stays below merge", () => {
  const kcOnly = summary({
    broker: BrokerName.ANYWHO,
    full_name: "James A Oehring",
    address: "1225 Union Ave, Apt 502, Kansas City, MO",
    age: 37,
  });
  const score = engine.calculateMatchScore(FPS, kcOnly);
  if (score >= DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`different cities scored ${score.toFixed(1)} — too eager`);
  }
});

Deno.test("Jim and James at one address with a shared phone merge", () => {
  const jim = summary({
    broker: BrokerName.FPS,
    full_name: "Jim Oehring",
    address: "413 Lovers Ln, Cameron, MO",
    age: 37,
    phone: "(816) 632-2218",
  });
  const score = engine.calculateMatchScore(ZABA, jim);
  if (score < DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`Jim/James scored ${score.toFixed(1)}`);
  }
});

Deno.test("LN vs Lane does not break the match", () => {
  const spelledOut = summary({
    broker: BrokerName.NPD,
    full_name: "James Oehring",
    address: "413 Lovers Lane, Cameron, MO",
    age: 37,
    phone: "(816) 632-2218",
  });
  const score = engine.calculateMatchScore(ZABA, spelledOut);
  if (score < DedupEngine.MERGE_THRESHOLD) throw new Error(`scored ${score.toFixed(1)}`);
});

Deno.test("spouse sharing address and landline does not merge", () => {
  const score = engine.calculateMatchScore(FPS, RICKILINDA);
  if (score >= DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`James/Rickilinda scored ${score.toFixed(1)}`);
  }
});

Deno.test("incompatible first name gates even with identical other signals", () => {
  const twin = summary({
    broker: BrokerName.NPD,
    full_name: "Deena Oehring",
    address: FPS.address,
    age: 61,
    phone: FPS.phone,
    relatives: FPS.relatives,
  });
  const score = engine.calculateMatchScore(FPS, twin);
  if (score >= DedupEngine.MERGE_THRESHOLD) {
    throw new Error(`gated pair scored ${score.toFixed(1)}`);
  }
  if (score > DedupEngine.NAME_GATE_CEILING) {
    throw new Error(`gate ceiling not applied: ${score.toFixed(1)}`);
  }
});

Deno.test("no unconditional broker-credibility bonus", () => {
  const nothing = summary({
    broker: BrokerName.NPD,
    full_name: "Zqxjv Wkltmr",
    address: "1 Nowhere St, Nowhere AK 99999",
  });
  const score = engine.calculateMatchScore(FPS, nothing);
  if (score >= 10) throw new Error(`unrelated pair scored ${score.toFixed(1)}`);
});

Deno.test("matchReference keeps one hit per broker against the pick", () => {
  const resolved = engine.matchReference(ZABA, {
    [BrokerName.FPS]: [FPS],
    [BrokerName.NPD]: [NPD],
    [BrokerName.ANYWHO]: [ANYWHO, RICKILINDA],
  });
  const brokers = resolved.map((r) => r.broker).sort();
  if (brokers.join(",") !== "anywho,fps,npd") {
    throw new Error(`resolved ${brokers.join(",")} — expected fps,npd,anywho`);
  }
  const anywho = resolved.find((r) => r.broker === BrokerName.ANYWHO);
  if (anywho?.summary.full_name !== "James A Oehring") {
    throw new Error("AnyWho should resolve to James, not Rickilinda");
  }
});

Deno.test("matchReference skips a broker below threshold", () => {
  const stranger = summary({
    broker: BrokerName.FPS,
    full_name: "Lucas Clark",
    address: "7935 Holmes Rd, Kansas City MO 64131",
    age: 34,
    phone: "(816) 263-0393",
  });
  const resolved = engine.matchReference(ZABA, { [BrokerName.FPS]: [stranger] });
  if (resolved.length !== 0) throw new Error("stranger should not resolve");
});

Deno.test("matchReference drops a candidate that matches a rejected card better", () => {
  // User said the Zaba card that is NPD-James isn't them. Don't attach NPD.
  const rejectedClone = { ...NPD, broker: BrokerName.ZABA };
  const resolved = engine.matchReference(FPS, { [BrokerName.NPD]: [NPD] }, [rejectedClone]);
  if (resolved.length !== 0) {
    throw new Error("rejected clone should suppress the NPD record");
  }
});

Deno.test("FPS summary without phone misses AnyWho; full profile with phone matches", () => {
  const fpsSummary = summary({
    broker: BrokerName.FPS,
    full_name: "James Oehring",
    address: "413 Lovers Ln, Cameron MO 64429",
    age: 61,
    relatives: "Rickilinda Oehring, Robert Mctarsney",
  });
  const fromSummary = engine.matchReference(fpsSummary, { [BrokerName.ANYWHO]: [ANYWHO] });
  if (fromSummary.length !== 0) {
    throw new Error(`summary pick should miss AnyWho, scored a hit at ${fromSummary[0].match_score}`);
  }

  const fpsFull = { ...fpsSummary, phone: "(816) 632-2218" };
  const fromFull = engine.matchReference(fpsFull, { [BrokerName.ANYWHO]: [ANYWHO] });
  if (fromFull.length !== 1) {
    throw new Error("full-profile pick with shared phone should match AnyWho");
  }
});

Deno.test("phoneless pick still matches AnyWho at GROUP_THRESHOLD so a failed FPS detail does not skip other brokers", () => {
  const fpsSummary = summary({
    broker: BrokerName.FPS,
    full_name: "James Oehring",
    address: "413 Lovers Ln, Cameron MO 64429",
    age: 61,
    relatives: "Rickilinda Oehring, Robert Mctarsney",
  });
  const fromSummary = engine.matchReference(
    fpsSummary,
    { [BrokerName.ANYWHO]: [ANYWHO] },
    [],
    DedupEngine.GROUP_THRESHOLD,
  );
  if (fromSummary.length !== 1) {
    throw new Error("phoneless FPS pick should still attach AnyWho at the 50 threshold");
  }
});

Deno.test("matchReference prefers closer age when two candidates both merge", () => {
  const sr = { ...FPS, result_id: "sr" };
  const jr = summary({
    broker: BrokerName.FPS,
    full_name: "James Oehring",
    address: "413 Lovers Ln, Cameron MO 64429",
    age: 37,
    phone: "(816) 632-2218",
    relatives: "Rickilinda Oehring",
    previous_addresses: undefined,
  });
  jr.result_id = "jr";
  const resolved = engine.matchReference(ZABA, { [BrokerName.FPS]: [sr, jr] });
  if (resolved.length !== 1) throw new Error(`expected 1 FPS hit, got ${resolved.length}`);
  if (resolved[0].summary.result_id !== "jr") {
    throw new Error(`Zaba age 37 should prefer Jr, got ${resolved[0].summary.age}`);
  }
});
