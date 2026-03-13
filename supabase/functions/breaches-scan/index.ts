/**
 * breaches-scan
 *
 * Scans all emails for a given profile against the HIBP API and upserts
 * results into data_breaches.
 *
 * Accepted callers:
 *   1. Internal (breach-scan-all / pg-cron) — Authorization: Bearer <service_role_key>
 *   2. Client (onboarding emails page)      — Authorization: Bearer <user_jwt>
 *
 * Rate limit: HIBP allows 10 /breachedaccount requests per minute.
 * We enforce 6 000ms between each email-level lookup to stay within that.
 *
 * Deploy with: supabase functions deploy breaches-scan --no-verify-jwt
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders } from '../_shared/cors.ts'

// ─── HIBP types ───────────────────────────────────────────────────────────────

interface HIBPBreach {
  Name: string; Title: string; Domain: string; BreachDate: string;
  AddedDate: string; ModifiedDate: string; PwnCount: number;
  Description: string; LogoPath: string; DataClasses: string[];
  IsVerified: boolean; IsFabricated: boolean; IsSensitive: boolean;
  IsRetired: boolean; IsSpamList: boolean; IsMalware: boolean;
}

interface HIBPAPIResponse {
  Name?: string; Title?: string; Domain?: string; BreachDate?: string;
  AddedDate?: string; ModifiedDate?: string; PwnCount?: number;
  Description?: string; LogoPath?: string; DataClasses?: string[];
  IsVerified?: boolean; IsFabricated?: boolean; IsSensitive?: boolean;
  IsRetired?: boolean; IsSpamList?: boolean; IsMalware?: boolean;
  name?: string; title?: string; domain?: string; breachDate?: string;
  addedDate?: string; modifiedDate?: string; pwnCount?: number;
  description?: string; logoPath?: string; dataClasses?: string[];
  isVerified?: boolean; isFabricated?: boolean; isSensitive?: boolean;
  isRetired?: boolean; isSpamList?: boolean; isMalware?: boolean;
}

function normalizeHIBPResponse(r: HIBPAPIResponse): HIBPBreach {
  return {
    Name:         r.Name         || r.name         || '',
    Title:        r.Title        || r.title        || '',
    Domain:       r.Domain       || r.domain       || '',
    BreachDate:   r.BreachDate   || r.breachDate   || '',
    AddedDate:    r.AddedDate    || r.addedDate    || '',
    ModifiedDate: r.ModifiedDate || r.modifiedDate || '',
    PwnCount:     r.PwnCount     || r.pwnCount     || 0,
    Description:  r.Description  || r.description  || '',
    LogoPath:     r.LogoPath     || r.logoPath     || '',
    DataClasses:  r.DataClasses  || r.dataClasses  || [],
    IsVerified:   r.IsVerified   ?? r.isVerified   ?? false,
    IsFabricated: r.IsFabricated ?? r.isFabricated ?? false,
    IsSensitive:  r.IsSensitive  ?? r.isSensitive  ?? false,
    IsRetired:    r.IsRetired    ?? r.isRetired    ?? false,
    IsSpamList:   r.IsSpamList   ?? r.isSpamList   ?? false,
    IsMalware:    r.IsMalware    ?? r.isMalware    ?? false,
  };
}

const BLANK_BREACH = (name: string): HIBPBreach => ({
  Name: name, Title: name, Domain: '', BreachDate: '', AddedDate: '',
  ModifiedDate: '', PwnCount: 0, Description: '', LogoPath: '',
  DataClasses: [], IsVerified: false, IsFabricated: false,
  IsSensitive: false, IsRetired: false, IsSpamList: false, IsMalware: false,
});

// ─── HIBP fetch ───────────────────────────────────────────────────────────────

/** Fetch all HIBP breaches for a single email. Returns [] on 404/error. */
async function fetchBreachesForEmail(email: string, apiKey: string): Promise<HIBPBreach[]> {
  let breachNames: { Name: string }[] = [];

  try {
    const listRes = await fetch(
      `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}`,
      { headers: { 'hibp-api-key': apiKey, 'user-agent': 'Vanyshr-BreachesScan' } }
    );

    if (listRes.status === 404) return [];
    if (listRes.status !== 200) {
      console.error(`🔒 HIBP list error for ${email}: HTTP ${listRes.status}`);
      return [];
    }
    breachNames = await listRes.json();
    console.log(`🔒 ${email} — ${breachNames.length} breach(es)`);
  } catch (err) {
    console.error(`🔒 HIBP list fetch failed for ${email}:`, err);
    return [];
  }

  const detailed: HIBPBreach[] = [];

  for (const b of breachNames) {
    try {
      const detailRes = await fetch(
        `https://haveibeenpwned.com/api/v3/breach/${encodeURIComponent(b.Name)}`,
        { headers: { 'hibp-api-key': apiKey, 'user-agent': 'Vanyshr-BreachesScan' } }
      );
      detailed.push(
        detailRes.status === 200
          ? normalizeHIBPResponse(await detailRes.json())
          : BLANK_BREACH(b.Name)
      );
    } catch {
      detailed.push(BLANK_BREACH(b.Name));
    }
    // 100ms between breach detail requests (separate endpoint, lighter rate limit)
    await new Promise(r => setTimeout(r, 100));
  }

  return detailed;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl      = Deno.env.get('SUPABASE_URL')              ?? '';
  const serviceRoleKey   = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader       = req.headers.get('Authorization')          ?? '';

  // ── Auth guard ─────────────────────────────────────────────────────────────
  // Accept either the service role key (internal calls) or a valid user JWT
  // (client calls from the onboarding emails page).

  const isInternalCall = authHeader === `Bearer ${serviceRoleKey}`;
  let profileId: string;

  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = await req.json();

    if (isInternalCall) {
      // ── Internal call (breach-scan-all / pg-cron) ──────────────────────
      if (!body.profile_id) {
        return new Response(
          JSON.stringify({ error: 'profile_id is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      profileId = body.profile_id;
      console.log(`🔒 breaches-scan — internal call, profile: ${profileId}`);

    } else {
      // ── Client call (user JWT from onboarding page) ────────────────────
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await serviceClient.auth.getUser(token);

      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolve profile and verify ownership (prevents scanning other profiles)
      const { data: profile } = await serviceClient
        .from('user_profiles')
        .select('id')
        .eq('auth_user_id', user.id)
        .single();

      if (!profile) {
        return new Response(
          JSON.stringify({ error: 'Profile not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // If caller passed a profile_id, confirm it matches their own profile
      if (body.profile_id && body.profile_id !== profile.id) {
        return new Response(
          JSON.stringify({ error: 'Forbidden' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      profileId = profile.id;
      console.log(`🔒 breaches-scan — client call, profile: ${profileId}`);
    }

    // ── Collect emails to scan ─────────────────────────────────────────────

    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('email')
      .eq('id', profileId)
      .single();

    const { data: userEmails } = await serviceClient
      .from('user_emails')
      .select('email')
      .eq('user_id', profileId)
      .eq('is_active', true);

    const emailSet = new Set<string>();
    if (profile?.email) emailSet.add(profile.email.toLowerCase());
    (userEmails ?? []).forEach(r => { if (r.email) emailSet.add(r.email.toLowerCase()); });
    const emails = Array.from(emailSet);

    console.log(`🔒 Emails to scan (${emails.length}): ${emails.join(', ')}`);

    const apiKey = Deno.env.get('HIBP_API_KEY') ?? '';
    if (!apiKey) console.log('🔒 HIBP_API_KEY not set — skipping HIBP calls');

    let totalNewBreaches = 0;
    let totalBreaches    = 0;

    // ── Scan each email ────────────────────────────────────────────────────
    // Rate limit: HIBP allows 10 /breachedaccount requests per minute.
    // Enforcing 6 000ms between each email-level lookup stays well within that.

    for (let i = 0; i < emails.length; i++) {
      const email = emails[i];

      if (i > 0) {
        console.log(`🔒 Rate limit pause — waiting 6s before next email lookup`);
        await new Promise(r => setTimeout(r, 6000));
      }

      const breaches = apiKey ? await fetchBreachesForEmail(email, apiKey) : [];
      if (breaches.length === 0) continue;

      // Upsert — preserve status on conflict (never overwrite user's decision)
      for (const breach of breaches) {
        const { data: existing } = await serviceClient
          .from('data_breaches')
          .select('id')
          .eq('user_id', profileId)
          .eq('breach_name', breach.Name)
          .eq('matched_email', email)
          .maybeSingle();

        if (existing) {
          await serviceClient
            .from('data_breaches')
            .update({
              breach_title:       breach.Title    || null,
              breach_domain:      breach.Domain   || null,
              breach_date:        breach.BreachDate || null,
              exposed_data_types: breach.DataClasses ?? [],
              hibp_data:          breach,
            })
            .eq('id', existing.id);
          totalBreaches++;
        } else {
          const { error } = await serviceClient
            .from('data_breaches')
            .insert({
              user_id:            profileId,
              breach_name:        breach.Name,
              breach_title:       breach.Title      || null,
              breach_domain:      breach.Domain     || null,
              breach_date:        breach.BreachDate || null,
              exposed_data_types: breach.DataClasses ?? [],
              matched_email:      email,
              hibp_data:          breach,
              status:             'new',
            });
          if (!error) { totalNewBreaches++; totalBreaches++; }
          else console.error(`🔒 Insert error ${breach.Name}/${email}:`, error.message);
        }
      }
    }

    console.log(`🔒 Complete — emails: ${emails.length}, new: ${totalNewBreaches}, total: ${totalBreaches}`);

    return new Response(
      JSON.stringify({ success: true, emails_scanned: emails.length, new_breaches_found: totalNewBreaches, total_breaches: totalBreaches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('🔒 breaches-scan — unhandled error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
