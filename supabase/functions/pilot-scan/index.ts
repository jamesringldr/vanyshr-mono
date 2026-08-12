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
import { Phase2Orchestrator, type Phase2Stage } from '../_shared/quickscan/phase2-orchestrator.ts'
import { checkRateLimit, trackCost, estimateCost, checkBurstProtection } from '../_shared/quickscan/cost-middleware.ts'
import { type QuickScanInput, type DedupGroup, type DedupMember, type BreachRecord } from '../_shared/quickscan/quickscan-phase1-phase2-models.ts'

interface PilotScanRequest {
  firstName?: string;
  lastName?: string;
  last_name?: string;
  zipcode?: string;
  zipCode?: string;
  sessionId?: string;
  dedupGroupId?: string;
  /** Phase 2 stage for UI step sync (omit = full Phase 2) */
  enrichStage?: "profile" | "holehe" | "leakcheck" | "finalize";
  emails?: string[];
  holehe_services?: string[];
  leakcheck_breaches?: unknown[];
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

// Hardcoded fallbacks when zip_lookup has no row
const MAJOR_ZIPS: Record<string, { city: string; state: string }> = {
  '10001': { city: 'New York', state: 'NY' },
  '90210': { city: 'Beverly Hills', state: 'CA' },
  '60601': { city: 'Chicago', state: 'IL' },
  '75201': { city: 'Dallas', state: 'TX' },
  '98101': { city: 'Seattle', state: 'WA' },
  '65251': { city: 'Cameron', state: 'MO' }, // Pilot test case
};

async function zipcodeToCity(
  supabaseClient: { from: (t: string) => any },
  zipcode: string,
): Promise<{ city: string; state: string }> {
  const zip = zipcode.replace(/\D/g, '').slice(0, 5);
  try {
    const { data } = await supabaseClient
      .from('zip_lookup')
      .select('city, state_code')
      .eq('zip', zip)
      .maybeSingle();
    if (data?.city && data?.state_code) {
      return { city: data.city as string, state: data.state_code as string };
    }
  } catch (err) {
    console.warn('zip_lookup query failed:', (err as Error).message);
  }

  if (MAJOR_ZIPS[zip]) return MAJOR_ZIPS[zip];
  return { city: '', state: zipcodeToState(zip) };
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

    // Parse request — accept both camelCase and snake_case from clients
    const requestBody = await req.json() as PilotScanRequest & { ping?: boolean };

    // Warm-up ping from the client — no-op success
    if (requestBody.ping) {
      return new Response(JSON.stringify({ ok: true, ping: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstName = requestBody.firstName?.trim();
    const lastName = (requestBody.lastName ?? requestBody.last_name)?.trim();
    const zipcode = (requestBody.zipcode ?? requestBody.zipCode)?.trim();
    const sessionId = requestBody.sessionId || 'anonymous';
    const dedupGroupId = requestBody.dedupGroupId;

    // Determine if this is Phase 1 or Phase 2
    if (dedupGroupId) {
      // Phase 2: Enrichment (full or staged)
      return await handlePhase2(supabaseClient, corsHeaders, {
        dedupGroupId,
        sessionId,
        enrichStage: requestBody.enrichStage,
        emails: requestBody.emails,
        holehe_services: requestBody.holehe_services,
        leakcheck_breaches: requestBody.leakcheck_breaches as BreachRecord[] | undefined,
      });
    } else if (firstName && lastName && zipcode) {
      // Phase 1: Search
      return await handlePhase1(supabaseClient, corsHeaders, {
        firstName,
        lastName,
        zipcode,
        sessionId,
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
    sessionId: string;
  }
) {
  try {
    const { firstName, lastName, zipcode, sessionId } = params;

    console.log(`🔍 Pilot-Scan Phase 1: ${firstName} ${lastName}, ZIP ${zipcode}`);

    // Step 1: Lookup city/state from zipcode (DB first, then fallbacks)
    const { city, state } = await zipcodeToCity(supabaseClient, zipcode);
    console.log(`📍 Zipcode lookup: ${zipcode} → ${city}, ${state}`);

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

    // Step 4: Create quick_scans row (FK target for dedup groups)
    // source/status must match quick_scans CHECK constraints
    const { data: scanRow, error: scanError } = await supabaseClient
      .from('quick_scans')
      .insert({
        session_id: sessionId,
        search_input: { firstName, lastName, zipcode, city, state },
        status: 'scanning',
        source: 'invite',
      })
      .select('id')
      .single();

    if (scanError || !scanRow?.id) {
      console.error('Failed to create quick_scans row:', scanError);
      return new Response(
        JSON.stringify({ error: 'Failed to start scan', details: scanError?.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const quickScanId = scanRow.id as string;

    // Step 5: Run Phase 1
    const orchestrator = new Phase1Orchestrator();
    const input: QuickScanInput = {
      first_name: firstName,
      last_name: lastName,
      city,
      state,
      zip: zipcode,
    };
    const result = await orchestrator.runPhase1(input, { timeout: 150000 });

    if (!result.success) {
      console.error(`Phase 1 failed: ${result.error}`);
      await supabaseClient
        .from('quick_scans')
        .update({ status: 'failed', error_message: result.error ?? 'Search failed' })
        .eq('id', quickScanId);

      await trackCost(supabaseClient, null, sessionId, 1, quickScanId, estimateCost(1), {
        status: 'failed',
        error_message: result.error,
      });

      return new Response(
        JSON.stringify({ error: result.error || 'Search failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 6: Store dedup groups
    const dedupGroupIds = await orchestrator.storeResults(
      supabaseClient,
      quickScanId,
      result,
      sessionId,
    );

    // Step 7: Track cost + mark scan ready for selection
    await trackCost(supabaseClient, null, sessionId, 1, quickScanId, estimateCost(1), {
      status: 'success',
      dedup_groups: dedupGroupIds.length,
      profiles_found: result.metadata.profiles_found,
    });

    const nextStatus =
      dedupGroupIds.length === 0
        ? 'no_matches'
        : dedupGroupIds.length === 1
          ? 'matches_found'
          : 'selection_required';

    await supabaseClient
      .from('quick_scans')
      .update({
        status: nextStatus,
        profile_matches: result.dedup_groups.map((g, idx) => ({
          id: dedupGroupIds[idx] || g.dedup_id,
          name: g.members[0]?.summary.full_name || '',
          age: g.members[0]?.summary.age != null ? String(g.members[0].summary.age) : undefined,
          city_state: g.members[0]?.summary.address || '',
          source: g.members.map((m) => m.summary.broker).join(','),
        })),
        dedup_group_id: dedupGroupIds[0] ?? null,
        data_sources: result.metadata.brokers_scraped,
      })
      .eq('id', quickScanId);

    console.log(`✅ Phase 1 complete: ${result.dedup_groups.length} groups`);

    // Step 8: Return summary for modal selection
    return new Response(
      JSON.stringify({
        success: true,
        quick_scan_id: quickScanId,
        dedup_groups: result.dedup_groups.map((g, idx) => ({
          id: dedupGroupIds[idx] || null,
          name: g.members[0]?.summary.full_name || '',
          age: g.members[0]?.summary.age,
          city: g.members[0]?.summary.address.split(',')[0]?.trim() || '',
          state: g.members[0]?.summary.address.split(',')[1]?.trim() || '',
          sources: g.members.map((m) => m.summary.broker),
          confidence: Math.round((g.members.reduce((s, m) => s + m.match_score, 0) / g.members.length) * 10) / 10,
          members: g.members.map((m) => ({
            broker: m.summary.broker,
            name: m.summary.full_name,
            address: m.summary.address,
            age: m.summary.age,
            match_score: m.match_score,
          })),
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
 * Handle Phase 2: Full profile enrichment (all-at-once or staged for UI sync)
 */
async function handlePhase2(
  supabaseClient: any,
  corsHeaders: Record<string, string>,
  params: {
    dedupGroupId: string;
    sessionId: string;
    enrichStage?: Phase2Stage;
    emails?: string[];
    holehe_services?: string[];
    leakcheck_breaches?: BreachRecord[];
  }
) {
  try {
    const { dedupGroupId, sessionId, enrichStage } = params;

    console.log(
      `🔍 Pilot-Scan Phase 2: Enriching group ${dedupGroupId}` +
        (enrichStage ? ` [stage=${enrichStage}]` : " [full]"),
    );

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

    const brokerProfiles = reconstructBrokerProfiles(dedupGroupData.full_data);
    const members = (dedupGroupData.full_data?.members || []) as DedupMember[];
    const dedupGroup: DedupGroup = {
      dedup_id: dedupGroupData.dedup_id,
      members,
      age_conflict: Boolean(dedupGroupData.age_conflict),
      age_note: dedupGroupData.age_note ?? undefined,
    };

    const orchestrator = new Phase2Orchestrator();

    // Staged path — one UI loader step per stage
    if (enrichStage) {
      const stageResult = await orchestrator.runStage(
        enrichStage,
        dedupGroup,
        brokerProfiles,
        {
          emails: params.emails,
          holehe_services: params.holehe_services,
          leakcheck_breaches: params.leakcheck_breaches,
        },
      );

      if (!stageResult.success) {
        return new Response(
          JSON.stringify({ error: stageResult.error || `Stage ${enrichStage} failed` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Finalize also persists
      if (enrichStage === "finalize" && stageResult.consolidated_profile) {
        const fullResult = {
          success: true as const,
          consolidated_profile: stageResult.consolidated_profile,
          enrichment_data: stageResult.enrichment_data,
          metadata: {
            total_phase2_ms: stageResult.timing_ms || 0,
            email_extract_ms: 0,
            holehe_ms: 0,
            leakcheck_ms: 0,
            consolidate_ms: stageResult.timing_ms || 0,
            emails_found: (stageResult.emails || []).length,
            services_found: (stageResult.holehe_services || []).length,
            breaches_found: (stageResult.leakcheck_breaches || []).length,
            phase2_cost_usd: 0.007,
          },
        };

        const enrichmentId = await orchestrator.storeResults(
          supabaseClient,
          dedupGroupData.quick_scan_id,
          dedupGroupId,
          fullResult,
          sessionId,
        );

        await trackCost(supabaseClient, null, sessionId, 2, dedupGroupData.quick_scan_id, 0.007, {
          status: 'success',
          emails_found: fullResult.metadata.emails_found,
          services_found: fullResult.metadata.services_found,
          breaches_found: fullResult.metadata.breaches_found,
        });

        if (enrichmentId) {
          await supabaseClient
            .from('quick_scans')
            .update({
              status: 'completed',
              enrichment_id: enrichmentId,
              profile_data: stageResult.consolidated_profile,
              completed_at: new Date().toISOString(),
            })
            .eq('id', dedupGroupData.quick_scan_id);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          stage: enrichStage,
          emails: stageResult.emails,
          holehe_services: stageResult.holehe_services,
          leakcheck_breaches: stageResult.leakcheck_breaches,
          consolidated_profile: stageResult.consolidated_profile,
          enrichment: stageResult.enrichment_data,
          timing_ms: stageResult.timing_ms,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Full Phase 2 (back-compat)
    const result = await orchestrator.runPhase2(
      dedupGroup,
      brokerProfiles,
      {
        timeout: 45000,
        includeLeakcheck: true,
      }
    );

    if (!result.success) {
      console.error(`Phase 2 failed: ${result.error}`);
      await trackCost(supabaseClient, null, sessionId, 2, dedupGroupData.quick_scan_id, estimateCost(2), {
        status: 'failed',
        error_message: result.error,
      });

      return new Response(
        JSON.stringify({ error: result.error || 'Enrichment failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const enrichmentId = await orchestrator.storeResults(
      supabaseClient,
      dedupGroupData.quick_scan_id,
      dedupGroupId,
      result,
      sessionId,
    );

    if (result.metadata) {
      await trackCost(supabaseClient, null, sessionId, 2, dedupGroupData.quick_scan_id, result.metadata.phase2_cost_usd, {
        status: 'success',
        emails_found: result.metadata.emails_found,
        services_found: result.metadata.services_found,
        breaches_found: result.metadata.breaches_found,
      });
    }

    if (enrichmentId) {
      await supabaseClient
        .from('quick_scans')
        .update({
          status: 'completed',
          enrichment_id: enrichmentId,
          profile_data: result.consolidated_profile,
          completed_at: new Date().toISOString(),
        })
        .eq('id', dedupGroupData.quick_scan_id);
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
