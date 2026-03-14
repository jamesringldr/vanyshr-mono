import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { Mail, Check, Zap, Key } from "lucide-react";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

export function AuthMagicLink() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showExistingModal, setShowExistingModal] = useState(false);

    const isValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

    const handleSend = async () => {
        if (!isValid || isSending) return;
        setIsSending(true);
        setAuthError(null);

        // Pre-flight: check if this email already has a Supabase auth account.
        // signInWithOtp with shouldCreateUser: false succeeds silently if the user
        // exists (and sends them a clean sign-in link), or returns an error if not.
        const { error: existsError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                shouldCreateUser: false,
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });

        if (!existsError) {
            // Email exists — magic link was already sent by the pre-flight call.
            // Show the "Wrong Email?" modal instead of continuing the new-user flow.
            setShowExistingModal(true);
            setIsSending(false);
            return;
        }

        // Email is new — create the pending profile first so we capture the
        // email address immediately. This enables re-engagement emails for
        // users who submit here but never click the magic link (abandoned cart).
        const scanId = sessionStorage.getItem("pendingScanId");

        if (!scanId) {
            setAuthError("Session expired. Please go back and try again.");
            setIsSending(false);
            return;
        }

        // Step 1: Create the pending profile (captures email + scan data in DB).
        let profileId: string | null = null;
        try {
            const { data: profileResult, error: profileError } = await supabase.functions.invoke<{
                success: boolean;
                profile_id?: string;
                error?: string;
            }>("create-pending-profile", {
                body: { scan_id: scanId, email: email.trim() },
            });

            if (profileError || !profileResult?.success || !profileResult?.profile_id) {
                throw new Error(profileResult?.error ?? profileError?.message ?? "Failed to create profile");
            }

            profileId = profileResult.profile_id;
            sessionStorage.setItem("pendingProfileId", profileId);
        } catch (err) {
            console.error("create-pending-profile error:", err);
            setAuthError("Something went wrong. Please try again.");
            setIsSending(false);
            return;
        }

        // Step 2: Send the magic link with profile_id embedded in the redirect
        // URL and user metadata so the auth callback can link the profile.
        const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
        redirectUrl.searchParams.set("profile_id", profileId);

        const { error } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                emailRedirectTo: redirectUrl.toString(),
                shouldCreateUser: true,
                data: {
                    profile_id:           profileId,
                    source_quick_scan_id: scanId,
                },
            },
        });

        if (error) {
            setAuthError(error.message);
            setIsSending(false);
            return;
        }

        navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
    };

    return (
        <div
            className={cx(
                "min-h-screen w-full font-sans transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
            aria-label="Send secure magic link"
        >
            <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-10 pt-10">

                {/* Icon */}
                <div className="flex justify-center">
                    <img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-20 w-20"
                        aria-hidden
                    />
                </div>

                {/* Hero copy */}
                <h1 className="mt-6 text-center text-4xl font-bold tracking-tighter text-[#022136] dark:text-white font-ubuntu">
                    Time to <span className="text-[#00BFFF] italic">Vanysh.</span>
                </h1>
                <p className="mt-3 text-center text-base text-[#B8C4CC] font-ubuntu">
                    Add your email to create your account.
                </p>

                {/* Setup time chip */}
                <div className="mt-6 flex justify-center">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00BFFF]/10 border border-[#00BFFF]/30 px-3 py-1.5 text-xs font-medium text-[#00BFFF] font-ubuntu">
                        <Zap className="w-3.5 h-3.5" aria-hidden />
                        2 mins to complete setup
                    </span>
                </div>

                {/* Feature bullets */}
                <ul className="mt-5 flex flex-col gap-4 text-left" role="list">
                    <li className="flex items-start gap-4">
                        <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                            <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
                        </div>
                        <p className="text-white text-sm leading-snug font-ubuntu">
                            Scan <span className="font-bold text-[#00BFFF]">500+ data brokers</span> and people search sites — continuously, not just once
                        </p>
                    </li>
                    <li className="flex items-start gap-4">
                        <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                            <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
                        </div>
                        <p className="text-sm leading-snug font-ubuntu text-white">
                            <span className="font-bold text-[#00BFFF]">Automated removal requests</span> sent on your behalf — no tedious opt-out forms
                        </p>
                    </li>
                    <li className="flex items-start gap-4">
                        <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                            <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
                        </div>
                        <p className="text-white text-sm leading-snug font-ubuntu">
                            <span className="font-bold text-[#00BFFF]">Dark web monitoring</span> with instant breach alerts
                        </p>
                    </li>
                    <li className="flex items-start gap-4">
                        <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
                            <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
                        </div>
                        <p className="text-white text-sm leading-snug font-ubuntu">
                            Track your progress in real time — and protect family members too
                        </p>
                    </li>
                </ul>

                {/* Form */}
                <div
                    className={cx(
                        "mt-8 rounded-xl border p-4",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    <label
                        htmlFor="email"
                        className="block text-sm font-semibold text-[#022136] dark:text-white"
                    >
                        Email Address
                    </label>

                    <div className="relative mt-2">
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            disabled={isSending}
                            className={cx(
                                "h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-sm outline-none transition",
                                "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
                                "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                                "disabled:opacity-50",
                            )}
                            placeholder="you@example.com"
                            aria-label="Email address"
                        />
                        <Mail
                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)] dark:text-[#7A92A8]"
                            aria-hidden
                        />
                    </div>

                    {authError && (
                        <p className="mt-2 text-xs text-red-500 dark:text-red-400">
                            {authError}
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!isValid || isSending}
                        className={cx(
                            "mt-4 flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                            "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            (!isValid || isSending) && "cursor-not-allowed opacity-50 hover:bg-[#00BFFF]",
                        )}
                        aria-label="Send secure link"
                    >
                        {isSending ? "Sending..." : "Send Secure Link"}
                    </button>
                </div>

                {/* Trust row */}
                <div className="mt-4 flex flex-col items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30 px-3 py-1.5 text-xs font-medium text-[#00D4AA] font-ubuntu">
                        <Key className="w-3.5 h-3.5" aria-hidden />
                        Encrypted &amp; Secure
                    </span>
                    <p className="text-xs text-[#7A92A8] font-ubuntu">
                        Magic Link Auth = No Passwords to Remember
                    </p>
                    <p className="text-xs font-bold text-white font-ubuntu">
                        We never spam, sell, or share your email.
                    </p>
                </div>

                <div className="mt-4 text-center">
                    <Link
                        to="/login"
                        className="text-xs font-medium text-[#00BFFF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Already have an account? Sign in here
                    </Link>
                </div>
            </div>

            {/* Wrong Email modal */}
            {showExistingModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wrong-email-title"
                >
                    <div className="w-full max-w-sm rounded-2xl bg-[#2D3847] border border-[#2A4A68] p-6 flex flex-col gap-4 shadow-xl">
                        <div className="flex flex-col gap-2">
                            <h2
                                id="wrong-email-title"
                                className="text-lg font-bold text-white"
                            >
                                Wrong Email?
                            </h2>
                            <p className="text-sm text-[#B8C4CC]">
                                We found an existing Vanyshr account for{" "}
                                <span className="font-semibold text-white">{email.trim()}</span>.
                            </p>
                            <p className="text-sm text-[#7A92A8]">
                                If you meant to use a different email, go back and try again.
                                If this is correct, check your inbox — we sent you a sign-in link.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => navigate("/signup")}
                            className="w-full h-[52px] rounded-xl bg-[#00BFFF] text-[#022136] font-bold text-base hover:bg-[#00D4FF] active:bg-[#0099CC] transition-colors duration-150 cursor-pointer"
                        >
                            Change Email
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
