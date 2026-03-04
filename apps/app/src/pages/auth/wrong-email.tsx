import { Link, useSearchParams } from "react-router";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { cx } from "@/utils/cx";

/**
 * /auth/wrong-email
 *
 * Safety net page reached from /auth/callback when a user authenticates
 * successfully but has no linked user_profiles row and no pendingProfileId.
 *
 * Most common cause: existing user typed a different email on /signup,
 * creating a bare Supabase auth account with no Vanyshr profile attached.
 *
 * Options:
 *  1. Try a different email → /dashboard/login (sign in with correct email)
 *  2. New here? → / (run QuickScan to start the proper onboarding flow)
 */
export function WrongEmail() {
    const [searchParams] = useSearchParams();
    const email = searchParams.get("email") ?? "";

    return (
        <div
            className={cx(
                "min-h-screen w-full font-sans transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
            aria-label="Account not found"
        >
            <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-10 pt-10">
                <div className="flex justify-center">
                    <img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-14 w-14"
                        aria-hidden
                    />
                </div>

                <h1 className="mt-5 text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    Wrong Email?
                </h1>

                <p className="mt-2 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                    We signed you in
                    {email && (
                        <>
                            {" "}to{" "}
                            <span className="font-semibold text-[#022136] dark:text-white">
                                {email}
                            </span>
                        </>
                    )}
                    , but there&apos;s no Vanyshr account linked to this address yet.
                </p>

                <div
                    className={cx(
                        "mt-6 rounded-xl border p-4 flex flex-col gap-3",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                >
                    <p className="text-sm font-semibold text-[#022136] dark:text-white">
                        If you already have a Vanyshr account, sign in with the correct email.
                    </p>

                    <Link
                        to="/dashboard/login"
                        className={cx(
                            "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition",
                            "bg-[#00BFFF] text-[#022136]",
                            "hover:bg-[#00D4FF]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                    >
                        Try a Different Email
                    </Link>
                </div>

                <div className="mt-4 text-center">
                    <p className="text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                        New to Vanyshr?{" "}
                        <Link
                            to="/"
                            className="font-medium text-[#00BFFF] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 rounded"
                        >
                            Run a free QuickScan to get started
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
