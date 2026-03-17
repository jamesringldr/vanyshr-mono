import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Copy, Check } from "lucide-react";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

const SEARCH_QUERY = 'from:Vanyshr subject:"Vanyshr Sign In"';

export function CheckEmail() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") ?? "";

    const [seconds, setSeconds] = useState(173); // 2:53
    const [remaining, setRemaining] = useState(2);
    const [isResending, setIsResending] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    useEffect(() => {
        const t = window.setInterval(() => {
            setSeconds((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => window.clearInterval(t);
    }, []);

    const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
    const ss = String(seconds % 60).padStart(2, "0");

    const handleResend = async () => {
        if (remaining <= 0 || isResending || !email) return;
        setIsResending(true);

        const profileId = sessionStorage.getItem("pendingProfileId");
        const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
        if (profileId) redirectUrl.searchParams.set("profile_id", profileId);

        await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: redirectUrl.toString(), shouldCreateUser: true },
        });

        setRemaining((r) => Math.max(0, r - 1));
        setSeconds(173);
        setIsResending(false);
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(SEARCH_QUERY);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const isButtonActive = remaining > 0 && !isResending && seconds === 0;

    return (
        <div
            className={cx(
                "min-h-screen w-full font-sans transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
            aria-label="Check your email"
        >
            <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-10 pt-10">
                <div className="flex justify-center">
                    <img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-28 w-28"
                        aria-hidden
                    />
                </div>

                <h1 className="mt-3 text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    Check your email
                </h1>
                <p className="mt-2 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                    We sent a magic link to
                    <br />
                    <span className="font-semibold text-[#022136] dark:text-white">
                        {email || "your email address"}
                    </span>
                </p>

                <div className="mt-2 text-center">
                    <button
                        type="button"
                        onClick={() => navigate(`/signup`)}
                        className="text-xs font-medium text-[#00BFFF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Change email address
                    </button>
                </div>

                {/* Above-card instruction — centered, bold, white */}
                <p className="mt-5 text-center text-sm font-bold text-[#022136] dark:text-white">
                    Click the link in your email to sign in instantly.
                    <br />
                    No password needed.
                </p>

                <div
                    className={cx(
                        "mt-4 rounded-xl border p-4",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    {/* Don't see it — above the button */}
                    <div className="mb-4 text-center">
                        {/* Row 1 — 2pt larger than xs (xs=12px → sm=14px), bold, white */}
                        <p className="text-sm font-bold text-[#022136] dark:text-white">
                            Don&apos;t see it? Before requesting a new link:
                        </p>

                        {/* Row 2 — grey */}
                        <p className="mt-1 text-xs text-[#7A92A8]">
                            Check your Spam folder or search:
                        </p>

                        {/* Row 3 — white, italic, with copy icon */}
                        <p className="mt-0.5 flex items-center justify-center gap-1.5 text-xs italic text-[#022136] dark:text-white">
                            {SEARCH_QUERY}
                            <button
                                type="button"
                                onClick={handleCopy}
                                aria-label="Copy search query to clipboard"
                                className="inline-flex items-center text-[#7A92A8] hover:text-[#00BFFF] transition-colors duration-150 cursor-pointer not-italic"
                            >
                                {copied
                                    ? <Check className="w-3.5 h-3.5 text-[#00D4AA]" />
                                    : <Copy className="w-3.5 h-3.5" />
                                }
                            </button>
                        </p>

                        {copied && (
                            <p className="mt-1 text-xs font-bold text-[#00D4AA]">
                                Copied to Clipboard
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleResend}
                        disabled={!isButtonActive}
                        className={cx(
                            "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            isButtonActive
                                ? "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF] cursor-pointer"
                                : cx(
                                    "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                    "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                                    "text-[#022136] dark:text-white",
                                    "cursor-not-allowed opacity-50",
                                ),
                        )}
                    >
                        {isResending
                            ? "Sending..."
                            : seconds > 0
                                ? `Send New Link (${mm}:${ss})`
                                : "Send New Link"
                        }
                    </button>
                </div>

                <div className="mt-6 text-center">
                    <p className="text-sm font-bold text-[#022136] dark:text-white">
                        Still having issues?
                    </p>
                    <a
                        href="mailto:support@vanyshr.com"
                        className="mt-1 inline-block text-xs font-medium text-[#00BFFF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Send to Support
                    </a>
                    <p className="mt-1 text-xs text-[#7A92A8]">
                        We will investigate and contact you ASAP!
                    </p>
                </div>
            </div>
        </div>
    );
}
