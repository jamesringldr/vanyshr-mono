#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * Phone-lookup accuracy study -- sweeps every eligible testing.test_subjects
 * row (has a current_phone on file) against the four phone-number-keyed
 * brokers being evaluated as Zaba's replacement, and writes one row per
 * (subject, broker) into testing.phone_results.
 *
 * No writer for the `testing` schema exists in this repo (see
 * docs/SCHEMA_REVIEW.md) -- this is a one-off study script, not part of the
 * production edge functions.
 *
 * Connects to Postgres DIRECTLY, not via supabase-js/PostgREST: per
 * docs/SCHEMA_REVIEW.md §9, `testing` has USAGE=false for anon,
 * authenticated, AND service_role -- the API (and the service-role key)
 * cannot see this schema at all, by design. DATABASE_URL must be the direct
 * Postgres connection string (Project Settings -> Database -> Connection
 * string), authenticating as the `postgres` role, which isn't subject to
 * that grant.
 *
 * Extraction is a generic schema.org Person JSON-LD read (phone-page-parser.ts)
 * -- untested live beyond reversephonelookup.com's one saved sample, so a
 * broker with a different page shape will simply come back with null summary
 * fields. The raw HTML is stored in `raw` regardless, for manual review.
 *
 * is_target_match here is a rough "does either name contain the other" guess,
 * not a real match -- James spot-checks and corrects it by hand before any
 * accuracy analysis runs against this table.
 *
 *   export CONTEXT_DEV_API_KEY=...
 *   export DATABASE_URL=postgres://postgres:<password>@<host>:5432/postgres
 *   deno run --allow-net --allow-env scripts/phone-lookup-study.ts
 *
 * Costs one context.dev credit per (subject x broker) pair.
 */
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";
import { ContextDevError, scrapeHtml } from "../supabase/functions/_shared/quickscan/context-dev-client.ts";
import {
  buildPhoneLookupUrl,
  parsePhoneSummary,
  PHONE_LOOKUP_TARGETS,
} from "../supabase/functions/_shared/scrapers/phone-page-parser.ts";

const CONTEXT_DEV_API_KEY = Deno.env.get("CONTEXT_DEV_API_KEY");
const DATABASE_URL = Deno.env.get("DATABASE_URL");

if (!CONTEXT_DEV_API_KEY || !DATABASE_URL) {
  console.error("Missing env: CONTEXT_DEV_API_KEY and DATABASE_URL both required");
  Deno.exit(2);
}

const db = new Client(DATABASE_URL);
await db.connect();

function nameTokens(name: string): string[] {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(Boolean);
}

/**
 * Loose "first + last token both show up" check -- a spot-check aid, not a
 * real match. Token-based, not whole-string substring: a middle
 * name/suffix inserted between first and last (e.g. broker's "Bradley Roy
 * Beckwith" vs. subject's "Brad Beckwith") breaks a plain
 * `a.includes(b)` check even though the two obviously refer to the same
 * person -- checked against real rows from this sweep. Nicknames (Brad/
 * Bradley) are handled with a prefix check on the first token only; last
 * token (surname) must match exactly since that's the anchor.
 */
function namesLooselyMatch(a: string | null, b: string | null): boolean | null {
  if (!a || !b) return null;
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.length === 0 || tb.length === 0) return null;

  const check = (short: string[], long: string[]): boolean => {
    const [firstS, lastS] = [short[0], short[short.length - 1]];
    const hasLast = long.includes(lastS);
    const hasFirst = long.some((t) => t.startsWith(firstS) || firstS.startsWith(t));
    return hasLast && hasFirst;
  };

  return check(ta, tb) || check(tb, ta);
}

type TestSubject = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string | null;
  current_phone: string | null;
};

const subjectsResult = await db.queryObject<TestSubject>`
  SELECT id, first_name, last_name, full_name, current_phone
  FROM testing.test_subjects
  WHERE current_phone IS NOT NULL AND current_phone <> ''
`;

const eligible = subjectsResult.rows;
console.log(`${eligible.length} eligible test subjects (have current_phone)\n`);

const runId = `phone.${new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12)}`;
const runResult = await db.queryObject<{ id: number }>`
  INSERT INTO testing.scrape_runs (run_id, notes)
  VALUES (${runId}, ${"phone-lookup accuracy study (RPL/usphonebook/anywho/fps)"})
  RETURNING id
`;
const run = runResult.rows[0];

console.log(`run ${runId} (id=${run.id})\n`);
console.log(
  `${"subject".padEnd(20)} ${"broker".padEnd(20)} ${"status".padEnd(11)} ${"ms".padStart(6)}  name found`,
);
console.log("-".repeat(90));

for (const subject of eligible) {
  const subjectName = subject.full_name || `${subject.first_name} ${subject.last_name}`;

  for (const target of PHONE_LOOKUP_TARGETS) {
    const url = buildPhoneLookupUrl(target, subject.current_phone!);
    const started = Date.now();

    let status: "success" | "partial" | "failed" | "timeout" | "blocked" | "no_results" = "failed";
    let notes: string | null = null;
    let summary = null as ReturnType<typeof parsePhoneSummary>;
    let raw: Record<string, unknown> = {};

    try {
      const result = await scrapeHtml(url, { maxAgeMs: 0 });
      raw = { html: result.html, finalUrl: result.finalUrl };
      if (result.notFound) {
        status = "no_results";
      } else {
        summary = parsePhoneSummary(target, result.html, result.finalUrl || result.url);
        status = summary?.full_name ? "success" : "partial";
      }
    } catch (err) {
      if (err instanceof ContextDevError) {
        status = err.errorCode === "WEBSITE_BLOCKED" ? "blocked" : "failed";
        notes = err.message;
      } else if (err instanceof DOMException && err.name === "TimeoutError") {
        status = "timeout";
        notes = err.message;
      } else {
        status = "failed";
        notes = String(err);
      }
      raw = { error: notes };
    }

    const responseTimeMs = Date.now() - started;

    try {
      await db.queryObject`
        INSERT INTO testing.phone_results (
          run_id, subject_id, target, is_target_match, full_name, address, age,
          profile_url, response_time_ms, status, notes, raw,
          phone, email, aliases, relatives, previous_addresses
        ) VALUES (
          ${run.id}, ${subject.id}, ${target},
          ${namesLooselyMatch(summary?.full_name ?? null, subjectName)},
          ${summary?.full_name ?? null}, ${summary?.address ?? null}, ${summary?.age ?? null},
          ${summary?.profile_url ?? url}, ${responseTimeMs}, ${status}, ${notes},
          ${JSON.stringify(raw)},
          ${summary?.phone ?? null}, ${summary?.email ?? null}, ${summary?.aliases ?? null},
          ${summary?.relatives ?? null}, ${summary?.previous_addresses ?? null}
        )
      `;
    } catch (insertErr) {
      console.error(`  insert failed for ${subject.id}/${target}:`, insertErr);
    }

    console.log(
      `${subject.id.padEnd(20)} ${target.padEnd(20)} ${status.padEnd(11)} ${String(responseTimeMs).padStart(6)}  ${summary?.full_name ?? "-"}`,
    );
  }
}

await db.queryObject`
  UPDATE testing.scrape_runs SET finished_at = now() WHERE id = ${run.id}
`;
await db.end();
console.log(`\ndone -- run_id ${runId}`);
