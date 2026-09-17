/** True on production (app.vanyshr.com). False on localhost and Vercel previews. */
export function isProductionApp(): boolean {
    if (import.meta.env.DEV) return false;
    if (typeof window === "undefined") return false;
    return window.location.hostname.toLowerCase() === "app.vanyshr.com";
}

/**
 * Local UI preview: open any route by URL without auth / workflow state.
 * Always on in Vite `pnpm dev`. Opt in for local `vite preview` via
 * VITE_ALLOW_ROUTE_BYPASS=true in apps/app/.env.local (never set in prod).
 */
export function allowLocalRouteBypass(): boolean {
    if (import.meta.env.DEV) return true;
    return import.meta.env.VITE_ALLOW_ROUTE_BYPASS === "true";
}

/**
 * Disconnected dev mode: mock Supabase client (auth + data), never real network calls.
 * Only ever true in local `vite dev` (dead-code-eliminated from every built bundle,
 * so it can never be true on a staging preview or in production). Set via the
 * Connected/Disconnected prompt in `pnpm dev` (apps/app/scripts/dev-gate.mjs),
 * which writes VITE_DEV_MODE to apps/app/.env.local (gitignored, per-worktree).
 */
export function isDisconnectedMode(): boolean {
    if (!import.meta.env.DEV) return false;
    return import.meta.env.VITE_DEV_MODE === "disconnected";
}
