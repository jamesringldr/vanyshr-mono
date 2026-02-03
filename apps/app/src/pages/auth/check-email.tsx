import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Mail } from "lucide-react";
import { cx } from "@/utils/cx";

export function CheckEmail() {
    const navigate = useNavigate();
    const [email] = useState("james@ringldr.com");
    const [seconds, setSeconds] = useState(173); // 2:53
    const [remaining, setRemaining] = useState(2);

    // lightweight countdown (client-only). Good enough for mock flow.
    useMemo(() => {
        const t = window.setInterval(() => {
            setSeconds((s) => (s > 0 ? s - 1 : 0));
        }, 1000);
        return () => window.clearInterval(t);
    }, []);

    const mm = String(Math.floor(seconds / 60)).padStart(1, "0");
    const ss = String(seconds % 60).padStart(2, "0");

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
                    <div
                        className={cx(
                            "flex h-14 w-14 items-center justify-center rounded-full",
                            "bg-[#14ABFE]/10 dark:bg-[#14ABFE]/15",
                        )}
                    >
                        <Mail className="h-6 w-6 text-[#14ABFE]" aria-hidden />
                    </div>
                </div>

                <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    Check your email
                </h1>
                <p className="mt-2 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                    We sent a magic link to
                    <br />
                    <span className="font-semibold text-[#022136] dark:text-white">
                        {email}
                    </span>
                </p>

                <div className="mt-2 text-center">
                    <button
                        type="button"
                        onClick={() => navigate("/magic-link")}
                        className="text-xs font-medium text-[#14ABFE] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Change email address
                    </button>
                </div>

                <div
                    className={cx(
                        "mt-6 rounded-xl border p-4 text-center",
                        "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                        Click the link in your email to sign in instantly. No password needed.
                    </p>

                    <p className="mt-4 text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                        <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-400 align-middle" />
                        Send new link in:{" "}
                        <span className="font-mono tabular-nums">
                            {mm}:{ss}
                        </span>
                    </p>

                    <button
                        type="button"
                        onClick={() => {
                            if (remaining <= 0) return;
                            setRemaining((r) => Math.max(0, r - 1));
                            setSeconds(173);
                        }}
                        className={cx(
                            "mt-4 flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition",
                            "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                            "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                            "text-[#022136] dark:text-white",
                            "hover:bg-[#F0F4F8]/70 dark:hover:bg-[#022136]/70",
                            "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            remaining <= 0 && "cursor-not-allowed opacity-50",
                        )}
                        disabled={remaining <= 0}
                    >
                        Send New Link ({remaining} remaining)
                    </button>

                    <p className="mt-3 text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                        Check your spam folder or promotions tab if you don&apos;t see it.
                    </p>
                </div>

                <div className="mt-6 text-center">
                    <Link
                        to="/welcome"
                        className="text-xs font-medium text-[#14ABFE] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Back to Welcome
                    </Link>
                </div>
            </div>
        </div>
    );
}

