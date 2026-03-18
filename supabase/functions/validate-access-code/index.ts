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
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { code, profile_id } = await req.json();

    if (!code || !profile_id) {
      return new Response(
        JSON.stringify({ success: false, error: "code and profile_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`🔑 validate-access-code: profile_id=${profile_id}`);

    const { data, error } = await supabaseClient
      .rpc("validate_access_code", {
        p_code:       code,
        p_profile_id: profile_id,
      });

    if (error) {
      console.error("❌ validate_access_code error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!data?.success) {
      console.warn(`⚠️ Invalid code attempt: profile_id=${profile_id} reason="${data?.error}"`);
      return new Response(
        JSON.stringify({ success: false, error: data?.error ?? "Invalid access code" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ Access code validated: profile_id=${profile_id}`);

    return new Response(
      JSON.stringify({ success: true, profile_id: data.profile_id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("❌ validate-access-code error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
