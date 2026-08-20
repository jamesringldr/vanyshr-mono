/**
 * Optional bridge: prod universal-search → scraper-lab API (home residential worker).
 * Enable with Supabase secrets SCRAPER_LAB_URL + SCRAPER_LAB_TOKEN.
 */
import type { ProfileMatch, SearchInput } from "./scrapers/BaseScraper.ts";

export function scraperLabEnabled(): boolean {
  return Boolean(Deno.env.get("SCRAPER_LAB_URL") && Deno.env.get("SCRAPER_LAB_TOKEN"));
}

function siteNamesToSources(siteNames: string[]): string[] {
  const out: string[] = [];
  for (const raw of siteNames) {
    const n = raw.toLowerCase().replace(/\s+/g, "");
    if (n.includes("zaba")) out.push("zabasearch");
    else if (n.includes("anywho")) out.push("anywho");
    else if (n.includes("fast") || n === "fps") out.push("fastpeoplesearch");
    else out.push(n);
  }
  return [...new Set(out)];
}

function normalizeSourceLabel(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("zaba")) return "Zabasearch";
  if (s.includes("anywho")) return "AnyWho";
  if (s.includes("fast")) return "FastPeopleSearch";
  return source;
}

function mapMatches(raw: unknown[]): ProfileMatch[] {
  return raw.map((m, i) => {
    const row = m as Record<string, unknown>;
    const source = normalizeSourceLabel(String(row.source ?? "Unknown"));
    return {
      id: String(row.id ?? `sl-${i}`),
      name: String(row.name ?? ""),
      age: row.age != null ? String(row.age) : undefined,
      city_state: row.city_state != null ? String(row.city_state) : undefined,
      phone_snippet: row.phone_snippet != null ? String(row.phone_snippet) : undefined,
      detail_link: row.detail_link != null ? String(row.detail_link) : undefined,
      source,
      fullProfile: row.fullProfile as ProfileMatch["fullProfile"],
    };
  });
}

async function runJob(
  base: string,
  token: string,
  body: Record<string, unknown>,
  pollSec: number,
  pollIntervalMs: number,
  sources: string[],
): Promise<{ matches: ProfileMatch[]; runs: Array<Record<string, unknown>>; outcome?: string }> {
  const labelCity = (body as { city?: string }).city ? ` city=${(body as { city: string }).city}` : ' (no city)';
  console.log(`🏠 scraper-lab POST ${base}/v1/quickscan/search sources=${sources.join(",")}${labelCity}`);

  const createRes = await fetch(`${base}/v1/quickscan/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    const text = await createRes.text();
    throw new Error(`scraper-lab create failed ${createRes.status}: ${text.slice(0, 200)}`);
  }

  const created = await createRes.json() as { job_id?: string };
  const jobId = created.job_id;
  if (!jobId) throw new Error("scraper-lab: no job_id in response");

  const deadline = Date.now() + pollSec * 1000;
  while (Date.now() < deadline) {
    const jobRes = await fetch(`${base}/v1/jobs/${jobId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!jobRes.ok) {
      throw new Error(`scraper-lab poll failed ${jobRes.status}`);
    }
    const job = await jobRes.json() as {
      status?: string;
      matches?: unknown[];
      runs?: Array<Record<string, unknown>>;
      outcome?: string;
      error?: string;
    };

    if (job.status === "completed") {
      const matches = mapMatches(job.matches ?? []);
      const runs = (job.runs ?? []).map((r) => ({
        scraper: String(r.scraper ?? ""),
        success: r.status === "success" || r.status === "no_results",
        matchCount: r.profiles_found ?? 0,
        runStatus: r.status,
        error: r.error,
        via: "scraper-lab",
      }));
      console.log(`🏠 scraper-lab job ${jobId} completed: ${matches.length} matches`);
      return { matches, runs, outcome: job.outcome };
    }

    if (job.status === "failed") {
      const runs = (job.runs ?? []).map((r) => ({
        scraper: String(r.scraper ?? ""),
        success: r.status === "success",
        matchCount: r.profiles_found ?? 0,
        runStatus: r.status,
        error: r.error,
        via: "scraper-lab",
      }));
      if (runs.length === 0) {
        runs.push({
          scraper: sources[0] ?? "scraper-lab",
          success: false,
          matchCount: 0,
          error: job.error ?? "scraper-lab job failed",
          via: "scraper-lab",
        });
      }
      console.log(`🏠 scraper-lab job ${jobId} failed: ${job.error ?? "unknown"}`);
      return { matches: [], runs, outcome: "failed" };
    }

    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`scraper-lab job ${jobId} timed out after ${pollSec}s`);
}

export async function searchViaScraperLab(
  siteNames: string[],
  input: SearchInput,
): Promise<{ matches: ProfileMatch[]; runs: Array<Record<string, unknown>> }> {
  const base = (Deno.env.get("SCRAPER_LAB_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("SCRAPER_LAB_TOKEN") ?? "";
  if (!base || !token) {
    throw new Error("SCRAPER_LAB_URL and SCRAPER_LAB_TOKEN required");
  }

  const sources = siteNamesToSources(siteNames);
  const pollSec = Number(Deno.env.get("SCRAPER_LAB_POLL_MAX_SEC") ?? "150");
  const pollIntervalMs = Number(Deno.env.get("SCRAPER_LAB_POLL_MS") ?? "2000");

  // City/zip identify the user, not a filter — broker sites often list under a
  // different metro name than the USPS mail city (e.g. 66210 → Overland Park, not
  // Shawnee Mission). Search state-only in a single job instead of retrying with a
  // city filter first — that retry doubled job time on every metro-name mismatch.
  const body = {
    first_name: input.first_name,
    last_name: input.last_name,
    state: input.state,
    zip: input.zip,
    sources,
  };

  const result = await runJob(base, token, body, pollSec, pollIntervalMs, sources);
  return { matches: result.matches, runs: result.runs };
}
