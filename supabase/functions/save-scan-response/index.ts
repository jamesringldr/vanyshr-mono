/**
 * save-scan-response — stores one answer from the /finding-your-data question
 * carousel. Pre-auth (verify_jwt = false), so the write goes through the
 * service role; quickscan.quickscan_responses has RLS on with no client policies.
 *
 * Upserts on (quickscans_id, question_key), so going Back and answering again
 * replaces the earlier answer.
 *
 * Input: { quickscanId, questionKey, answer: string[], skipped?: boolean }
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Versioned snake_case keys, e.g. "reasons_v1".
const QUESTION_KEY_RE = /^[a-z][a-z0-9_]{0,62}_v\d{1,3}$/;
// Option ids are short snake_case words, e.g. "exposure", "yes".
const OPTION_ID_RE = /^[a-z0-9_]{1,40}$/;
const MAX_OPTIONS = 20;

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status: number) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const quickscanId = String(body.quickscanId ?? "").trim();
    const questionKey = String(body.questionKey ?? "").trim();
    const skipped = body.skipped === true;
    const answer: unknown = body.answer ?? [];

    if (!UUID_RE.test(quickscanId)) return json({ success: false, error: "Invalid quickscanId" }, 400);
    if (!QUESTION_KEY_RE.test(questionKey)) return json({ success: false, error: "Invalid questionKey" }, 400);
    if (
      !Array.isArray(answer) ||
      answer.length > MAX_OPTIONS ||
      !answer.every((id) => typeof id === "string" && OPTION_ID_RE.test(id))
    ) {
      return json({ success: false, error: "Invalid answer" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const { error } = await supabase.schema("quickscan").from("quickscan_responses").upsert(
      {
        quickscans_id: quickscanId,
        question_key: questionKey,
        answer: skipped ? [] : [...new Set(answer as string[])],
        skipped,
        answered_at: new Date().toISOString(),
      },
      { onConflict: "quickscans_id,question_key" },
    );

    if (error) {
      // 23503: the quick scan doesn't exist (FK).
      const status = error.code === "23503" ? 404 : 500;
      console.error("save-scan-response upsert error:", error);
      return json({ success: false, error: status === 404 ? "Unknown quick scan" : error.message }, status);
    }

    return json({ success: true }, 200);
  } catch (error) {
    console.error("save-scan-response error:", error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
