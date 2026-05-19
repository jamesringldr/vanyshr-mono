import { supabase } from "./supabase";

/** Kick off HIBP scan for all confirmed emails on a profile (fire-and-forget). */
export function triggerBreachesScan(profileId: string): void {
    void supabase.functions
        .invoke("breaches-scan", { body: { profile_id: profileId } })
        .then(({ error }) => {
            if (error) console.error("[breaches-scan]", error.message);
        });
}
