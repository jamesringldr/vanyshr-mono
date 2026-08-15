/**
 * Pilot-Scan Edge Function
 * Production-ready QuickScan Phase 1 & 2 with database wiring
 *
 * Flow:
 * Phase 1 (POST /pilot-scan):
 *   Input: {firstName, lastName, zipcode, sessionId}
 *   → Lookup city/state from zipcode
 *   → Call Phase1Orchestrator (4-broker parallel search)
 *   → Store dedup groups in database
 *   → Return summary for user selection
 *
 * Phase 2 (POST /pilot-scan/:groupId/enrich):
 *   Input: {dedupGroupId, sessionId}
 *   → Call Phase2Orchestrator (enrichment + consolidation)
 *   → Store consolidated profile in database
 *   → Return full profile with enrichment
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'
import { Phase1Orchestrator } from '../_shared/quickscan/phase1-orchestrator.ts'
import { Phase2Orchestrator } from '../_shared/quickscan/phase2-orchestrator.ts'
import { checkRateLimit, trackCost, estimateCost, checkBurstProtection } from '../_shared/quickscan/cost-middleware.ts'
import { type QuickScanInput, type DedupGroup } from '../_shared/quickscan/quickscan-phase1-phase2-models.ts'

interface PilotScanRequest {
  firstName?: string;
  lastName?: string;
  last_name?: string;
  zipcode?: string;
  zipCode?: string;
  city?: string;
  state?: string;
  sessionId?: string;
  dedupGroupId?: string;
}

// ZIP to STATE mapping (abbreviated version - full version in run-quick-scan)
function zipcodeToState(zipcode: string): string {
  const zip = zipcode.replace(/\D/g, '');

  if (zip.length < 3) return '';

  // Simplified mapping - using first 3 digits
  const zipPrefix = zip.substring(0, 3);
  const stateMap: Record<string, string> = {
    '005': 'NY', '010': 'MA', '020': 'MA', '030': 'NH', '040': 'ME', '050': 'VT',
    '060': 'CT', '070': 'NJ', '080': 'NJ', '090': 'NJ', '100': 'NY', '150': 'PA',
    '200': 'DC', '201': 'VA', '206': 'MD', '220': 'VA', '250': 'WV', '270': 'NC',
    '290': 'SC', '300': 'GA', '320': 'FL', '350': 'AL', '370': 'TN', '390': 'MS',
    '400': 'KY', '430': 'OH', '460': 'IN', '480': 'MI', '500': 'IA', '530': 'WI',
    '570': 'SD', '580': 'ND', '590': 'MT', '600': 'IL', '630': 'MO', '660': 'KS',
    '680': 'NE', '700': 'LA', '720': 'AR', '730': 'OK', '750': 'TX', '800': 'CO',
    '820': 'WY', '840': 'UT', '850': 'AZ', '870': 'NM', '890': 'NV', '900': 'CA',
    '970': 'OR', '980': 'WA', '995': 'AK',
  };

  return stateMap[zipPrefix] || '';
}

// Zipcode to City lookup (simplified - would need full database in production)
function zipcodeToCity(zipcode: string): { city: string; state: string } {
  // Simplified mapping for major cities/zips
  const majorZips: Record<string, { city: string; state: string }> = {
    '10001': { city: 'New York', state: 'NY' },
    '90210': { city: 'Beverly Hills', state: 'CA' },
    '60601': { city: 'Chicago', state: 'IL' },
    '75201': { city: 'Dallas', state: 'TX' },
    '98101': { city: 'Seattle', state: 'WA' },
    '65251': { city: 'Cameron', state: 'MO' },
    '64429': { city: 'Cameron', state: 'MO' },
  };

  if (majorZips[zipcode]) {
    return majorZips[zipcode];
  }

  // Fallback: use state from zipcode, city as empty (will be handled by scraper)
  const state = zipcodeToState(zipcode);
  return { city: '', state };
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Parse request
    const requestBody = await req.json();
    const {
      firstName,
      lastName,
      last_name,
      zipcode,
      zipCode,
      city,
      state,
      sessionId,
      dedupGroupId,
    } = requestBody as PilotScanRequest;

    const resolvedLast = lastName || last_name;
    const resolvedZip = zipcode || zipCode;

    // Determine if this is Phase 1 or Phase 2
    if (dedupGroupId) {
      // Phase 2: Enrichment
      return await handlePhase2(supabaseClient, corsHeaders, {
        dedupGroupId,
        sessionId: sessionId || 'anonymous',
      });
    } else if (firstName && resolvedLast && resolvedZip) {
      // Phase 1: Search
      return await handlePhase1(supabaseClient, corsHeaders, {
        firstName,
        lastName: resolvedLast,
        zipcode: resolvedZip,
        city,
        state,
        sessionId: sessionId || 'anonymous',
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request: provide (firstName, lastName, zipcode) for Phase 1 or (dedupGroupId) for Phase 2' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Pilot-scan error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (error as Error).message }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/**
 * Handle Phase 1: Zipcode lookup + parallel broker search + deduplication
 */
async function handlePhase1(
  supabaseClient: any,
  corsHeaders: Record<string, string>,
  params: {
    firstName: string;
    lastName: string;
    zipcode: string;
    city?: string;
    state?: string;
    sessionId: string;
  }
) {
  try {
    const { firstName, lastName, zipcode, sessionId } = params;

    console.log(`🔍 Pilot-Scan Phase 1: ${firstName} ${lastName}, ZIP ${zipcode}`);

    const lookedUp = zipcodeToCity(zipcode);
    const city = params.city || lookedUp.city;
    const state = params.state || lookedUp.state;
    console.log(`📍 Location: ${zipcode} → ${city}, ${state}`);

    // Step 2: Check rate limits
    const rateLimitCheck = await checkRateLimit(supabaseClient, null, sessionId);
    if (!rateLimitCheck.allowed) {
      return new Response(
        JSON.stringify({ error: rateLimitCheck.reason || 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 3: Check burst protection
    const burstCheck = await checkBurstProtection(supabaseClient, sessionId);
    if (!burstCheck.allowed) {
      return new Response(
        JSON.stringify({ error: burstCheck.reason || 'Too many searches' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 4: Run Phase 1
    const orchestrator = new Phase1Orchestrator();
    const input: QuickScanInput = { first_name: firstName, last_name: lastName, city, state };
    const result = await orchestrator.runPhase1(input, { timeout: 45000 });

    if (!result.success) {
      console.error(`Phase 1 failed: ${result.error}`);
      await trackCost(supabaseClient, null, sessionId, 1, null, estimateCost(1), {
        status: 'failed',
        error: result.error,
      });

      return new Response(
        JSON.stringify({ error: result.error || 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 5: Store dedup groups
    const dedupGroupIds = await orchestrator.storeResults(supabaseClient, `pilot-${sessionId}`, result);

    // Step 6: Track cost
    await trackCost(supabaseClient, null, sessionId, 1, null, estimateCost(1), {
      status: 'success',
      dedup_groups: dedupGroupIds.length,
    });

    console.log(`✅ Phase 1 complete: ${result.dedup_groups.length} groups`);

    // Step 7: Return summary for modal selection
    return new Response(
      JSON.stringify({
        success: true,
        dedup_groups: result.dedup_groups.map((g, idx) => ({
          id: dedupGroupIds[idx] || null,
          name: g.members[0]?.summary.full_name || '',
          age: g.members[0]?.summary.age,
          city: g.members[0]?.summary.address.split(',')[0]?.trim() || '',
          state: g.members[0]?.summary.address.split(',')[1]?.trim() || '',
          sources: g.members.map((m) => m.summary.broker),
          confidence: Math.round((g.members.reduce((s, m) => s + m.match_score, 0) / g.members.length) * 10) / 10,
          age_conflict: g.age_conflict,
          age_note: g.age_note,
          members: g.members.map((m) => {
            const s = m.summary as Record<string, unknown>;
            return {
              broker: s.broker,
              name: s.full_name ?? s.name,
              address: s.address,
              age: s.age,
              age_range: s.age_range,
              location: s.location,
              profile_url: s.profile_url,
              phone: s.phone,
              email: s.email,
              aliases: s.aliases,
              relatives: s.relatives,
              previous_addresses: s.previous_addresses,
              result_id: s.result_id,
              match_score: m.match_score,
            };
          }),
        })),
        metadata: result.metadata,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Phase 1 handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Phase 1 processing failed', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Handle Phase 2: Full profile enrichment
 */
async function handlePhase2(
  supabaseClient: any,
  corsHeaders: Record<string, string>,
  params: {
    dedupGroupId: string;
    sessionId: string;
  }
) {
  try {
    const { dedupGroupId, sessionId } = params;

    console.log(`🔍 Pilot-Scan Phase 2: Enriching group ${dedupGroupId}`);

    // Load dedup group
    const { data: dedupGroupData, error: dedupError } = await supabaseClient
      .from('quickscan_dedup_groups')
      .select('*')
      .eq('id', dedupGroupId)
      .single();

    if (dedupError || !dedupGroupData) {
      console.error('Dedup group not found:', dedupError);
      return new Response(
        JSON.stringify({ error: 'Dedup group not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Reconstruct broker profiles
    const brokerProfiles = reconstructBrokerProfiles(dedupGroupData.full_data);

    // Run Phase 2
    const orchestrator = new Phase2Orchestrator();
    const result = await orchestrator.runPhase2(
      dedupGroupData as unknown as DedupGroup,
      brokerProfiles,
      {
        timeout: 45000,
        includeLeakcheck: !!Deno.env.get('LEAKCHECK_API_KEY'),
      }
    );

    if (!result.success) {
      console.error(`Phase 2 failed: ${result.error}`);
      await trackCost(supabaseClient, null, sessionId, 2, null, estimateCost(2), {
        status: 'failed',
        error: result.error,
      });

      return new Response(
        JSON.stringify({ error: result.error || 'Enrichment failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Store results
    const enrichmentId = await orchestrator.storeResults(
      supabaseClient,
      `pilot-${sessionId}`,
      dedupGroupId,
      result
    );

    // Track cost
    if (result.metadata) {
      await trackCost(supabaseClient, null, sessionId, 2, null, result.metadata.phase2_cost_usd, {
        status: 'success',
        emails_found: result.metadata.emails_found,
        services_found: result.metadata.services_found,
        breaches_found: result.metadata.breaches_found,
      });
    }

    console.log(`✅ Phase 2 complete: profile enriched`);

    return new Response(
      JSON.stringify({
        success: true,
        consolidated_profile: result.consolidated_profile,
        enrichment: result.enrichment_data,
        metadata: result.metadata,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Phase 2 handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Phase 2 processing failed', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Reconstruct broker profiles from dedup group JSONB
 */
function reconstructBrokerProfiles(fullData: Record<string, any>): Record<string, unknown> {
  const profiles: Record<string, unknown> = {};

  if (fullData.members && Array.isArray(fullData.members)) {
    for (const member of fullData.members) {
      profiles[member.broker] = member.summary;
    }
  }

  return profiles;
}
