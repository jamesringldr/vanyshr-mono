import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * /auth/callback
 *
 * Supabase redirects here after the user clicks the magic link in their email.
 * The URL contains the session tokens in the hash fragment — Supabase JS picks
 * these up automatically via onAuthStateChange.
 *
 * Responsibilities:
 *  1. Wait for the confirmed auth session.
 *  2. Read the pending profile_id from the URL query param (set in magic-link.tsx).
 *  3. Call the link-auth-to-profile edge function (service role via anon key + bearer).
 *  4. Clear sessionStorage keys used during the pre-auth flow.
 *  5. Navigate to /welcome to begin onboarding.
 */
export function AuthCallback() {
    const navigate = useNavigate();
    const handled = useRef(false);

    useEffect(() => {
        // Supabase fires SIGNED_IN after processing the hash fragment.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (handled.current) return;
                if (event !== "SIGNED_IN" || !session) return;

                handled.current = true;

                // ── SIGNUP FLOW ──────────────────────────────────────────────
                // profile_id in the URL means this link came from the QuickScan
                // sign-up CTA (set by magic-link.tsx). Always link the account
                // and send the user to /welcome, even if the profile is already
                // linked (e.g. they clicked the same link twice).
                const params = new URLSearchParams(window.location.search);
                const profileId = params.get("profile_id")
                    ?? sessionStorage.getItem("pendingProfileId");

                if (profileId) {
                    try {
                        const { error } = await supabase.functions.invoke("link-auth-to-profile", {
                            body: { profile_id: profileId },
                        });
                        if (error) {
                            console.error("link-auth-to-profile error:", error);
                            // Non-fatal — profile may already be linked.
                        }
                    } catch (err) {
                        console.error("AuthCallback: link error:", err);
                    }

                    sessionStorage.removeItem("pendingProfileId");
                    sessionStorage.removeItem("pendingScanId");

                    navigate("/welcome", { replace: true });
                    return;
                }

                // ── RETURNING LOGIN FLOW ─────────────────────────────────────
                // No profile_id means this is a sign-in link (not sign-up).
                // Check if the user has finished all onboarding steps:
                //   • profile data steps 1–5 (onboarding_step >= 5)
                //   • removal strategy chosen
                //   • notification tier chosen
                // Any incomplete → progress page.
                const { data: existingProfile } = await supabase
                    .from("user_profiles")
                    .select("id, onboarding_step")
                    .eq("auth_user_id", session.user.id)
                    .maybeSingle();

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

                // No linked profile found for this auth user — wrong email.
                const encodedEmail = encodeURIComponent(session.user.email ?? "");
                navigate(`/auth/wrong-email?email=${encodedEmail}`, { replace: true });
            }
        );

        return () => subscription.unsubscribe();
    }, [navigate]);

    return (
        <div
            className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-[#022136] font-sans"
            role="main"
            aria-label="Completing sign in"
        >
            <Loader2 className="w-10 h-10 text-[#00BFFF] animate-spin mb-4" />
            <p className="text-base font-semibold text-[#022136] dark:text-white">
                Completing sign in...
            </p>
            <p className="mt-1 text-sm text-[#7A92A8]">
                Just a moment while we set up your account.
            </p>
        </div>
    );
}
