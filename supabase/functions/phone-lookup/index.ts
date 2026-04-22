import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { ZabasearchScraper } from "../_shared/scrapers/ZabasearchScraper.ts";

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

    const scraper = new ZabasearchScraper();
    const matches = await scraper.searchByPhone(normalized);

    if (matches.length === 0) {
      return json({ error: "no_result" }, 404);
    }

    const match = matches[0];
    const formatted = `${normalized.slice(0, 3)}-${normalized.slice(3, 6)}-${normalized.slice(6)}`;

    // Map ProfileMatch fields to ZabaPhoneResult shape.
    // Fields not available from search results (carrier, line_type, etc.) are null —
    // the UI handles nulls gracefully.
    return json({
      phone: normalized,
      source_url: `https://www.zabasearch.com/phone/${formatted}`,
      name: match.name ?? null,
      age: match.age ?? null,
      birth_year: null,
      line_type: null,
      carrier: null,
      location: match.city_state ?? null,
      time_zone: null,
      aliases: [],
      related_persons: [],
      most_recent_address: null,
      previous_addresses: [],
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
