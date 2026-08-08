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
