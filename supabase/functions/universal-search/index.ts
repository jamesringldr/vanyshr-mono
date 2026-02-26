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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
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
    };

    let matches: ProfileMatch[] = [];
    let scraperRuns: any[] = [];

    if (search_all) {
      // Search across all name-capable scrapers
      const nameScrapers = getScrapersForSearchType('name');
      const scraperNames = nameScrapers.map(s => s.name.toLowerCase().replace(/\s+/g, ''));

      console.log(`🔍 Searching across all scrapers: ${scraperNames.join(', ')}`);

      const result = await searchProfilesMulti(scraperNames, searchInput);
      matches = result.matches;
      scraperRuns = result.runs;
    } else {
      // Search single scraper
      const scraperName = siteName.toLowerCase().replace(/\s+/g, '');
      console.log(`🔍 Searching single scraper: ${scraperName}`);

      try {
        matches = await searchProfiles(scraperName, searchInput);
        scraperRuns = [{ scraper: scraperName, success: true, matchCount: matches.length }];
      } catch (e) {
        scraperRuns = [{ scraper: scraperName, success: false, error: (e as Error).message }];
      }
    }

    console.log(`🔍 Found ${matches.length} total matches`);

    // Create or update the quick_scans row
    let activeScanId: string | null = scan_id ?? null;

    if (!activeScanId) {
      // No scan_id provided — create the initial row now (service role, no RLS issues)
      const { data: insertData, error: insertError } = await supabaseClient
        .from('quick_scans')
        .insert({
          session_id: crypto.randomUUID(),
          status: 'scanning',
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
        console.log(`✅ Created quick_scans row: ${activeScanId}`);
      }
    }

    if (activeScanId) {
      const { error: updateError } = await supabaseClient
        .from('quick_scans')
        .update({
          status: matches.length > 0 ? 'selection_required' : 'no_matches',
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
        scraper_runs: scraperRuns,
        available_scrapers: getAvailableScrapers(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('🔍 Universal Search error:', error)

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
