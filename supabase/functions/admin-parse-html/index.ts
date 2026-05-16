import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  parseSearchFromHtml,
  parseDetailFromHtml,
  mergeProfileData,
  type ProfileMatch,
  type QuickScanProfileData,
  type SearchInput,
} from "../_shared/scrapers/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-admin-secret",
};

type PageType = "search" | "detail";

interface AdminParseSource {
  site_name: string;
  detail_url?: string;
  html: string;
  selected_profile?: Partial<ProfileMatch>;
}

interface AdminParseRequest {
  html?: string;
  site_name?: string;
  page_type?: PageType;
  scan_id?: string;
  save_to_db?: boolean;
  search_input?: SearchInput;
  detail_url?: string;
  selected_profile?: Partial<ProfileMatch>;
  selected_match_id?: string;
  /** Batch: parse multiple broker HTML files into one merged profile_data row */
  sources?: AdminParseSource[];
}

function normalizeSiteName(siteName: string): string {
  return siteName.toLowerCase().replace(/\s+/g, "");
}

function buildSearchInputPayload(input: SearchInput) {
  return {
    first_name: input.first_name,
    last_name: input.last_name,
    zip_code: input.zip ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    age: input.age ?? null,
  };
}

/** Prefer user-provided age over broker listings (Zabasearch ages are often wrong). */
function applyCanonicalAge(
  merged: QuickScanProfileData,
  searchInput?: SearchInput,
  sources: AdminParseSource[] = [],
): void {
  const fromSearch = searchInput?.age?.match(/\d+/)?.[0];
  const fromZabaMatch = sources
    .find((s) => normalizeSiteName(s.site_name).includes("zaba"))
    ?.selected_profile?.age?.match(/\d+/)?.[0];
  const canonical = fromSearch || fromZabaMatch;
  if (canonical) merged.age = canonical;
}

async function handleBatchParse(
  supabaseClient: ReturnType<typeof createClient>,
  body: AdminParseRequest,
): Promise<Response> {
  const {
    scan_id: clientScanId,
    save_to_db = true,
    search_input,
    sources = [],
  } = body;

  if (!search_input?.first_name || !search_input?.last_name) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "search_input.first_name and search_input.last_name are required",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const activeSources = sources.filter((s) => s.html?.trim() && s.site_name);
  if (activeSources.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: "At least one broker HTML upload is required" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const activeScanId = clientScanId ?? crypto.randomUUID();
  const parsedProfiles: QuickScanProfileData[] = [];
  const sourceResults: Array<{
    site_name: string;
    success: boolean;
    error?: string;
    fields?: { phones: number; addresses: number; relatives: number };
  }> = [];

  for (const source of activeSources) {
    const siteName = normalizeSiteName(source.site_name);
    try {
      const profileData = await parseDetailFromHtml(
        siteName,
        source.html,
        source.detail_url,
        source.selected_profile,
      );
      if (profileData) {
        parsedProfiles.push(profileData);
        sourceResults.push({
          site_name: siteName,
          success: true,
          fields: {
            phones: profileData.phones?.length ?? 0,
            addresses: profileData.addresses?.length ?? 0,
            relatives: profileData.relatives?.length ?? 0,
          },
        });
      } else {
        sourceResults.push({
          site_name: siteName,
          success: false,
          error: "Parser returned no data",
        });
      }
    } catch (err) {
      sourceResults.push({
        site_name: siteName,
        success: false,
        error: (err as Error).message,
      });
    }
  }

  if (parsedProfiles.length === 0) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "No broker HTML could be parsed",
        scan_id: activeScanId,
        source_results: sourceResults,
      }),
      { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const mergedProfile = mergeProfileData(parsedProfiles);
  applyCanonicalAge(mergedProfile, search_input, activeSources);
  const scraperRuns = sourceResults.map((r) => ({
    scraper: r.site_name,
    success: r.success,
    source: "admin-parse-html",
    error: r.error,
  }));

  if (save_to_db) {
    const row = {
      id: activeScanId,
      session_id: crypto.randomUUID(),
      status: "completed",
      search_input: buildSearchInputPayload(search_input),
      profile_data: mergedProfile,
      scraper_runs: scraperRuns,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    };

    const { error: upsertError } = await supabaseClient
      .from("quick_scans")
      .upsert(row, { onConflict: "id" });

    if (upsertError) {
      console.error("Error upserting quick_scans:", upsertError);
      return new Response(
        JSON.stringify({ success: false, error: upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      scan_id: activeScanId,
      profile_data: mergedProfile,
      source_results: sourceResults,
      merged_from: parsedProfiles.length,
      pre_profile_url: `/quick-scan/pre-profile/${activeScanId}`,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get("ADMIN_PARSE_SECRET");
    if (adminSecret) {
      const provided = req.headers.get("x-admin-secret");
      if (provided !== adminSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body: AdminParseRequest = await req.json();

    if (Array.isArray(body.sources)) {
      return await handleBatchParse(supabaseClient, body);
    }

    const {
      html,
      site_name,
      page_type,
      scan_id,
      save_to_db = true,
      search_input,
      detail_url,
      selected_profile,
      selected_match_id,
    } = body;

    if (!html?.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: "html is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!site_name || !page_type) {
      return new Response(
        JSON.stringify({ success: false, error: "site_name and page_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const siteName = normalizeSiteName(site_name);
    let activeScanId = scan_id ?? null;

    if (page_type === "search") {
      if (!search_input?.first_name || !search_input?.last_name) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "search_input.first_name and search_input.last_name are required for search pages",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const matches = parseSearchFromHtml(siteName, html, search_input);

      if (!activeScanId && save_to_db) {
        const { data: insertData, error: insertError } = await supabaseClient
          .from("quick_scans")
          .insert({
            session_id: crypto.randomUUID(),
            status: matches.length > 0 ? "selection_required" : "no_matches",
            search_input: buildSearchInputPayload(search_input),
            candidate_matches: matches,
            scraper_runs: [{
              scraper: siteName,
              success: true,
              matchCount: matches.length,
              source: "admin-parse-html",
            }],
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          })
          .select("id")
          .single();

        if (insertError) {
          console.error("Error creating quick_scans row:", insertError);
        } else {
          activeScanId = insertData?.id ?? null;
        }
      } else if (activeScanId && save_to_db) {
        const { error: updateError } = await supabaseClient
          .from("quick_scans")
          .update({
            status: matches.length > 0 ? "selection_required" : "no_matches",
            candidate_matches: matches,
            search_input: buildSearchInputPayload(search_input),
          })
          .eq("id", activeScanId);

        if (updateError) console.error("Error updating quick_scans:", updateError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          scan_id: activeScanId,
          page_type,
          candidate_matches: matches,
          count: matches.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const profileData: QuickScanProfileData | null = await parseDetailFromHtml(
      siteName,
      html,
      detail_url,
      selected_profile,
    );

    if (!profileData) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to parse detail HTML" }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!activeScanId && save_to_db) {
      const input = search_input ?? {};
      const { data: insertData, error: insertError } = await supabaseClient
        .from("quick_scans")
        .insert({
          session_id: crypto.randomUUID(),
          status: "completed",
          search_input: {
            first_name: input.first_name ?? profileData.first_name ?? null,
            last_name: input.last_name ?? profileData.last_name ?? null,
            zip_code: input.zip ?? null,
            city: input.city ?? null,
            state: input.state ?? null,
          },
          profile_data: profileData,
          selected_match_id: selected_match_id ?? selected_profile?.id ?? null,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("Error creating quick_scans row:", insertError);
      } else {
        activeScanId = insertData?.id ?? null;
      }
    } else if (activeScanId && save_to_db) {
      const { error: updateError } = await supabaseClient
        .from("quick_scans")
        .update({
          status: "completed",
          profile_data: profileData,
          selected_match_id: selected_match_id ?? selected_profile?.id ?? null,
        })
        .eq("id", activeScanId);

      if (updateError) console.error("Error updating quick_scans:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan_id: activeScanId,
        page_type,
        profile_data: profileData,
        pre_profile_url: activeScanId ? `/quick-scan/pre-profile/${activeScanId}` : null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("admin-parse-html error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
