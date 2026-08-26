import { retryBudgetMs } from "./html-scrapers.ts";

const TIMEOUT = 60000;

Deno.test("a blocked first attempt retries with the remaining budget", () => {
  if (retryBudgetMs("blocked", 3000, TIMEOUT) !== 57000) {
    throw new Error("blocked should retry with 57000ms left");
  }
});

// The bug this covers: `failed` -- a 5xx, a dropped connection -- was returned
// straight through with no second attempt, purely because it wasn't spelled
// "blocked". Both mean we never saw the page.
Deno.test("a failed first attempt also retries", () => {
  if (retryBudgetMs("failed", 3000, TIMEOUT) !== 57000) {
    throw new Error("failed should retry, not be returned as-is");
  }
});

Deno.test("a timed-out first attempt has no budget and is not retried", () => {
  if (retryBudgetMs("failed", TIMEOUT, TIMEOUT) !== null) {
    throw new Error("a timeout must not double the broker's wall clock");
  }
});

Deno.test("a near-exhausted budget is not retried", () => {
  if (retryBudgetMs("blocked", 56000, TIMEOUT) !== null) {
    throw new Error("under MIN_RETRY_BUDGET_MS should not retry");
  }
});

Deno.test("retry budget never exceeds the original timeout", () => {
  for (const status of ["blocked", "failed"]) {
    for (const spent of [0, 1, 5000, 30000, 54999]) {
      const budget = retryBudgetMs(status, spent, TIMEOUT);
      if (budget !== null && spent + budget > TIMEOUT) {
        throw new Error(`${status} @${spent}ms: ${spent}+${budget} exceeds ${TIMEOUT}`);
      }
    }
  }
});

Deno.test("success and no_results are never retried", () => {
  if (retryBudgetMs("success", 0, TIMEOUT) !== null) throw new Error("success must not retry");
  if (retryBudgetMs("no_results", 0, TIMEOUT) !== null) {
    throw new Error("no_results is a real answer, not a retry");
  }
});
