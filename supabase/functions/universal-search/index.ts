import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  searchProfiles,
  searchProfilesMulti,
  getAvailableScrapers,
  getScrapersForSearchType,
  type ProfileMatch,
  type SearchInput,
} from "../_shared/scrapers/index.ts";
import { scraperLabEnabled, searchViaScraperLab } from "../_shared/scraper-lab-client.ts";

import { getCorsHeaders } from '../_shared/cors.ts'

interface SearchRequest {
  scan_id?: string; // quick_scans ID — if omitted, one will be created
  firstName: string;
  lastName: string;
  zipCode?: string;
  city?: string;
  state?: string;
  siteName?: string; // Optional: specific site to search, defaults to 'AnyWho'
  search_all?: boolean; // Flag to search across all available scrapers
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Hoisted so the catch block can mark the row as errored
  let activeScanId: string | null = null;
  let supabaseClient: any = null;

  try {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const requestBody: SearchRequest = await req.json()
    const {
      scan_id,
      firstName,
      lastName,
      zipCode,
      city,
      state,
      siteName = 'AnyWho',
      search_all = false
    } = requestBody

    // Warm-up ping — keeps the function hot, no DB writes, no scraping
    if ((requestBody as any).ping === true) {
      return new Response(JSON.stringify({ pong: true }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!firstName || !lastName) {
      return new Response(
        JSON.stringify({ error: 'firstName and lastName are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔍 Universal Search: ${firstName} ${lastName}${city ? `, ${city}` : ''}${state ? `, ${state}` : ''}`);

    const searchInput: SearchInput = {
      first_name: firstName,
      last_name: lastName,
      city: city || undefined,
      state: state || undefined,
      zip: zipCode || undefined,
    };

    let matches: ProfileMatch[] = [];
    let scraperRuns: any[] = [];

    // Create or claim the quick_scans row before scraping starts
    activeScanId = scan_id ?? null;

    if (activeScanId) {
      // Row already created by zip-lookup — update status to scanning
      const { error: updateError } = await supabaseClient
        .from('quick_scans')
        .update({ status: 'scanning' })
        .eq('id', activeScanId);
      if (updateError) console.error('Error updating quick_scans to scanning:', updateError);
      else console.log(`✅ quick_scans ${activeScanId} → scanning`);
    } else {
      // Fallback: no scan_id provided (e.g. called directly without zip-lookup)
      const { data: insertData, error: insertError } = await supabaseClient
        .from('quick_scans')
        .insert({
          session_id: crypto.randomUUID(),
          status: 'scanning',
          source: 'quickscan',
          search_input: {
            first_name: firstName,
            last_name: lastName,
            zip_code: zipCode ?? null,
            city: city ?? null,
            state: state ?? null,
          },
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating quick_scans row:', insertError);
      } else if (insertData?.id) {
        activeScanId = insertData.id;
        console.log(`✅ Created quick_scans row: ${activeScanId} (status: scanning)`);
      }
    }

    // Residential-only scrapers (FPS / Zaba) live on serv-01 — not reachable from
    // Supabase Edge (datacenter, no Tailscale). Call those services directly like
    // scrape_runner does; never route them through this function.
    const EDGE_BLOCKED = new Set(['zabasearch', 'zaba', 'fastpeoplesearch', 'fps']);
    const normSite = (siteName || '').toLowerCase().replace(/\s+/g, '');

    if (EDGE_BLOCKED.has(normSite) && !search_all) {
      console.warn(
        `⛔ refusing residential scraper "${siteName}" from edge — use serv01 HTTP service ` +
          `(FPS :8787 / Zaba :8788), not universal-search`,
      );
      if (activeScanId) {
        await supabaseClient
          .from('quick_scans')
          .update({
            status: 'no_matches',
            candidate_matches: [],
            scraper_runs: [{
              scraper: normSite,
              success: false,
              error: 'residential_service_only',
              message: 'Call serv01 zaba/fps service directly; not available on edge',
            }],
          })
          .eq('id', activeScanId);
      }
      return new Response(
        JSON.stringify({
          success: false,
          scan_id: activeScanId,
          profiles: [],
          count: 0,
          scraper_failed: true,
          error: 'residential_service_only',
          message:
            'Zabasearch/FPS run on serv01 (residential), not Supabase Edge. ' +
            'Invoke the HTTP service directly (same path as FPS).',
          scraper_runs: [{ scraper: normSite, success: false, error: 'residential_service_only' }],
          available_scrapers: getAvailableScrapers(),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (scraperLabEnabled()) {
      // AnyWho-only mode: run AnyWho once. If it returns 0 matches, the
      // scan finalizes as `no_matches` and the frontend shows the
      // "nothing found" modal.
      console.log(`🏠 Running scraper-lab: anywho (only)`);
      try {
        const result = await searchViaScraperLab(['anywho'], searchInput);
        scraperRuns.push(...result.runs);
        matches = result.matches;
        console.log(`🏠 scraper-lab anywho returned ${result.matches.length} matches`);
      } catch (e) {
        console.error(`🏠 scraper-lab anywho error:`, e);
        scraperRuns.push({ scraper: 'anywho', success: false, error: (e as Error).message, via: 'scraper-lab' });
      }
    } else if (search_all) {
      // Edge-capable name scrapers only (exclude residential FPS/Zaba)
      const nameScrapers = getScrapersForSearchType('name')
        .filter(s => !EDGE_BLOCKED.has(s.name.toLowerCase().replace(/\s+/g, '')));
      const scraperNames = nameScrapers.map(s => s.name.toLowerCase().replace(/\s+/g, ''));

      console.log(`🔍 Searching edge scrapers only: ${scraperNames.join(', ')}`);

      const result = await searchProfilesMulti(scraperNames, searchInput);
      matches = result.matches;
      scraperRuns = result.runs;
    } else {
      // Search single edge scraper
      const scraperName = normSite;
      console.log(`🔍 Searching single scraper: ${scraperName}`);

      try {
        matches = await searchProfiles(scraperName, searchInput);
        scraperRuns = [{ scraper: scraperName, success: true, matchCount: matches.length }];
      } catch (e) {
        scraperRuns = [{ scraper: scraperName, success: false, error: (e as Error).message }];
      }
    }

    console.log(`🔍 Found ${matches.length} total matches`);

    // AnyWho-only mode: there is no fallback scraper, so a failed AnyWho run
    // should drop the user into the "nothing found" modal — not the error UI.
    // We suppress scraper_failed entirely when matches are empty so the
    // frontend's retry-then-error path never fires.
    const scraperFailed = false;
    const finalStatus = matches.length > 0 ? 'selection_required' : 'no_matches';

    if (activeScanId) {
      const { error: updateError } = await supabaseClient
        .from('quick_scans')
        .update({
          status: finalStatus,
          candidate_matches: matches,
          scraper_runs: scraperRuns,
        })
        .eq('id', activeScanId);

      if (updateError) {
        console.error('Error updating quick_scans:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        scan_id: activeScanId,
        profiles: matches,
        count: matches.length,
        scraper_failed: scraperFailed,
        scraper_runs: scraperRuns,
        available_scrapers: getAvailableScrapers(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🔍 Universal Search error:', error)

    // Best-effort: mark the scan row as errored
    if (activeScanId && supabaseClient) {
      try {
        await supabaseClient
          .from('quick_scans')
          .update({ status: 'failed', error_message: (error as Error).message })
          .eq('id', activeScanId);
      } catch { /* ignore secondary failure */ }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: (error as Error).message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
