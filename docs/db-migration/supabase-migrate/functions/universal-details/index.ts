import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  scrapeFullProfile,
  scrapeAndMergeProfiles,
  type ProfileMatch,
  type QuickScanProfileData,
} from "../_shared/scrapers/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DetailsRequest {
  scan_id?: string;
  selected_profile?: ProfileMatch;
  detailLink?: string;
  siteName?: string;
  merge_profiles?: Array<{ siteName: string; url: string }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  console.log("🕵️ Universal Details - Function started");

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const requestBody: DetailsRequest = await req.json();
    console.log("🕵️ Universal Details - Request:", requestBody);

    const {
      scan_id,
      selected_profile,
      detailLink: rootDetailLink,
      siteName,
      merge_profiles,
    } = requestBody;

    // Handle multi-source merge if provided
    if (merge_profiles && Array.isArray(merge_profiles) && merge_profiles.length > 0) {
      console.log(`🕵️ Merging profiles from ${merge_profiles.length} sources`);

      const mergedProfile = await scrapeAndMergeProfiles(merge_profiles);

      if (!mergedProfile) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to merge profile data" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update quick_scans with merged JSONB data if scan_id provided
      if (scan_id) {
        const { error: updateError } = await supabaseClient
          .from("quick_scans")
          .update({
            status: "completed",
            profile_data: mergedProfile,
          })
          .eq("id", scan_id);

        if (updateError) {
          console.error("Error updating quick_scans with merged profile:", updateError);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          profile_data: mergedProfile,
          message: "Profiles merged successfully",
          sources: merge_profiles.map((p: any) => p.siteName),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single profile scrape
    const detailLink = rootDetailLink || selected_profile?.detail_link;
    let source = siteName || selected_profile?.source || "AnyWho";

    // Auto-detect source from URL
    if (detailLink) {
      if (detailLink.includes("anywho.com")) {
        source = "AnyWho";
      } else if (detailLink.includes("zabasearch.com")) {
        source = "Zabasearch";
      }
    }

    if (!detailLink) {
      return new Response(
        JSON.stringify({ success: false, error: "No detail link provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🕵️ Scraping full profile from ${source}: ${detailLink}`);

    // Use scrapeFullProfile function
    const scraperName = source.toLowerCase().replace(/\s+/g, "");
    const profileData = await scrapeFullProfile(scraperName, detailLink, selected_profile);

    if (!profileData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to scrape details from ${source}`,
          debug: { source, detailLink, scraperName }
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Scraped profile data:`, {
      name: profileData.name,
      phones: profileData.phones?.length || 0,
      addresses: profileData.addresses?.length || 0,
      relatives: profileData.relatives?.length || 0,
      aliases: profileData.aliases?.length || 0,
    });

    // Update quick_scans with JSONB data if scan_id provided
    if (scan_id) {
      const { error: updateError } = await supabaseClient
        .from("quick_scans")
        .update({
          status: "completed",
          profile_data: profileData,
          selected_match_id: selected_profile?.id,
        })
        .eq("id", scan_id);

      if (updateError) {
        console.error("Error updating quick_scans with profile data:", updateError);
      } else {
        console.log(`✅ Saved profile to quick_scans (scan_id: ${scan_id})`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        profile_data: profileData,
        message: "Details scraped successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("❌ Universal Details error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
