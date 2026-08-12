/**
 * Zaba residential service client (serv-01)
 * POST {ZABA_SERVICE_URL}/v1/zaba/search
 */

import { BrokerName, QuickScanInput, ScrapeResult, SummaryResult } from "./quickscan-phase1-phase2-models.ts";

interface ZabaServiceProfile {
  id?: string;
  name?: string;
  age?: number | string;
  city_state?: string;
  detail_link?: string;
}

interface ZabaServiceResponse {
  status?: string;
  error?: string;
  profiles?: ZabaServiceProfile[];
}

/**
 * Search Zabasearch via serv-01 residential service.
 */
export async function searchZabaViaService(
  input: QuickScanInput,
  options: { timeoutMs?: number } = {},
): Promise<ScrapeResult> {
  const start = Date.now();
  const base = Deno.env.get("ZABA_SERVICE_URL");
  const token = Deno.env.get("ZABA_SERVICE_TOKEN");

  if (!base) {
    return {
      broker: BrokerName.ZABA,
      summaries: [],
      status: "failed",
      error: "ZABA_SERVICE_URL is not configured",
      timing_ms: Date.now() - start,
    };
  }

  const timeoutMs = options.timeoutMs ?? 120000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    console.log(`🔗 Zaba service: ${base.replace(/\/$/, "")}/v1/zaba/search`);

    const response = await fetch(`${base.replace(/\/$/, "")}/v1/zaba/search`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        first_name: input.first_name,
        last_name: input.last_name,
        city: input.city || null,
        state: input.state || null,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Zaba service HTTP ${response.status}`);
    }

    const data = await response.json() as ZabaServiceResponse;
    if (data.status === "failed") {
      throw new Error(data.error || "Zaba service failed");
    }

    const summaries: SummaryResult[] = (data.profiles || []).map((p) => {
      const ageNum = p.age != null ? parseInt(String(p.age), 10) : undefined;
      const location = p.city_state || "";
      return {
        broker: BrokerName.ZABA,
        full_name: p.name || "",
        address: location,
        age_range: p.age != null ? String(p.age) : "",
        age: Number.isFinite(ageNum) ? ageNum : undefined,
        location,
        profile_url: p.detail_link || "",
      };
    }).filter((s) => s.full_name.length > 0);

    const timing_ms = Date.now() - start;
    console.log(`✓ Zaba service: ${summaries.length} profiles in ${timing_ms}ms`);

    return {
      broker: BrokerName.ZABA,
      summaries,
      status: summaries.length > 0 ? "success" : "no_results",
      timing_ms,
    };
  } catch (error) {
    const timing_ms = Date.now() - start;
    const message =
      (error as Error).name === "AbortError"
        ? `Zaba service timeout after ${timeoutMs}ms`
        : (error as Error).message;
    console.error(`✗ Zaba service: ${message}`);
    return {
      broker: BrokerName.ZABA,
      summaries: [],
      status: "failed",
      error: message,
      timing_ms,
    };
  } finally {
    clearTimeout(timer);
  }
}
