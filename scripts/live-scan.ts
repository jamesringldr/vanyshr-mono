#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Run one broker sweep through the real edge-function code, against live
 * context.dev, without deploying anything.
 *
 * This imports the same scrapeAllBrokers that summary-scan runs, so it is the
 * fastest way to answer "are the brokers healthy right now" or "did my change
 * to the scrapers break something" -- no Supabase deploy, no frontend, no
 * database writes.
 *
 *   export CONTEXT_DEV_API_KEY=...
 *   deno run --allow-net --allow-env scripts/live-scan.ts James Oehring Cameron MO
 *
 * Costs one context.dev credit per broker per run (4 per sweep).
 */
import { scrapeAllBrokers } from "../supabase/functions/_shared/quickscan/html-scrapers.ts";
import { BrokerName } from "../supabase/functions/_shared/quickscan/quickscan-phase1-phase2-models.ts";

const [firstName, lastName, city, state] = Deno.args;
if (!firstName || !lastName || !city || !state) {
  console.error("usage: deno run --allow-net --allow-env scripts/live-scan.ts <first> <last> <city> <ST>");
  Deno.exit(2);
}
if (!Deno.env.get("CONTEXT_DEV_API_KEY")) {
  console.error("CONTEXT_DEV_API_KEY is not set");
  Deno.exit(2);
}

const input = { first_name: firstName, last_name: lastName, city, state };
console.log(`\n${firstName} ${lastName} — ${city}, ${state}\n`);

const started = Date.now();
const results = await scrapeAllBrokers(input);
const wall = Date.now() - started;

console.log(`${"broker".padEnd(8)} ${"status".padEnd(11)} ${"ms".padStart(7)} ${"hits".padStart(5)}  first candidate`);
console.log("-".repeat(84));
for (const broker of [BrokerName.FPS, BrokerName.ANYWHO, BrokerName.ZABA, BrokerName.NPD]) {
  const r = results[broker];
  if (!r) continue;
  const top = r.summaries[0];
  const detail = top
    ? `${top.full_name ?? "?"}${top.age ? `, ${top.age}` : ""} — ${(top.address ?? "").slice(0, 38)}`
    : (r.error ?? "").slice(0, 46);
  console.log(
    `${String(broker).padEnd(8)} ${r.status.padEnd(11)} ${String(r.timing_ms).padStart(7)} ${String(r.summaries.length).padStart(5)}  ${detail}`,
  );
}

const count = (s: string) => Object.values(results).filter((r) => r.status === s).length;
console.log(`\ntotal ${wall}ms   blocked ${count("blocked")}   failed ${count("failed")}`);
// Non-zero on a broker we could not read at all, so this is usable in a check.
Deno.exit(count("blocked") + count("failed") > 0 ? 1 : 0);
