import { supabase } from "./supabase";

/** Mark onboarding fully complete (removal strategy + notifications done). */
export async function markOnboardingComplete(): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { error } = await supabase
        .from("user_profiles")
        .update({ onboarding_completed: true })
        .eq("auth_user_id", session.user.id);

    if (error) console.error("[onboarding] mark complete failed:", error.message);
}
