/**
 * context.dev HTML scrape — the fetch layer that replaced Camoufox for Phase 1.
 * GET https://api.context.dev/v1/web/scrape/html?url=...
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
};

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

  const timeoutMs = opts.timeoutMs ?? 25000;
  const params = new URLSearchParams({
    url,
    country: "us",
    timeoutMS: String(timeoutMs),
  });
  if (opts.maxAgeMs !== undefined) {
    params.set("maxAgeMs", String(opts.maxAgeMs));
  }

  const response = await fetch(`${CONTEXT_API}?${params.toString()}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(timeoutMs + 5000),
  });

  const body = await response.json().catch(() => ({})) as {
    success?: boolean;
    html?: string;
    url?: string;
    message?: string;
    error_code?: string;
  };

  if (response.status === 404 || body.error_code === "NOT_FOUND") {
    return { html: "", url, notFound: true };
  }

  if (!response.ok || !body.html) {
    throw new ContextDevError(
      body.message || `context.dev HTTP ${response.status}`,
      response.status,
      body.error_code,
    );
  }

  return { html: body.html, url: body.url || url, notFound: false };
}
