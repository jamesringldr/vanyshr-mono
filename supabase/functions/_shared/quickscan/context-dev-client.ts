/**
 * Context.dev HTML scrape client
 * GET https://api.context.dev/v1/web/scrape/html?url=...
 * Auth: Authorization: Bearer <CONTEXT_DEV_API_KEY>
 */

const CONTEXT_DEV_BASE = "https://api.context.dev/v1";

export interface ContextDevScrapeResult {
  html: string;
  url?: string;
}

/**
 * Fetch rendered HTML for a URL via Context.dev.
 * Throws on missing key, non-OK response, or empty HTML.
 */
export async function scrapeHtmlViaContextDev(
  url: string,
  options: { timeoutMs?: number } = {},
): Promise<ContextDevScrapeResult> {
  const apiKey = Deno.env.get("CONTEXT_DEV_API_KEY");
  if (!apiKey) {
    throw new Error("CONTEXT_DEV_API_KEY is not configured");
  }

  const timeoutMs = options.timeoutMs ?? 45000;
  const endpoint = new URL(`${CONTEXT_DEV_BASE}/web/scrape/html`);
  endpoint.searchParams.set("url", url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(
        `Context.dev HTTP ${response.status}: ${body.slice(0, 200) || response.statusText}`,
      );
    }

    const data = await response.json() as { html?: string; url?: string };
    if (!data.html || data.html.length < 100) {
      throw new Error("Context.dev returned empty or blocked HTML");
    }

    return { html: data.html, url: data.url ?? url };
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`Context.dev timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
