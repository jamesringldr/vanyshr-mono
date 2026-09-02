import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import type { Session } from "@supabase/supabase-js";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Validates the `next` redirect parameter for safety.
 *
 * Allowlist:
 *  • Must start with `/quick-scan/pre-profile/`
 *  • Must not contain `//`, `\`, or any protocol/host (`:` only valid after leading `/`)
 *
 * @param next - The redirect path to validate
 * @returns true if safe to redirect, false otherwise
 */
function isSafeNext(next: string | null): boolean {
  if (!next) return false;
  if (!next.startsWith("/quick-scan/pre-profile/")) return false;
  // Reject double slashes, backslashes, and colon-paths (e.g., http://, file://)
  if (next.includes("//") || next.includes("\\")) return false;
  // Reject any colon not in the leading slash (prevents protocol://host patterns)
  if (next.slice(1).includes(":")) return false;
  return true;
}

/**
 * /auth/callback
 *
 * Supabase redirects here after the user clicks the magic link in their email.
 * The URL contains the session tokens in the hash fragment — Supabase JS picks
 * these up automatically via onAuthStateChange.
 *
 * Redirect matrix:
 *  • profile_id + safe next → redirect to next
 *  • profile_id + no/unsafe next → redirect to /welcome
 *  • no profile_id + existing profile → redirect to /dashboard/home or /onboarding/progress
 *  • no profile_id + no profile → redirect to /auth/wrong-email
 *
 * Responsibilities:
 *  1. Wait for the confirmed auth session.
 *  2. Read the pending profile_id from the URL query param (set in magic-link.tsx or admin-send-invite).
 *  3. Read the optional next param for admin invite redirects.
 *  4. Call the link-auth-to-profile edge function (service role via anon key + bearer).
 *  5. Clear sessionStorage keys used during the pre-auth flow.
 *  6. Navigate to the appropriate destination based on profile_id and next param.
 */
export function AuthCallback() {
    const navigate = useNavigate();
    const handled = useRef(false);

    useEffect(() => {
        let cancelled = false;

        async function finish(session: Session) {
            if (handled.current || cancelled) return;
            handled.current = true;

            const params = new URLSearchParams(window.location.search);
            const meta = session.user.user_metadata as Record<string, unknown> | undefined;
            const metaProfileId =
                typeof meta?.profile_id === "string" ? meta.profile_id : null;
            const profileId = params.get("profile_id")
                ?? sessionStorage.getItem("pendingProfileId")
                ?? metaProfileId;
            const next = params.get("next");

            if (profileId) {
                try {
                    const { error } = await supabase.functions.invoke("link-auth-to-profile", {
                        body: { profile_id: profileId },
                    });
                    if (error) {
                        console.error("link-auth-to-profile error:", error);
                    }
                } catch (err) {
                    console.error("AuthCallback: link error:", err);
                }

                sessionStorage.removeItem("pendingProfileId");
                sessionStorage.removeItem("pendingScanId");

                if (cancelled) return;
                if (next && isSafeNext(next)) {
                    navigate(next, { replace: true });
                } else {
                    navigate("/welcome", { replace: true });
                }
                return;
            }

            const { data: existingProfile } = await supabase
                .from("user_profiles")
                .select("id, onboarding_step")
                .eq("auth_user_id", session.user.id)
                .maybeSingle();

            if (cancelled) return;

            if (existingProfile) {
                const { data: prefs } = await supabase
                    .from("user_preferences")
                    .select("removal_strategy, notification_tier")
                    .eq("user_id", existingProfile.id)
                    .maybeSingle();

                const profileDone = (existingProfile.onboarding_step ?? 0) >= 5;
                const prefsDone   = !!(prefs?.removal_strategy && prefs?.notification_tier);

                navigate(
                    profileDone && prefsDone ? "/dashboard/home" : "/onboarding/progress",
                    { replace: true }
                );
                return;
            }

            const encodedEmail = encodeURIComponent(session.user.email ?? "");
            navigate(`/auth/wrong-email?email=${encodedEmail}`, { replace: true });
        }

        // Subscribe first so we cannot miss SIGNED_IN while getSession is in flight.
        // Also handle INITIAL_SESSION: the hash/code is often already consumed by
        // the time this effect runs, so SIGNED_IN never fires and the spinner hangs.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (!session) return;
                if (event === "SIGNED_IN" || event === "INITIAL_SESSION") {
                    void finish(session);
                }
            }
        );

        void supabase.auth.getSession().then(({ data }) => {
            if (data.session) void finish(data.session);
        });

        const timeout = window.setTimeout(() => {
            if (handled.current || cancelled) return;
            navigate("/login", { replace: true });
        }, 12000);

        return () => {
            cancelled = true;
            subscription.unsubscribe();
            window.clearTimeout(timeout);
        };
    }, [navigate]);

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-[#0B1B2B] font-sans"
            role="main"
            aria-label="Completing sign in"
        >
            <Loader2 className="w-10 h-10 text-[#14ABFE] animate-spin mb-4" />
            <p className="text-base font-semibold text-[#0B1B2B] dark:text-white">
                Completing sign in...
            </p>
            <p className="mt-1 text-sm text-[#7A92A8]">
                Just a moment while we set up your account.
            </p>
        </div>
    );
}
