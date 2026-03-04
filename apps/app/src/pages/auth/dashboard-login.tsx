import { useMemo, useState } from "react";
import { Link } from "react-router";
import { UnauthNav } from "@/components/UnauthNav";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Placeholder icon components — swap these out for real icons later
// ---------------------------------------------------------------------------

function ScanIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0"
            aria-hidden
        >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
    );
}

function BreachIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0"
            aria-hidden
        >
            <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
    );
}

function RemovalIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0"
            aria-hidden
        >
            <polyline points="9 11 12 14 22 4" />
            <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
    );
}

function FamilyIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-5 h-5 shrink-0"
            aria-hidden
        >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
    );
}

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
        <div className="min-h-screen w-full flex flex-col">
            <UnauthNav />

            <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-16">
                <div className="w-full max-w-md flex flex-col gap-8">

                    {/* Section 1 — Hero copy */}
                    <section className="flex flex-col gap-3">
                        <h1 className="text-2xl font-bold font-ubuntu tracking-tight">
                            Sign Back In to Your Dashboard
                        </h1>
                        <p className="text-base font-normal font-ubuntu">
                            Access your privacy dashboard and pick up where you left off
                        </p>
                    </section>

                    {/* Section 2 — Feature/benefit list */}
                    <section className="flex flex-col gap-4">
                        <p className="text-base font-normal font-ubuntu">
                            Your Vanyshr account gives you access to:
                        </p>
                        <ul className="flex flex-col gap-4" role="list">
                            <li className="flex items-start gap-3">
                                <ScanIcon />
                                <span className="text-base font-normal font-ubuntu">
                                    Your personal data exposed across data broker and people search sites
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <BreachIcon />
                                <span className="text-base font-normal font-ubuntu">
                                    Dark web breach monitoring and alerts
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <RemovalIcon />
                                <span className="text-base font-normal font-ubuntu">
                                    Removal request tracking and opt-out progress
                                </span>
                            </li>
                            <li className="flex items-start gap-3">
                                <FamilyIcon />
                                <span className="text-base font-normal font-ubuntu">
                                    Family member protection and subscription management
                                </span>
                            </li>
                        </ul>
                    </section>

                    {/* Section 3 — Email input (replaced by success state after send) */}
                    <section>
                        {sent ? (
                            <div role="status" aria-live="polite" className="flex flex-col gap-2">
                                <p className="text-base font-normal font-ubuntu">
                                    Check your inbox &mdash; we&apos;ve sent a sign-in link to{" "}
                                    <strong>{email.trim()}</strong>. The link will expire in 60 minutes.
                                </p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-3">
                                <label
                                    htmlFor="signin-email"
                                    className="text-base font-normal font-ubuntu"
                                >
                                    Enter your email to receive a sign-in link
                                </label>

                                <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                                    <input
                                        id="signin-email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                        disabled={isSending}
                                        placeholder="you@example.com"
                                        autoComplete="email"
                                        className="flex-1 h-[52px] rounded-xl border px-4 text-base font-ubuntu outline-none transition disabled:opacity-50"
                                        aria-describedby="signin-helper signin-error"
                                        aria-invalid={error !== null}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSend}
                                        disabled={!isValid || isSending}
                                        className="h-[52px] px-6 rounded-xl font-bold text-base font-ubuntu cursor-pointer transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {isSending ? "Sending…" : "Send Link"}
                                    </button>
                                </div>

                                <p id="signin-helper" className="text-xs font-normal font-ubuntu">
                                    We&apos;ll send a magic link to this address. This will not create a new
                                    account &mdash; if no account exists for this email you&apos;ll be notified
                                    below.
                                </p>

                                {error && (
                                    <p
                                        id="signin-error"
                                        role="alert"
                                        className="text-xs font-normal font-ubuntu"
                                    >
                                        {error === "user_not_found"
                                            ? "We couldn't find an account for that email. Did you mean to run a QuickScan instead?"
                                            : "Something went wrong. Please try again or contact support."}
                                    </p>
                                )}
                            </div>
                        )}
                    </section>

                    {/* Section 4 — CTA for non-users */}
                    <section className="flex flex-col gap-4">
                        <hr aria-hidden />
                        <p className="text-base font-normal font-ubuntu">
                            Don&apos;t have an account? Run a free QuickScan and see how much of your
                            personal data is already out there.
                        </p>
                        <Link
                            to="/"
                            className="inline-flex items-center justify-center h-[52px] px-6 rounded-xl font-bold text-base font-ubuntu cursor-pointer transition-colors duration-150"
                        >
                            Run a Free QuickScan
                        </Link>
                    </section>

                </div>
            </main>
        </div>
    );
}
