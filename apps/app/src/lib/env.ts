/** True on production (app.vanyshr.com). False on localhost and Vercel previews. */
export function isProductionApp(): boolean {
    if (import.meta.env.DEV) return false;
    if (typeof window === "undefined") return false;
    return window.location.hostname.toLowerCase() === "app.vanyshr.com";
}
