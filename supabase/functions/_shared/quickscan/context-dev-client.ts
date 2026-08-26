/**
 * context.dev HTML scrape — GET https://api.context.dev/v1/web/scrape/html
 *
 * Docs: https://docs.context.dev/api-reference/web-scraping/html
 *
 * maxAgeMs defaults to 1 day ON THEIR SIDE when omitted. A cached bot-check
 * page for the same URL then comes back as HTTP 200 with no Person cards
 * (~0.5s). Live scans must send maxAgeMs=0 so every request is fresh.
 *
 * Deliberately NO country param. country=us routes the fetch through
 * context.dev's US residential pool, whose exits FPS has partly blacklisted.
 * Measured over paired live FPS scrapes, everything else held equal:
 *
 *              country=us              omitted
 *   failures   2 bot-check + 1 hang    0
 *   requests   71                      60
 *   latency    median 3.3s / p90 30s   median 2.2s / p90 2.8s
 *
 * It also returned 200s with zero parseable result cards, which read
 * downstream as no_results. The default (unpinned) path is not blocked.
 */

const CONTEXT_API = "https://api.context.dev/v1/web/scrape/html";

export class ContextDevError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errorCode?: string,
  ) {
    super(message);
    this.name = "ContextDevError";
  }
}

export type HtmlScrapeResult = {
  html: string;
  url: string;
  notFound: boolean;
  blocked: boolean;
  finalUrl?: string;
};

type ContextDevBody = {
  success?: boolean;
  html?: string;
  url?: string;
  message?: string;
  error_code?: string;
  metadata?: {
    sourceUrl?: string;
    finalUrl?: string;
    title?: string;
    jsonLd?: unknown[];
  };
};

/** FPS (and similar) anti-bot shells that context.dev may still return as 200. */
export function isChallengePage(html: string, finalUrl?: string): boolean {
  if (finalUrl && /bot-check|blacklist=1/i.test(finalUrl)) return true;
  const low = html.toLowerCase();
  if (low.includes("are you human") && (low.includes("captcha") || low.includes("recaptcha"))) {
    return true;
  }
  if (low.includes("security challenge") && !low.includes("@type\":\"person")) {
    return true;
  }
  return false;
}

export function contextDevEnabled(): boolean {
  return Boolean(Deno.env.get("CONTEXT_DEV_API_KEY"));
}

export async function scrapeHtml(
  url: string,
  opts: { timeoutMs?: number; maxAgeMs?: number } = {},
): Promise<HtmlScrapeResult> {
  const apiKey = Deno.env.get("CONTEXT_DEV_API_KEY");
  if (!apiKey) {
    throw new ContextDevError("CONTEXT_DEV_API_KEY is not set", 401, "UNAUTHORIZED");
  }

  const timeoutMs = opts.timeoutMs ?? 60000;
  // 0 = always scrape fresh. Omitting this uses their 86400000ms default.
  const maxAgeMs = opts.maxAgeMs ?? 0;
  const params = new URLSearchParams({
    url,
    timeoutMS: String(timeoutMs),
    maxAgeMs: String(maxAgeMs),
  });

  const response = await fetch(`${CONTEXT_API}?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs + 5000),
  });

  const body = await response.json().catch(() => ({})) as ContextDevBody;
  const finalUrl = body.metadata?.finalUrl || body.url || url;

  if (response.status === 404 || body.error_code === "NOT_FOUND") {
    return { html: "", url, notFound: true, blocked: false, finalUrl };
  }

  if (body.error_code === "WEBSITE_BLOCKED") {
    throw new ContextDevError(
      body.message || "context.dev WEBSITE_BLOCKED",
      response.status || 400,
      "WEBSITE_BLOCKED",
    );
  }

  if (!response.ok || !body.html) {
    throw new ContextDevError(
      body.message || `context.dev HTTP ${response.status}`,
      response.status,
      body.error_code,
    );
  }

  if (isChallengePage(body.html, finalUrl)) {
    throw new ContextDevError(
      `context.dev returned a bot-check page (${finalUrl})`,
      400,
      "WEBSITE_BLOCKED",
    );
  }

  return { html: body.html, url: body.url || url, notFound: false, blocked: false, finalUrl };
}
