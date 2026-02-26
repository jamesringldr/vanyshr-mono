import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Service role client — required to write auth_user_id to user_profiles
    // and to call the SECURITY DEFINER function without RLS restrictions.
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // The caller must include their Bearer token so we can verify the
    // authenticated user identity and extract auth_user_id from the session.
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve the caller's identity from their session token.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("❌ Failed to resolve user from token:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired session" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { profile_id } = await req.json();

    if (!profile_id) {
      return new Response(
        JSON.stringify({ success: false, error: "profile_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔗 link-auth-to-profile: profile_id=${profile_id}, auth_user_id=${user.id}`);

    const { data, error } = await supabaseClient
      .rpc("link_auth_to_profile", {
        p_profile_id:   profile_id,
        p_auth_user_id: user.id,
        p_email:        user.email ?? "",
      });

    if (error) {
      console.error("❌ link_auth_to_profile error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.success) {
      return new Response(
        JSON.stringify({ success: false, error: data?.error ?? "Unknown error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Profile linked: profile_id=${profile_id} → auth_user_id=${user.id}`);

    return new Response(
      JSON.stringify({
        success:      true,
        profile_id:   data.profile_id,
        auth_user_id: data.auth_user_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ link-auth-to-profile error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
