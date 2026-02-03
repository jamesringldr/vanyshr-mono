import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { Mail } from "lucide-react";
import { cx } from "@/utils/cx";

export function AuthMagicLink() {
    const navigate = useNavigate();
    const [email, setEmail] = useState("you@example.com");
    const [sent, setSent] = useState(false);

    const isValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

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
                        className="h-14 w-14"
                        aria-hidden
                    />
                </div>

                {/* Title */}
                <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    Secure your privacy
                </h1>
                <p className="mt-2 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                    Sign in with a secure magic link
                </p>

                {/* Form */}
                <div
                    className={cx(
                        "mt-6 rounded-xl border p-4",
                        "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
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
                            className={cx(
                                "h-[52px] w-full rounded-xl border py-3 pl-12 pr-4 text-sm outline-none transition",
                                "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                "text-[#022136] dark:text-white placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
                                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            )}
                            placeholder="you@example.com"
                            aria-label="Email address"
                        />
                        <Mail
                            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)] dark:text-[#7A92A8]"
                            aria-hidden
                        />
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSent(true);
                            navigate("/check-email");
                        }}
                        disabled={!isValid}
                        className={cx(
                            "mt-4 flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                            "bg-[#14ABFE] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            !isValid && "cursor-not-allowed opacity-50 hover:bg-[#14ABFE]",
                        )}
                        aria-label="Send secure link"
                    >
                        Send Secure Link
                    </button>

                    {sent && (
                        <p className="mt-3 text-center text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                            Check your email for the link.
                        </p>
                    )}
                </div>

                {/* Trust row */}
                <div className="mt-4 px-2 text-center">
                    <p className="text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                        <span className="font-medium text-[#00D4AA]">Encrypted &amp; Secure</span>{" "}
                        | No Password to Remember
                        <br />
                        We never spam, sell, or share your email. Full control over notifications.
                    </p>
                </div>

                <div className="mt-4 text-center">
                    <Link
                        to="/welcome"
                        className="text-xs font-medium text-[#14ABFE] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring rounded"
                    >
                        Continue without signing in
                    </Link>
                </div>
            </div>
        </div>
    );
}

