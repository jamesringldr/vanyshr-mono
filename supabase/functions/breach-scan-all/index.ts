/**
 * breach-scan-all
 *
 * Called weekly by pg_cron (or manually for testing). Loops all active
 * user_profiles and triggers a breach scan for each one via breaches-scan.
 *
 * Guard: only accepts requests with Authorization: Bearer <service_role_key>.
 * This prevents public abuse while still allowing pg_cron (which passes the
 * service role key) to invoke it without a user JWT.
 *
 * Deploy with: supabase functions deploy breach-scan-all --no-verify-jwt
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabaseUrl    = Deno.env.get('SUPABASE_URL')              ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const authHeader     = req.headers.get('Authorization')          ?? '';

  // ── Guard: only service role key accepted ──────────────────────────────────
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const supabaseClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    console.log('🔒 breach-scan-all — starting weekly scan');

    const { data: profiles, error: profilesError } = await supabaseClient
      .from('user_profiles')
      .select('id')
      .eq('signup_status', 'active');

    if (profilesError) throw new Error(`Failed to fetch profiles: ${profilesError.message}`);

    if (!profiles || profiles.length === 0) {
      console.log('🔒 breach-scan-all — no active profiles found');
      return new Response(
        JSON.stringify({ success: true, profiles_scanned: 0, total_new_breaches: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`🔒 breach-scan-all — ${profiles.length} profile(s) to scan`);

    let profilesScanned  = 0;
    let totalNewBreaches = 0;

    for (const profile of profiles) {
      try {
        console.log(`🔒 Scanning profile: ${profile.id}`);

        const scanRes = await fetch(
          `${supabaseUrl}/functions/v1/breaches-scan`,
          {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              // Pass service role key — breaches-scan accepts it as an internal call
              'Authorization': `Bearer ${serviceRoleKey}`,
            },
            body: JSON.stringify({ profile_id: profile.id }),
          }
        );

        if (scanRes.ok) {
          const result = await scanRes.json();
          totalNewBreaches += result.new_breaches_found ?? 0;
          profilesScanned++;
          console.log(`🔒 Profile ${profile.id} — new: ${result.new_breaches_found}`);
        } else {
          console.error(`🔒 Scan failed for profile ${profile.id}: HTTP ${scanRes.status}`);
        }
      } catch (err) {
        console.error(`🔒 Error scanning profile ${profile.id}:`, err);
      }

      // Small buffer between users. The main rate-limit pacing (6s per email)
      // is enforced inside breaches-scan itself.
      await new Promise(r => setTimeout(r, 200));
    }

    console.log(`🔒 breach-scan-all complete — profiles: ${profilesScanned}, new breaches: ${totalNewBreaches}`);

    return new Response(
      JSON.stringify({ success: true, profiles_scanned: profilesScanned, total_new_breaches: totalNewBreaches }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('🔒 breach-scan-all — unhandled error:', (error as Error).message);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
