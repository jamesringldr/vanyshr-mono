import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { scrapeHtml } from "../_shared/quickscan/context-dev-client.ts";
import { buildPhoneLookupUrl, parsePhoneSummary } from "../_shared/scrapers/phone-page-parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { phone } = await req.json();
    if (!phone || typeof phone !== "string") {
      return json({ error: "missing_phone" }, 400);
    }

    const digits = phone.replace(/\D/g, "");
    const normalized =
      digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;
    if (normalized.length !== 10) {
      return json({ error: "invalid_phone" }, 400);
    }

    // Anywho only -- Zaba's live fetch has been dead-ended for a while
    // (fetchWithProxy() always returns null; see ZabasearchScraper.ts) and
    // a testing.phone_results study across reversephonelookup/usphonebook/
    // anywho/fps (28 test subjects, run_id 25) showed anywho as the clear
    // single-source pick: highest hit rate, lowest miss rate, and the only
    // one of the four that ever uniquely caught a match the others missed.
    // FPS/usphonebook rarely diverge from anywho without also diverging
    // from each other, and RPL blocked live on 25% of fetches -- not worth
    // the 3-source merge complexity (and the risk of surfacing a different
    // household member per source under one phone number) for a ~7%
    // absolute gain on the users who already fell through quickscan.
    const url = buildPhoneLookupUrl("anywho", normalized);
    let html: string;
    let finalUrl: string;
    try {
      const result = await scrapeHtml(url, { maxAgeMs: 0 });
      if (result.notFound) {
        return json({ error: "no_result" }, 404);
      }
      html = result.html;
      finalUrl = result.finalUrl || result.url;
    } catch (err) {
      console.error("[phone-lookup] anywho fetch failed:", err);
      return json({ error: "fetch_failed" }, 502);
    }

    const summary = parsePhoneSummary("anywho", html, finalUrl);
    if (!summary?.full_name) {
      return json({ error: "no_result" }, 404);
    }

    // Relatives/full address history/emails sit behind a "See available
    // results" link on this page with no data present to read -- left
    // null/empty rather than guessed at, same as every other field this
    // source has never had a source for.
    return json({
      phone: normalized,
      source_url: summary.profile_url ?? url,
      name: summary.full_name,
      age: summary.age !== null ? String(summary.age) : null,
      birth_year: null,
      line_type: summary.line_type,
      carrier: summary.carrier,
      location: summary.address,
      time_zone: null,
      aliases: [],
      related_persons: [],
      most_recent_address: summary.address,
      previous_addresses: summary.previous_addresses ? summary.previous_addresses.split("; ") : [],
      email_domains: [],
      previous_phones: [],
      social_media: [],
      jobs: [],
      education: [],
      professional_licenses: [],
    });
  } catch (err) {
    console.error("[phone-lookup] error:", err);
    return json({ error: "fetch_failed" }, 502);
  }
});
