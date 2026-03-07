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

                // Check if this auth user already has a linked Vanyshr profile.
                // This distinguishes returning users (→ dashboard) from new users
                // going through the QuickScan onboarding flow (→ welcome).
                const { data: existingProfile } = await supabase
                    .from("user_profiles")
                    .select("id")
                    .eq("auth_user_id", session.user.id)
                    .maybeSingle();

                if (existingProfile) {
                    // Returning user — go to dashboard.
                    navigate("/dashboard/home", { replace: true });
                    return;
                }

                // profile_id was encoded in the emailRedirectTo URL by magic-link.tsx
                const params = new URLSearchParams(window.location.search);
                const profileId = params.get("profile_id")
                    ?? sessionStorage.getItem("pendingProfileId");

                if (!profileId) {
                    // No pending profile and no existing linked profile.
                    // This means someone authenticated with an email that has no
                    // Vanyshr account yet — likely a wrong email on /signup.
                    const encodedEmail = encodeURIComponent(session.user.email ?? "");
                    navigate(`/auth/wrong-email?email=${encodedEmail}`, { replace: true });
                    return;
                }

                try {
                    const { error } = await supabase.functions.invoke("link-auth-to-profile", {
                        body: { profile_id: profileId },
                    });

                    if (error) {
                        console.error("link-auth-to-profile error:", error);
                        // Non-fatal — profile may already be linked (e.g. page refresh).
                        // Proceed to onboarding regardless.
                    }
                } catch (err) {
                    console.error("AuthCallback: link error:", err);
                }

                // Clean up pre-auth sessionStorage keys
                sessionStorage.removeItem("pendingProfileId");
                sessionStorage.removeItem("pendingScanId");

                navigate("/welcome", { replace: true });
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
