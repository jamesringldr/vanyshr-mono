import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Menu, Search, Shield, Bell, CircleCheck } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

function FeatureItem({
    icon: Icon,
    title,
    description,
}: {
    icon: React.ElementType;
    title: string;
    description: string;
}) {
    return (
        <div className="flex items-start gap-3">
            <div
                className={cx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                    "bg-[#00BFFF]/10 dark:bg-[#00BFFF]/15",
                )}
            >
                <Icon className="h-5 w-5 text-[#00BFFF]" aria-hidden />
            </div>
            <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[#022136] dark:text-white">
                    {title}
                </h3>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                    {description}
                </p>
            </div>
        </div>
    );
}

export function Welcome() {
    const navigate = useNavigate();
    const [firstName, setFirstName] = useState<string | null>(null);

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data: profile } = await supabase
                .from("user_profiles")
                .select("first_name")
                .eq("auth_user_id", user.id)
                .single();
            if (profile?.first_name) setFirstName(profile.first_name);
        }
        load();
    }, []);

    return (
        <div
            className={cx(
                "min-h-screen w-full font-sans transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
            aria-label="Welcome"
        >
            {/* Header */}
            <header className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center">
                    <img
                        src={PrimaryLogo}
                        alt="Vanyshr"
                        className="h-8 w-auto dark:hidden sm:h-9"
                    />
                    <img
                        src={PrimaryLogoDark}
                        alt="Vanyshr"
                        className="hidden h-8 w-auto dark:block sm:h-9"
                    />
                </div>
                <button
                    type="button"
                    aria-label="Open menu"
                    className={cx(
                        "flex h-10 w-10 items-center justify-center rounded-xl outline-none transition",
                        "text-[#022136] dark:text-white",
                        "hover:bg-[#F0F4F8]/80 dark:hover:bg-[#022136]/80",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                    )}
                >
                    <Menu className="h-6 w-6" aria-hidden />
                </button>
            </header>

            {/* Content */}
            <main className="mx-auto flex w-full max-w-lg flex-col px-4 pb-28">
                {/* Welcome */}
                <div className="mt-2 text-center">
                    <h1 className="text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                        Welcome{firstName ? `, ${firstName}` : ""}!
                    </h1>
                    <p className="mt-2 text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                        Let&apos;s set up your privacy profile to start removing your personal
                        information from data brokers.
                    </p>
                </div>

                {/* What we'll need */}
                <section
                    className={cx(
                        "mt-6 rounded-xl border p-4",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    )}
                    aria-label="What we'll need from you"
                >
                    <h2 className="text-base font-semibold text-[#022136] dark:text-white">
                        What we&apos;ll need from you
                    </h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                        To find and remove your data, we&apos;ll ask you to confirm:
                    </p>
                    <ul className="mt-4 space-y-2 text-sm">
                        {[
                            "Your legal name and date of birth",
                            "Phone numbers associated with you",
                            "Any aliases or alternate names",
                            "Current and past addresses",
                            "Email addresses linked to your identity",
                        ].map((t) => (
                            <li key={t} className="flex items-start gap-2">
                                <CircleCheck
                                    className="mt-0.5 h-4 w-4 shrink-0 text-[#00D4AA]"
                                    aria-hidden
                                />
                                <span className="text-[var(--text-secondary)] dark:text-[#B8C4CC]">
                                    {t}
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Why we need this */}
                <section className="mt-6" aria-label="Why we need this information">
                    <h2 className="text-base font-semibold text-[#022136] dark:text-white">
                        Why we need this information
                    </h2>
                    <div className="mt-4 space-y-4">
                        <FeatureItem
                            icon={Search}
                            title="Find your data everywhere"
                            description="We search hundreds of data broker sites using your information to locate where your data is exposed."
                        />
                        <FeatureItem
                            icon={Shield}
                            title="Remove it automatically"
                            description="We submit removal requests on your behalf to get your personal information taken down."
                        />
                        <FeatureItem
                            icon={Bell}
                            title="Keep you protected"
                            description="We continuously monitor for new exposures and alert you when action is needed."
                        />
                    </div>
                </section>

                {/* Privacy notice */}
                <section
                    className={cx(
                        "mt-6 rounded-xl p-3",
                        "bg-[#00BFFF]/10 dark:bg-[#00BFFF]/10",
                    )}
                    aria-label="Privacy notice"
                >
                    <p className="text-xs text-[#00BFFF]">
                        <strong>Your privacy matters:</strong> We only use your information to
                        protect you. We never sell or share your data with third parties.
                    </p>
                </section>
            </main>

            {/* Footer CTA */}
            <footer
                className={cx(
                    "fixed bottom-0 left-0 right-0 border-t px-4 py-4",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                )}
                role="contentinfo"
            >
                <div className="mx-auto w-full max-w-lg">
                    <button
                        type="button"
                        onClick={() => navigate("/onboarding/primary-info")}
                        className={cx(
                            "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
                            "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                        aria-label="Get started"
                    >
                        Get Started
                    </button>
                </div>
            </footer>
        </div>
    );
}

