import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { ContextDevError, scrapeHtml } from "../_shared/quickscan/context-dev-client.ts";
import {
  buildRplUrl,
  buildZabaPhoneUrl,
  parsePhoneLookupHtml,
  type PhoneLookupResult,
  type PhoneLookupSource,
} from "../_shared/quickscan/phone-lookup-parser.ts";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(body: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  const d = digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
  return d.length === 10 ? d : null;
}

function phoneE164(digits: string): string {
  return `+1${digits}`;
}

function scrapeStatus(
  err: unknown,
  found: boolean,
  result: PhoneLookupResult,
): "success" | "partial" | "failed" | "timeout" | "blocked" | "no_results" {
  if (err instanceof ContextDevError && err.errorCode === "WEBSITE_BLOCKED") return "blocked";
  if (err instanceof Error && /timeout|timed out|AbortError/i.test(err.name + err.message)) {
    return "timeout";
  }
  if (err) return "failed";
  if (!found) return "no_results";
  if (!result.name) return "partial";
  return "success";
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const phoneRaw = body.phone;
    if (!phoneRaw || typeof phoneRaw !== "string") {
      return json({ error: "missing_phone" }, 400, corsHeaders);
    }

    const normalized = normalizePhone(phoneRaw);
    if (!normalized) {
      return json({ error: "invalid_phone" }, 400, corsHeaders);
    }

    const quickscanId = typeof body.quickscanId === "string" && UUID_RE.test(body.quickscanId)
      ? body.quickscanId
      : typeof body.quickscan_id === "string" && UUID_RE.test(body.quickscan_id)
      ? body.quickscan_id
      : null;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const sources: Array<{ source: PhoneLookupSource; url: string }> = [
      { source: "rpl", url: buildRplUrl(normalized) },
      { source: "zaba", url: buildZabaPhoneUrl(normalized) },
    ];

    let chosen: PhoneLookupResult | null = null;

    for (const spec of sources) {
      const started = Date.now();
      let found = false;
      let parsed = parsePhoneLookupHtml("", normalized, spec.url, spec.source).result;
      let error: unknown = null;
      try {
        console.log(`[phone-lookup] ${spec.source} context.dev ${spec.url}`);
        const page = await scrapeHtml(spec.url);
        if (!page.notFound && !page.blocked) {
          const outcome = parsePhoneLookupHtml(page.html, normalized, spec.url, spec.source);
          parsed = outcome.result;
          found = outcome.found;
        }
      } catch (err) {
        error = err;
        console.error(`[phone-lookup] ${spec.source} failed:`, err);
      }

      const status = scrapeStatus(error, found, parsed);
      const responseTimeMs = Date.now() - started;

      const { error: insertError } = await supabase.schema("quickscan").from("phone_lookups").insert({
        quickscans_id: quickscanId,
        phone_e164: phoneE164(normalized),
        phone_digits: normalized,
        source: spec.source,
        source_url: spec.url,
        status,
        name: parsed.name,
        age: parsed.age,
        birth_year: parsed.birth_year,
        line_type: parsed.line_type,
        carrier: parsed.carrier,
        location: parsed.location,
        time_zone: parsed.time_zone,
        aliases: parsed.aliases,
        related_persons: parsed.related_persons,
        most_recent_address: parsed.most_recent_address,
        previous_addresses: parsed.previous_addresses,
        email_domains: parsed.email_domains,
        previous_phones: parsed.previous_phones,
        social_media: parsed.social_media,
        jobs: parsed.jobs,
        education: parsed.education,
        professional_licenses: parsed.professional_licenses,
        raw: parsed,
        error: error instanceof Error ? error.message : error ? String(error) : null,
        response_time_ms: responseTimeMs,
      });
      if (insertError) {
        console.error(`[phone-lookup] persist ${spec.source} failed:`, insertError.message);
      }

      if (status === "success" || status === "partial") {
        chosen = parsed;
        break;
      }
    }

    if (!chosen) {
      return json({ error: "no_result" }, 404, corsHeaders);
    }

    return json(chosen, 200, corsHeaders);
  } catch (err) {
    console.error("[phone-lookup] error:", err);
    return json({ error: "fetch_failed" }, 502, corsHeaders);
  }
});
