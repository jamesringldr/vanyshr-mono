/**
 * Bridge: universal-search -> FPS HTTP service running on serv-01 (Camoufox +
 * curl_cffi pipeline, see workers/fps-playwright/service.py). Single call does
 * search + detail in one shot and returns a full profile directly, unlike
 * AnyWho/Zabasearch's two-phase search-then-detail model.
 *
 * Enable with Supabase secrets FPS_SERVICE_URL + FPS_SERVICE_TOKEN. Requests
 * are serialized on the service side (one Camoufox run at a time), so a call
 * can take 30-90s+ — callers should budget a long timeout.
 */
import type { ProfileMatch, QuickScanProfileData, SearchInput } from "./scrapers/BaseScraper.ts";

export function fpsServiceEnabled(): boolean {
  return Boolean(Deno.env.get("FPS_SERVICE_URL") && Deno.env.get("FPS_SERVICE_TOKEN"));
}

type FpsServiceResponse =
  | ({ status: "success" } & Omit<QuickScanProfileData, "sources"> & { sources?: string[] })
  | { status: "no_results" | "blocked" | "failed"; error?: string };

/**
 * Calls the FPS service and returns a single-element ProfileMatch[] (with
 * fullProfile populated) on success, or [] on no_results/blocked/failed —
 * mirroring how Zabasearch already returns full profile data at search time.
 */
export async function searchViaFpsService(input: SearchInput): Promise<ProfileMatch[]> {
  const base = (Deno.env.get("FPS_SERVICE_URL") ?? "").replace(/\/$/, "");
  const token = Deno.env.get("FPS_SERVICE_TOKEN") ?? "";
  if (!base || !token) {
    throw new Error("FPS_SERVICE_URL and FPS_SERVICE_TOKEN required");
  }

  console.log(`🕵️ FPS service: POST ${base}/v1/fps/search`);

  const response = await fetch(`${base}/v1/fps/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      first_name: input.first_name,
      last_name: input.last_name,
      city: input.city,
      state: input.state,
    }),
    // Camoufox harvest + curl_cffi replay is slow and requests queue behind
    // each other on serv-01 — give this far more room than a normal fetch.
    signal: AbortSignal.timeout(150_000),
  });

  if (!response.ok) {
    throw new Error(`FPS service HTTP ${response.status}`);
  }

  const result = await response.json() as FpsServiceResponse;

  if (result.status !== "success") {
    console.log(`🕵️ FPS service: ${result.status}${result.error ? ` (${result.error})` : ""}`);
    return [];
  }

  const { status: _status, ...profile } = result;
  const fullProfile: QuickScanProfileData = { sources: ["FastPeopleSearch"], ...profile };

  console.log(`✅ FPS service returned a profile for ${fullProfile.name}`);

  return [{
    id: "fps-0",
    name: fullProfile.name,
    age: fullProfile.age,
    city_state: fullProfile.addresses?.[0]?.full_address,
    phone_snippet: fullProfile.phones?.[0]?.number,
    detail_link: fullProfile.detail_link,
    source: "FastPeopleSearch",
    fullProfile: fullProfile as unknown as ProfileMatch["fullProfile"],
  }];
}
