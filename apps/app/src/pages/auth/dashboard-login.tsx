import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Mail } from "lucide-react";
import { UnauthNav } from "@/components/UnauthNav";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

type SignInError = "user_not_found" | "generic";

function classifyError(message: string): SignInError {
    const lower = message.toLowerCase();
    if (
        lower.includes("user not found") ||
        lower.includes("signups not allowed") ||
        lower.includes("invalid login credentials") ||
        lower.includes("email not confirmed")
    ) {
        return "user_not_found";
    }
    return "generic";
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export function DashboardLogin() {
    const [email, setEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState<SignInError | null>(null);

    const isValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

    const handleSend = async () => {
        if (!isValid || isSending) return;
        setIsSending(true);
        setError(null);

        const { error: authError } = await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
                shouldCreateUser: false,
                emailRedirectTo: window.location.origin + "/auth/callback",
            },
        });

        if (authError) {
            setError(classifyError(authError.message));
            setIsSending(false);
            return;
        }

        setSent(true);
        setIsSending(false);
    };

    return (
        <div className="min-h-screen w-full flex flex-col bg-[#022136]">
            <UnauthNav />

            <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-16">
                <div className="w-full max-w-md flex flex-col gap-8">

                    {/* Section 1 — Hero copy */}
                    <section className="flex flex-col gap-3">
                        <h1 className="text-2xl font-bold font-ubuntu tracking-tight text-white">
                            Sign Back In to Your Dashboard
                        </h1>
                        <p className="text-base font-normal font-ubuntu text-[#B8C4CC]">
                            Access your privacy dashboard and pick up where you left off
                        </p>
                    </section>

                    {/* Section 2 — Email input (replaced by success state after send) */}
                    <section>
                        {sent ? (
                            <div role="status" aria-live="polite" className="flex flex-col gap-2">
                                <p className="text-base font-normal font-ubuntu text-[#B8C4CC]">
                                    Check your inbox &mdash; we&apos;ve sent a sign-in link to{" "}
                                    <strong className="text-white">{email.trim()}</strong>. The link will expire in 60 minutes.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <label
                                    htmlFor="signin-email"
                                    className="text-base font-normal font-ubuntu text-[#B8C4CC]"
                                >
                                    Enter your email to receive a sign-in link
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                    <div className="relative flex-1">
                                        <input
                                            id="signin-email"
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                            disabled={isSending}
                                            placeholder="you@example.com"
                                            autoComplete="email"
                                            className="h-[52px] w-full rounded-xl border border-[#2A4A68] bg-[#2D3847] px-12 py-3 text-sm text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF] disabled:opacity-50"
                                            aria-describedby="signin-helper signin-error"
                                            aria-invalid={error !== null}
                                        />
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A92A8]" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!isValid || isSending}
                                        className="h-[52px] px-6 rounded-xl font-bold text-base font-ubuntu cursor-pointer transition-colors duration-150 bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSending ? "Sending…" : "Send Link"}
                                    </button>
                                </div>

                                <p id="signin-helper" className="text-xs font-normal font-ubuntu text-[#7A92A8]">
                                    We&apos;ll send a magic link to this address.
                                </p>

                                {error && (
                                    <p
                                        id="signin-error"
                                        role="alert"
                                        className="text-xs font-normal font-ubuntu text-[#FF5757]"
                                    >
                                        {error === "user_not_found"
                                            ? "We couldn't find an account for that email. Did you mean to run a QuickScan instead?"
                                            : "Something went wrong. Please try again or contact support."}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Section 3 — CTA for non-users */}
                    <p className="text-xs font-normal font-ubuntu text-[#7A92A8]">
                        Don&apos;t have an account?{" "}
                        <Link to="/" className="text-[#00BFFF] underline hover:text-[#00D4FF] transition-colors duration-150">
                            Run a free QuickScan
                        </Link>
                    </p>

                </div>
            </main>
        </div>
    );
}
