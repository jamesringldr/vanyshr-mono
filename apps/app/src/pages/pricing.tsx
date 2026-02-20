import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import {
    X,
    Search,
    Trash2,
    Shield,
    TrendingUp,
    Users,
    ChevronRight,
} from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";

type PlanTier = "free" | "individual" | "family";
type BillingPeriod = "monthly" | "annual";

interface PlanFeature {
    icon: React.ElementType;
    title: string;
    description: string;
    hasArrow?: boolean;
}

interface PlanConfig {
    id: PlanTier;
    label: string;
    monthlyPrice: number;
    annualPrice: number;
    annualMonthly: number;
    features: PlanFeature[];
}

const plansConfig: Record<PlanTier, PlanConfig> = {
    free: {
        id: "free",
        label: "Free Forever",
        monthlyPrice: 0,
        annualPrice: 0,
        annualMonthly: 0,
        features: [
            {
                icon: Search,
                title: "1 Full Privacy Scan",
                description:
                    "Scan 500+ data broker sites to find your exposed personal information.",
            },
            {
                icon: Trash2,
                title: "1 Auto Removal",
                description:
                    "We automatically remove your data from one broker site.",
            },
            {
                icon: Shield,
                title: "DIY Removal Instructions",
                description:
                    "Step-by-step guides to manually remove your data from broker sites.",
            },
            {
                icon: TrendingUp,
                title: "Manual Progress Tracker",
                description:
                    "Track your removal progress with our basic dashboard.",
                hasArrow: true,
            },
        ],
    },
    individual: {
        id: "individual",
        label: "Individual",
        monthlyPrice: 20,
        annualPrice: 180,
        annualMonthly: 15,
        features: [
            {
                icon: Search,
                title: "Monthly Full Scans",
                description:
                    "Continuous monitoring of 500+ data brokers every month.",
            },
            {
                icon: Trash2,
                title: "Automated Removal Requests",
                description:
                    "We handle all removal requests automatically on your behalf.",
            },
            {
                icon: Shield,
                title: "Daily Dark Web Monitoring",
                description:
                    "Get alerted if your data appears on the dark web.",
            },
            {
                icon: TrendingUp,
                title: "Auto Progress Tracker",
                description:
                    "Real-time tracking with detailed analytics and removal status.",
                hasArrow: true,
            },
        ],
    },
    family: {
        id: "family",
        label: "Family",
        monthlyPrice: 30,
        annualPrice: 270,
        annualMonthly: 22.5,
        features: [
            {
                icon: Users,
                title: "Protection for 5 Users",
                description:
                    "All Individual features for up to 5 family members.",
            },
            {
                icon: TrendingUp,
                title: "Family Dashboard",
                description:
                    "Manage and monitor privacy protection for your entire family.",
            },
            {
                icon: Shield,
                title: "Family Alerts",
                description:
                    "Get notified when any family member's data is exposed.",
                hasArrow: true,
            },
        ],
    },
};

const SAVINGS_PERCENT = 25;

/** Card surface: Vanyshr tokens, rounded-xl, border-subtle. */
const cardClasses = cx(
    "rounded-xl border",
    "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
);

export function Pricing() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [selectedTier, setSelectedTier] = useState<PlanTier>("individual");
    const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual");
    const scanId = searchParams.get("scanId");

    const currentPlan = plansConfig[selectedTier];

    const handleClose = () => {
        navigate(-1);
    };

    const handleSubscribe = () => {
        const signupUrl = scanId ? `/signup?scanId=${scanId}` : "/signup";
        navigate(signupUrl);
    };

    return (
        <div
            className={cx(
                "min-h-screen w-full font-sans transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
            aria-label="Subscribe to a plan"
        >
            <div className="mx-auto max-w-md px-4 pb-8 pt-4 sm:pt-6">
                {/* Header: close + logo + title */}
                <header className="mb-6 flex flex-col items-center gap-4 sm:mb-8">
                    <div className="flex w-full items-center justify-between">
                        <button
                            type="button"
                            onClick={handleClose}
                            className={cx(
                                "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl outline-none transition",
                                "text-[var(--text-primary)] dark:text-white",
                                "hover:bg-[#F0F4F8]/80 dark:hover:bg-[#022136]/80",
                                "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            )}
                            aria-label="Close"
                        >
                            <X className="h-6 w-6" aria-hidden />
                        </button>
                        <div className="flex-1 flex justify-center">
                            <img
                                src={PrimaryLogo}
                                alt=""
                                className="h-8 w-auto dark:hidden sm:h-9"
                            />
                            <img
                                src={PrimaryLogoDark}
                                alt=""
                                className="hidden h-8 w-auto dark:block sm:h-9"
                            />
                        </div>
                        <div className="w-10 shrink-0" aria-hidden />
                    </div>
                    <h1 className="text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white sm:text-3xl">
                        Subscribe to {currentPlan.label}
                    </h1>
                </header>

                {/* Tier selector: Free Forever | Individual | Family */}
                <nav
                    className="mb-6 flex justify-center"
                    aria-label="Plan tier"
                    role="tablist"
                    aria-orientation="horizontal"
                >
                    <div
                        className={cx(
                            "inline-flex rounded-xl p-1",
                            "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                            "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        {(Object.keys(plansConfig) as PlanTier[]).map(
                            (tierId) => {
                                const plan = plansConfig[tierId];
                                const isSelected = selectedTier === tierId;
                                return (
                                    <button
                                        key={plan.id}
                                        type="button"
                                        role="tab"
                                        aria-selected={isSelected}
                                        aria-controls={`plan-panel-${plan.id}`}
                                        id={`plan-tab-${plan.id}`}
                                        onClick={() =>
                                            setSelectedTier(plan.id)
                                        }
                                        className={cx(
                                            "rounded-lg px-4 py-2.5 text-sm font-medium outline-none transition",
                                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F0F4F8] dark:focus-visible:ring-offset-[#022136]",
                                            isSelected
                                                ? "bg-[#00BFFF]/20 dark:bg-[#00BFFF]/25 text-[#022136] dark:text-white shadow-sm"
                                                : "text-[var(--text-secondary)] dark:text-[#B8C4CC] hover:text-[#022136] dark:hover:text-white",
                                        )}
                                    >
                                        {plan.id === "free" ? (
                                            <>
                                                <span className="block leading-tight">Free</span>
                                                <span className="block leading-tight">Forever</span>
                                            </>
                                        ) : (
                                            plan.label
                                        )}
                                    </button>
                                );
                            },
                        )}
                    </div>
                </nav>

                {/* Features card */}
                <section
                    id={`plan-panel-${currentPlan.id}`}
                    role="tabpanel"
                    aria-labelledby={`plan-tab-${currentPlan.id}`}
                    className={cx(cardClasses, "p-4 sm:p-5")}
                >
                    <ul className="divide-y divide-[var(--border-subtle)] dark:divide-[#2A4A68]">
                        {currentPlan.features.map((feature, index) => {
                            const Icon = feature.icon;
                            return (
                                <li
                                    key={index}
                                    className="flex items-start gap-3 py-4 first:pt-0 last:pb-0"
                                >
                                    <div
                                        className={cx(
                                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                                            "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                                            "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                        )}
                                    >
                                        <Icon
                                            className="h-5 w-5 text-[var(--text-muted)] dark:text-[#7A92A8]"
                                            aria-hidden
                                        />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h3 className="text-sm font-semibold text-[#022136] dark:text-white">
                                            {feature.title}
                                        </h3>
                                        <p className="mt-0.5 text-sm leading-relaxed text-[var(--text-secondary)] dark:text-[#B8C4CC]">
                                            {feature.description}
                                        </p>
                                    </div>
                                    {feature.hasArrow && (
                                        <ChevronRight
                                            className="h-5 w-5 shrink-0 text-[var(--text-muted)] dark:text-[#7A92A8]"
                                            aria-hidden
                                        />
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {/* Billing period: Monthly | Annual (only when plan has price) */}
                {currentPlan.monthlyPrice > 0 && (
                    <section
                        className="mt-6"
                        aria-label="Billing period"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() =>
                                    setBillingPeriod("monthly")
                                }
                                className={cx(
                                    "relative rounded-xl border p-4 text-left outline-none transition",
                                    cardClasses,
                                    billingPeriod === "monthly"
                                        ? "ring-2 ring-[#00BFFF] ring-offset-2 ring-offset-[#F0F4F8] dark:ring-offset-[#022136]"
                                        : "hover:border-[#00BFFF]/50",
                                    "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                                )}
                            >
                                <div className="text-sm font-semibold text-[#022136] dark:text-white">
                                    Monthly
                                </div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-[#022136] dark:text-white">
                                        ${currentPlan.monthlyPrice}
                                    </span>
                                    <span className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                        / month
                                    </span>
                                </div>
                            </button>
                            <button
                                type="button"
                                onClick={() =>
                                    setBillingPeriod("annual")
                                }
                                className={cx(
                                    "relative rounded-xl border p-4 text-left outline-none transition",
                                    cardClasses,
                                    billingPeriod === "annual"
                                        ? "ring-2 ring-[#00BFFF] ring-offset-2 ring-offset-[#F0F4F8] dark:ring-offset-[#022136]"
                                        : "hover:border-[#00BFFF]/50",
                                    "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                                )}
                            >
                                <span
                                    className={cx(
                                        "absolute right-2 top-2 rounded-md px-2 py-0.5 text-xs font-semibold text-white",
                                        "bg-[#00D4AA]",
                                    )}
                                    aria-hidden
                                >
                                    SAVE {SAVINGS_PERCENT}%
                                </span>
                                <div className="text-sm font-semibold text-[#022136] dark:text-white">
                                    Annual
                                </div>
                                <div className="mt-1 flex items-baseline gap-1">
                                    <span className="text-2xl font-bold text-[#022136] dark:text-white">
                                        ${currentPlan.annualPrice}
                                    </span>
                                    <span className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                        / year
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                                    $
                                    {currentPlan.annualMonthly.toFixed(2)} /
                                    month
                                </p>
                            </button>
                        </div>
                    </section>
                )}

                {/* CTA button */}
                <div className="mt-6">
                    <button
                        type="button"
                        onClick={handleSubscribe}
                        className={cx(
                            "flex h-[52px] w-full items-center justify-center rounded-xl font-semibold text-white outline-none transition",
                            "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                        aria-label={
                            currentPlan.monthlyPrice === 0
                                ? "Get started with free plan"
                                : "Subscribe and pay"
                        }
                    >
                        {currentPlan.monthlyPrice === 0
                            ? "Get Started Free"
                            : "Subscribe & pay"}
                    </button>
                </div>

                {/* Legal text */}
                <div className="mt-6 rounded-xl border-l-2 border-[var(--border-subtle)] dark:border-[#2A4A68] pl-4">
                    <p className="text-xs leading-relaxed text-[var(--text-muted)] dark:text-[#7A92A8]">
                        By subscribing, you agree to our{" "}
                        <Link
                            to="/terms"
                            className="font-medium text-[#00BFFF] underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-1 rounded"
                        >
                            Terms of Service
                        </Link>
                        , and that subscriptions auto-renew until you cancel.{" "}
                        <Link
                            to="/terms"
                            className="font-medium text-[#00BFFF] underline underline-offset-2 outline-none hover:no-underline focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-1 rounded"
                        >
                            Cancel anytime
                        </Link>
                        , at least 24 hours prior to renewal to avoid
                        additional charges.
                    </p>
                </div>

                {/* Guarantee */}
                <p className="mt-6 text-center text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                    30-day money back guarantee
                </p>

                {/* Footer links */}
                <footer
                    className="mt-6 flex flex-wrap justify-center gap-4"
                    role="contentinfo"
                >
                    <Link
                        to="/privacy"
                        className="text-xs font-medium text-[#00BFFF] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 rounded"
                    >
                        Privacy Policy
                    </Link>
                    <Link
                        to="/terms"
                        className="text-xs font-medium text-[#00BFFF] outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 rounded"
                    >
                        Terms of Service
                    </Link>
                </footer>
            </div>
        </div>
    );
}
