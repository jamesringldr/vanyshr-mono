import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail } from "lucide-react";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";

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
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
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

        navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
        setIsSending(false);
    };

    return (
        <div className="min-h-screen w-full bg-[#022136] flex items-center justify-center px-6">
            <div className="w-full max-w-md">

                {/* Logo */}
                <img
                    src={PrimaryLogoDark}
                    alt="Vanyshr"
                    className="h-[70px] w-auto mb-4"
                />

                {/* Heading */}
                <h1 className="text-4xl font-bold font-ubuntu tracking-tight text-white leading-tight mb-2">
                    Welcome<br />Back!
                </h1>

                {/* Subheading */}
                <p className="text-base font-bold font-ubuntu text-[#B8C4CC] mb-8">
                    Sign In to Your Dashboard
                </p>

                {/* Email input */}
                <div className="relative">
                    <input
                        id="signin-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        disabled={isSending}
                        placeholder="Enter Your Account Email"
                        autoComplete="email"
                        className={cx(
                            "h-[52px] w-full rounded-xl border px-12 py-3 text-sm font-ubuntu outline-none transition-colors duration-150",
                            "bg-[#2D3847] border-[#2A4A68]",
                            "text-white placeholder:text-[#7A92A8]",
                            "focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF]",
                            "disabled:opacity-50",
                        )}
                        aria-label="Email address"
                        aria-describedby={error ? "signin-error" : undefined}
                        aria-invalid={error !== null}
                    />
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#7A92A8] pointer-events-none" />
                </div>

                {error && (
                    <p
                        id="signin-error"
                        role="alert"
                        className="mt-2 text-xs font-ubuntu text-[#FF5757]"
                    >
                        {error === "user_not_found"
                            ? "We couldn't find an account for that email. Did you mean to run a QuickScan instead?"
                            : "Something went wrong. Please try again or contact support."}
                    </p>
                )}

                {/* CTA button */}
                <button
                    type="button"
                    onClick={handleSend}
                    disabled={!isValid || isSending}
                    className={cx(
                        "mt-4 h-[52px] w-full rounded-xl font-bold text-base font-ubuntu",
                        "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF]",
                        "transition-colors duration-150 cursor-pointer",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#022136]",
                        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#00BFFF]",
                    )}
                >
                    {isSending ? "Sending…" : "Send Magic Link"}
                </button>

                {/* Sign-up nudge */}
                <p className="mt-5 text-sm font-ubuntu text-white text-center">
                    Don&apos;t have an account?&nbsp;&nbsp;&nbsp;&nbsp;<Link
                        to="/quick-scan"
                        className="font-bold text-[#00BFFF] hover:text-[#00D4FF] transition-colors duration-150"
                    >
                        Start Here &rsaquo;
                    </Link>
                </p>

            </div>
        </div>
    );
}
