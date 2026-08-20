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
import { BrokerName, type QuickScanInput, type DedupGroup } from '../_shared/quickscan/quickscan-phase1-phase2-models.ts'

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
  /** The quick_scans UUID Phase 1 returned. Echoed back so Phase 2 can hang the
   *  selected group and its enrichment off the same scan row. */
  quickScanId?: string;
  /** Subset of brokers to search — used for the fast (Zaba)/slow (FPS+NPD+AnyWho) two-tier split. Omit for all 4. */
  brokers?: string[];
  /**
   * Which half of the two-tier split this request is. Both tiers share one
   * sessionId and therefore one quick_scans row, so their results are stored
   * under separate candidate_matches keys rather than overwriting each other.
   * Derived from `brokers` when the caller omits it, so older clients still
   * land in the right bucket.
   */
  tier?: string;
  /** Phase 2: the merged dedup group the user picked, sent inline so Phase 2 doesn't need a DB round trip yet. */
  selectedGroup?: DedupGroup;
}

// ZIP to STATE mapping — a coarse last resort, NOT a geocoder.
//
// The authoritative resolution happens client-side in QuickScanForm, which
// calls zippopotam.us as the user types and blocks submission until the zip
// resolves (see 79db6c1). Every request originating from the UI therefore
// arrives with city and state already populated, and those values win.
//
// This map only covers ~50 three-digit prefixes and yields state alone — it
// can never produce a city. It exists so a caller that omits state still gets
// a usable one; a missing CITY is treated as a hard error, because all four
// broker URL builders interpolate city unconditionally and an empty value
// silently produces four malformed URLs at once. See handlePhase1.
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

// The seven-entry hardcoded zip→city map that used to live here was removed.
// It "resolved" 0.002% of US zips and returned `city: ''` for the rest, which
// read as success while producing broken scrape URLs for every broker. Callers
// must supply a real city; see the guard in handlePhase1.

/**
 * Name the half of the two-tier split a Phase 1 request belongs to.
 *
 * Both tiers carry the same sessionId and therefore write into the same
 * quick_scans row; `record_phase1_tier` keys candidate_matches by this string
 * so neither overwrites the other. The client sends it explicitly — the
 * broker-list fallback exists only so a client deployed before that change
 * still lands in two distinct buckets rather than colliding on one.
 */
function resolveTier(tier: string | undefined, brokers?: BrokerName[]): string {
  const explicit = (tier || '').trim().toLowerCase();
  if (explicit) return explicit;
  if (!brokers?.length) return 'all';
  // Sorted broker names: self-describing, and provably distinct between the
  // fast (zaba) and slow (fps/npd/anywho) requests.
  return [...brokers].map((b) => String(b).toLowerCase()).sort().join('+');
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
      quickScanId,
      brokers,
      tier,
      selectedGroup,
    } = requestBody as PilotScanRequest;

    const resolvedLast = lastName || last_name;
    const resolvedZip = zipcode || zipCode;

    // Determine if this is Phase 1 or Phase 2
    if (selectedGroup) {
      // Phase 2: Enrichment — group came from the client (already merged fast+slow tiers),
      // no DB round trip needed.
      return await handlePhase2WithGroup(supabaseClient, corsHeaders, {
        selectedGroup,
        sessionId: sessionId || 'anonymous',
        quickScanId,
      });
    } else if (dedupGroupId) {
      // Phase 2: Enrichment — legacy path, loads the group from the DB by id
      return await handlePhase2(supabaseClient, corsHeaders, {
        dedupGroupId,
        sessionId: sessionId || 'anonymous',
      });
    } else if (firstName && resolvedLast && resolvedZip) {
      // Phase 1: Search
      const brokerFilter = brokers
        ?.map((b) => b.toLowerCase())
        .filter((b): b is BrokerName => (Object.values(BrokerName) as string[]).includes(b));
      return await handlePhase1(supabaseClient, corsHeaders, {
        firstName,
        lastName: resolvedLast,
        zipcode: resolvedZip,
        city,
        state,
        sessionId: sessionId || 'anonymous',
        brokers: brokerFilter?.length ? brokerFilter : undefined,
        tier,
      });
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid request: provide (firstName, lastName, zipcode) for Phase 1 or (dedupGroupId/selectedGroup) for Phase 2' }),
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
    brokers?: BrokerName[];
    tier?: string;
  }
) {
  try {
    const { firstName, lastName, zipcode, sessionId, brokers } = params;
    const tier = resolveTier(params.tier, brokers);

    console.log(`🔍 Pilot-Scan Phase 1: ${firstName} ${lastName}, ZIP ${zipcode}${brokers ? ` [${brokers.join(",")}]` : ""}`);

    // City is resolved client-side (zippopotam.us) before submit and arrives on
    // the request. State falls back to a coarse prefix map; city has no fallback
    // by design.
    const city = (params.city || '').trim();
    const state = (params.state || zipcodeToState(zipcode) || '').trim();

    // Fail loudly rather than scraping with an empty city. buildFpsUrl,
    // buildNpdUrl, buildAnywhoUrl and buildZabaUrl all interpolate city straight
    // into the path, so an empty value yields four malformed URLs and a
    // "no results" that looks like a clean scan instead of a broken one.
    if (!city || !state) {
      const missing = [!city && 'city', !state && 'state'].filter(Boolean).join(' and ');
      console.error(
        `✗ Pilot-Scan Phase 1 aborted: could not resolve ${missing} for ZIP ${zipcode}. ` +
        `city/state must be supplied by the caller (the UI resolves them via zippopotam.us ` +
        `before enabling submit); there is no server-side city lookup.`,
      );
      return new Response(
        JSON.stringify({
          error: `Could not resolve ${missing} for ZIP ${zipcode}`,
          code: 'location_unresolved',
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

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
    const result = await orchestrator.runPhase1(input, { timeout: 45000, brokers });

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

    // Step 5: Persist the scan row and this tier's results.
    //
    // This replaces the old orchestrator.storeResults(..., `pilot-${sessionId}`, ...)
    // call, which could never have worked: it passed a TEXT id into
    // quickscan_dedup_groups.quick_scan_id (uuid NOT NULL), threw on the cast
    // every time, and had the error swallowed by a `continue` — so Phase 1
    // reported success while storing nothing. See docs/SCHEMA_REVIEW.md §2.
    //
    // Dedup groups are deliberately NOT written here. The user picks from a
    // client-side MERGE of both tiers, so a per-tier group row would be a
    // partial record of something nobody was ever shown. Phase 2 writes the
    // one group that was actually selected; the raw per-tier output is kept
    // as JSONB on candidate_matches for funnel analysis.
    let quickScanId: string | null = null;
    const { data: scanIdData, error: scanIdError } = await supabaseClient
      .schema('quickscan')
      .rpc('record_phase1_tier', {
        p_session_id: sessionId,
        p_search_input: { first_name: firstName, last_name: lastName, zip_code: zipcode, city, state },
        p_tier: tier,
        p_groups: result.dedup_groups,
      });

    if (scanIdError) {
      // Storage failure must be loud but must not cost the user their scan —
      // the results are already in hand and still get returned below.
      console.error(`✗ Phase 1 persistence failed (tier=${tier}, session=${sessionId}): ${scanIdError.message}`);
    } else {
      quickScanId = scanIdData as string;
      console.log(`💾 Phase 1 tier '${tier}' stored on scan ${quickScanId}`);
    }

    // Step 6: Track cost — now against a real scan id rather than NULL
    await trackCost(supabaseClient, null, sessionId, 1, quickScanId, estimateCost(1), {
      status: 'success',
      dedup_groups: result.dedup_groups.length,
    });

    console.log(`✅ Phase 1 complete: ${result.dedup_groups.length} groups`);

    // Step 7: Return summary for modal selection
    return new Response(
      JSON.stringify({
        success: true,
        quick_scan_id: quickScanId,
        dedup_groups: result.dedup_groups.map((g) => ({
          // Left null on purpose: no dedup_groups row exists yet, and the
          // client identifies groups positionally within its merged list.
          id: null,
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

    // Run Phase 2 — scrapes each member's broker detail page directly (see detail-scrapers.ts)
    const orchestrator = new Phase2Orchestrator();
    const result = await orchestrator.runPhase2(
      dedupGroupData.full_data as unknown as DedupGroup,
      {
        timeout: 45000,
        includeLeakcheck: !!Deno.env.get('LEAKCHECK_API_KEY'),
        detailTimeoutMs: 20000,
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

    // Store results.
    //
    // Uses the scan id carried on the dedup group row rather than the
    // `pilot-${sessionId}` string this previously passed: that is a TEXT value
    // going into quickscan_enrichment.quick_scan_id (uuid NOT NULL), so it
    // threw on the cast every time and storeResults returned null — the same
    // failure this file's Phase 1 path had (docs/SCHEMA_REVIEW.md §2). The
    // group was loaded from the database above, so a real uuid is already here.
    const enrichmentId = await orchestrator.storeResults(
      supabaseClient,
      dedupGroupData.quick_scan_id,
      dedupGroupId,
      result
    );

    if (enrichmentId) {
      await finalizeScan(supabaseClient, dedupGroupData.quick_scan_id, dedupGroupId, enrichmentId, result);
    } else {
      console.error(`✗ Phase 2 (legacy path) enrichment storage failed for group ${dedupGroupId}`);
    }

    // Track cost
    if (result.metadata) {
      await trackCost(supabaseClient, null, sessionId, 2, dedupGroupData.quick_scan_id, result.metadata.phase2_cost_usd, {
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
 * Handle Phase 2 with the dedup group sent inline by the client (the merged
 * fast+slow Phase 1 result the user picked from) — no DB round trip needed to
 * READ the group.
 *
 * This is the group the user actually chose, merged across both tiers, which
 * is why it is the only one written to quickscan_dedup_groups: a per-tier row
 * would record a half of something nobody was shown. The enrichment then hangs
 * off that row, and quick_scans gets back-pointers to both.
 *
 * Persistence is best-effort by design. Every write below is allowed to fail
 * without failing the request — the user already paid for this scrape and gets
 * their result either way. Failures are logged loudly rather than swallowed,
 * which is the bug this whole path is fixing (docs/SCHEMA_REVIEW.md §2).
 */
async function handlePhase2WithGroup(
  supabaseClient: any,
  corsHeaders: Record<string, string>,
  params: {
    selectedGroup: DedupGroup;
    sessionId: string;
    quickScanId?: string;
  }
) {
  try {
    const { selectedGroup, sessionId, quickScanId } = params;

    console.log(`🔍 Pilot-Scan Phase 2 (inline group): Enriching ${selectedGroup.members[0]?.summary.full_name || 'unknown'}`);

    const orchestrator = new Phase2Orchestrator();
    const result = await orchestrator.runPhase2(selectedGroup, {
      timeout: 45000,
      includeLeakcheck: !!Deno.env.get('LEAKCHECK_API_KEY'),
      detailTimeoutMs: 20000,
    });

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

    // Persist: selected group -> enrichment -> back-pointers on the scan.
    // Skipped entirely when Phase 1 never produced a scan id (its own write
    // failed, or a client predating the quick_scan_id round trip), because
    // both quickscan_dedup_groups.quick_scan_id and
    // quickscan_enrichment.quick_scan_id are uuid NOT NULL.
    let dedupGroupId: string | null = null;
    let enrichmentId: string | null = null;

    if (quickScanId) {
      dedupGroupId = await storeSelectedGroup(supabaseClient, quickScanId, sessionId, selectedGroup);

      if (dedupGroupId) {
        enrichmentId = await new Phase2Orchestrator().storeResults(
          supabaseClient,
          quickScanId,
          dedupGroupId,
          result,
        );
        if (!enrichmentId) {
          console.error(`✗ Phase 2 enrichment storage failed (scan=${quickScanId}, group=${dedupGroupId})`);
        }
      }

      await finalizeScan(supabaseClient, quickScanId, dedupGroupId, enrichmentId, result);
    } else {
      console.warn(
        `⚠ Phase 2 not persisted: no quick_scan_id for session ${sessionId}. ` +
        `Phase 1 either failed to store or the client did not echo the id back.`,
      );
    }

    if (result.metadata) {
      await trackCost(supabaseClient, null, sessionId, 2, quickScanId ?? null, result.metadata.phase2_cost_usd, {
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
        quick_scan_id: quickScanId ?? null,
        dedup_group_id: dedupGroupId,
        enrichment_id: enrichmentId,
        consolidated_profile: result.consolidated_profile,
        enrichment: result.enrichment_data,
        metadata: result.metadata,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Phase 2 (inline group) handler error:', error);
    return new Response(
      JSON.stringify({ error: 'Phase 2 processing failed', details: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Write the dedup group the user selected — the merged fast+slow record — and
 * return its id.
 *
 * Mirrors the column derivation in Phase1Orchestrator.storeResults() so the two
 * writers produce comparable rows. `rank: 1` because exactly one group is ever
 * stored per scan on this path: the chosen one.
 *
 * Returns null on failure rather than throwing — the caller treats persistence
 * as best-effort and must still return the user's result.
 */
async function storeSelectedGroup(
  supabaseClient: any,
  quickScanId: string,
  sessionId: string,
  group: DedupGroup,
): Promise<string | null> {
  const members = group.members ?? [];
  const primary = members[0]?.summary;
  const addressParts = (primary?.address || '').split(',');
  const avgConfidence = members.length
    ? Math.round((members.reduce((sum, m) => sum + (m.match_score ?? 0), 0) / members.length) * 100) / 100
    : 0;

  const { data, error } = await supabaseClient
    .schema('quickscan')
    .from('quickscan_dedup_groups')
    .insert({
      quick_scan_id: quickScanId,
      session_id: sessionId,
      dedup_id: group.dedup_id,
      rank: 1,
      primary_name: primary?.full_name || '',
      primary_age: primary?.age ?? null,
      primary_city: addressParts[0]?.trim() || '',
      primary_state: addressParts[1]?.trim() || '',
      average_confidence: avgConfidence,
      age_conflict: !!group.age_conflict,
      age_note: group.age_note ?? null,
      sources: members.map((m) => m.summary?.broker).filter(Boolean),
      members_count: members.length,
      full_data: group,
      phase1_cost_usd: 0.0025,
      // purge_after intentionally omitted — the column default (now() + 7 days)
      // is the single definition of the retention window.
    })
    .select('id');

  if (error) {
    console.error(`✗ Failed to store selected dedup group (scan=${quickScanId}): ${error.message}`);
    return null;
  }

  return data?.[0]?.id ?? null;
}

/**
 * Close out the scan row: record which group and enrichment it resolved to,
 * and park the consolidated profile on profile_data so the read-back RPC has a
 * single place to look.
 *
 * Status only advances to 'completed' when the enrichment actually stored;
 * otherwise the scan stays 'processing' and reads as the incomplete record it
 * is, rather than claiming a result it cannot produce.
 */
async function finalizeScan(
  supabaseClient: any,
  quickScanId: string,
  dedupGroupId: string | null,
  enrichmentId: string | null,
  result: { consolidated_profile?: unknown },
): Promise<void> {
  const complete = !!enrichmentId;

  const { error } = await supabaseClient
    .schema('quickscan')
    .from('quick_scans')
    .update({
      dedup_group_id: dedupGroupId,
      enrichment_id: enrichmentId,
      selected_match_id: dedupGroupId,
      profile_data: result.consolidated_profile ?? null,
      status: complete ? 'completed' : 'processing',
      completed_at: complete ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', quickScanId);

  if (error) {
    console.error(`✗ Failed to finalize scan ${quickScanId}: ${error.message}`);
  }
}
