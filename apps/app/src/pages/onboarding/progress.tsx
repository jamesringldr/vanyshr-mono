import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import {
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Phone,
    User,
    Home,
    Mail,
    ArrowRight,
} from "lucide-react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Progress Ring
// ---------------------------------------------------------------------------
function ProgressRing({ progress }: { progress: number }) {
    const r = 38;
    const circ = 2 * Math.PI * r; // ≈ 238.76
    const filled = (progress / 100) * circ;
    const isComplete = progress === 100;

    return (
        <div className="relative flex items-center justify-center">
            <svg
                viewBox="0 0 100 100"
                className="w-28 h-28"
                style={{ transform: "rotate(-90deg)" }}
                aria-hidden
            >
                {/* Track */}
                <circle
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke="#2A4A68"
                    strokeWidth="8"
                />
                {/* Fill */}
                <circle
                    cx="50"
                    cy="50"
                    r={r}
                    fill="none"
                    stroke={isComplete ? "#00D4AA" : "#00BFFF"}
                    strokeWidth="8"
                    strokeDasharray={`${filled} ${circ}`}
                    strokeLinecap="round"
                    style={{ transition: "stroke-dasharray 0.7s ease" }}
                />
            </svg>
            {/* Label inside ring */}
            <div className="absolute text-center pointer-events-none">
                <span className="text-2xl font-bold text-white font-ubuntu">
                    {Math.round(progress)}%
                </span>
                <p className="text-[10px] font-medium text-[#7A92A8] uppercase tracking-wide mt-0.5">
                    complete
                </p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Sub-task row (inside expanded Step 1)
// ---------------------------------------------------------------------------
function SubTaskRow({
    icon: Icon,
    label,
    isComplete,
    onClick,
}: {
    icon: React.ElementType;
    label: string;
    isComplete: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isComplete}
            className={cx(
                "flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors duration-150 outline-none",
                "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-inset",
                isComplete
                    ? "cursor-default opacity-60"
                    : "cursor-pointer hover:bg-[#022136]/60",
            )}
            aria-label={`${label} — ${isComplete ? "complete" : "go to step"}`}
        >
            {/* Icon bubble */}
            <div
                className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    isComplete ? "bg-[#00D4AA]/20" : "bg-[#00BFFF]/10",
                )}
            >
                {isComplete ? (
                    <Check className="h-4 w-4 text-[#00D4AA]" aria-hidden />
                ) : (
                    <Icon className="h-4 w-4 text-[#00BFFF]" aria-hidden />
                )}
            </div>

            {/* Label */}
            <span
                className={cx(
                    "flex-1 text-sm font-medium font-ubuntu",
                    isComplete
                        ? "text-[#7A92A8] line-through"
                        : "text-white",
                )}
            >
                {label}
            </span>

            {/* Arrow for incomplete */}
            {!isComplete && (
                <ArrowRight className="h-4 w-4 text-[#00BFFF] shrink-0" aria-hidden />
            )}
        </button>
    );
}

// ---------------------------------------------------------------------------
// Main step card
// ---------------------------------------------------------------------------
interface StepCardProps {
    stepNumber: number;
    title: string;
    description: string;
    isComplete: boolean;
    isExpanded: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
    hasSubTasks?: boolean;
    children?: React.ReactNode;
}

function StepCard({
    stepNumber,
    title,
    description,
    isComplete,
    isExpanded,
    onToggle,
    onNavigate,
    hasSubTasks = false,
    children,
}: StepCardProps) {
    const handleClick = hasSubTasks ? onToggle : (isComplete ? onToggle : onNavigate);

    return (
        <div
            className={cx(
                "rounded-2xl border transition-colors duration-200",
                "bg-[#2D3847]",
                isComplete ? "border-[#00D4AA]/40" : "border-[#2A4A68]",
            )}
        >
            {/* Card header — always visible */}
            <button
                type="button"
                onClick={handleClick}
                className={cx(
                    "flex w-full items-center gap-4 p-5 text-left outline-none transition-colors duration-150 rounded-2xl",
                    "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-inset",
                    !isComplete && "cursor-pointer",
                    isComplete && !hasSubTasks && "cursor-default",
                )}
                aria-expanded={hasSubTasks ? isExpanded : undefined}
                aria-label={`${title} — ${isComplete ? "complete" : "incomplete"}`}
            >
                {/* Step number / check circle */}
                <div
                    className={cx(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold text-sm transition-colors duration-200",
                        isComplete
                            ? "bg-[#00D4AA] text-[#022136]"
                            : "border-2 border-[#2A4A68] text-[#7A92A8]",
                    )}
                    aria-hidden
                >
                    {isComplete ? (
                        <Check className="h-5 w-5" />
                    ) : (
                        <span className="font-ubuntu">{stepNumber}</span>
                    )}
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <span
                            className={cx(
                                "font-semibold text-sm font-ubuntu transition-all duration-300",
                                isComplete ? "text-[#7A92A8] line-through opacity-60" : "text-white",
                            )}
                        >
                            {title}
                        </span>
                        {isComplete && (
                            <span className="rounded-full bg-[#00D4AA]/20 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[#00D4AA] font-ubuntu">
                                Complete
                            </span>
                        )}
                    </div>
                    <p className="mt-0.5 text-xs text-[#7A92A8] font-ubuntu">
                        {description}
                    </p>
                </div>

                {/* Right icon */}
                {hasSubTasks ? (
                    <ChevronDown
                        className={cx(
                            "h-5 w-5 text-[#7A92A8] shrink-0 transition-transform duration-200",
                            isExpanded && "rotate-180",
                        )}
                        aria-hidden
                    />
                ) : !isComplete ? (
                    <ChevronRight
                        className="h-5 w-5 text-[#00BFFF] shrink-0"
                        aria-hidden
                    />
                ) : null}
            </button>

            {/* Expandable sub-tasks */}
            {hasSubTasks && isExpanded && (
                <div className="border-t border-[#2A4A68] px-2 pb-2 pt-1">
                    {children}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Are You Sure Modal (navigate away with incomplete setup)
// ---------------------------------------------------------------------------
function AreYouSureModal({
    onCompleteSetUp,
    onContinueToDashboard,
}: {
    onCompleteSetUp: () => void;
    onContinueToDashboard: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Incomplete setup warning"
        >
            <div
                className="absolute inset-0 bg-[#022136]/80 backdrop-blur-sm"
                onClick={onCompleteSetUp}
            />
            <div className="relative w-full max-w-lg rounded-t-3xl bg-[#2D3847] border border-[#2A4A68] border-b-0 px-6 pt-8 pb-10 flex flex-col items-center gap-4">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-white font-ubuntu">Are you sure?</h2>
                    <p className="mt-2 text-sm text-[#B8C4CC] font-ubuntu leading-relaxed">
                        Your profile set up is not complete. You will need to complete your set up before we can start removing your data
                    </p>
                    <p className="mt-3 text-sm font-bold text-white font-ubuntu">
                        Profile Set Up takes less than 3 minutes
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onCompleteSetUp}
                    className={cx(
                        "mt-1 flex h-[52px] w-full items-center justify-center rounded-xl font-ubuntu",
                        "text-sm font-semibold text-[#022136] bg-[#00BFFF] hover:bg-[#00D4FF]",
                        "transition-colors duration-150 outline-none",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]",
                    )}
                >
                    Complete Set Up
                </button>
                <button
                    type="button"
                    onClick={onContinueToDashboard}
                    className="text-sm font-semibold text-[#00BFFF] hover:text-[#00D4FF] transition-colors duration-150 font-ubuntu cursor-pointer outline-none focus-visible:underline"
                >
                    Continue to Dashboard &gt;
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Completion Modal
// ---------------------------------------------------------------------------
function CompletionModal({ onDashboard }: { onDashboard: () => void }) {
    return (
        <div
            className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-0"
            role="dialog"
            aria-modal="true"
            aria-label="Setup complete"
        >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-[#022136]/80 backdrop-blur-sm" />

            {/* Sheet */}
            <div className="relative w-full max-w-lg rounded-t-3xl bg-[#2D3847] border border-[#2A4A68] border-b-0 px-6 pt-8 pb-10 flex flex-col items-center gap-5">
                {/* Glow ring */}
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#00D4AA]/15 border-2 border-[#00D4AA]/40">
                    <Check className="h-9 w-9 text-[#00D4AA]" aria-hidden />
                </div>

                <div className="text-center">
                    <h2 className="text-xl font-bold text-white font-ubuntu">
                        Setup is Complete!
                    </h2>
                    <p className="mt-2 text-sm text-[#B8C4CC] font-ubuntu leading-relaxed">
                        You have officially started{" "}
                        <span className="text-[#00BFFF] font-semibold">Vanyshing!</span>
                        <br />
                        We have started your first scans and removals.
                        <br />
                        See your progress.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={onDashboard}
                    className={cx(
                        "mt-1 flex h-[52px] w-full items-center justify-center rounded-xl font-ubuntu",
                        "text-sm font-semibold text-[#022136] bg-[#00BFFF] hover:bg-[#00D4FF]",
                        "transition-colors duration-150 outline-none",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]",
                    )}
                >
                    Dashboard
                </button>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
const COMPLETE_MODAL_KEY = "vanyshr_onboarding_complete_seen";

const GENERAL_PRESET = {
    alerts:          { darkWebBreach: true,  brokerExposure: true,  tasks: "new" },
    scanActivity:    { brokerScanComplete: true,  darkWebScanComplete: true },
    removalActivity: { submitted: true,  confirmed: true },
    recapReports:    { securitySnapshot: "weekly", removalRecap: true },
    productUpdates:  { featureAnnouncements: false, dealsDiscounts: false },
    newsInfo:        { newsletter: false, securityTips: false, cyberSecurityAlerts: true },
};

export function OnboardingProgress() {
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [removalStrategy, setRemovalStrategy] = useState<string | null>(null);
    const [notificationTier, setNotificationTier] = useState<string | null>(null);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedStep, setExpandedStep] = useState<number>(1);
    const [showModal, setShowModal] = useState(false);
    const [showAreYouSure, setShowAreYouSure] = useState(false);
    const [isApplyingDefaults, setIsApplyingDefaults] = useState(false);
    const [completionVisible, setCompletionVisible] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setIsLoading(false); return; }

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("id, onboarding_step")
                .eq("auth_user_id", user.id)
                .single();

            if (!profile) { setIsLoading(false); return; }
            setProfileId(profile.id);
            setOnboardingStep(profile.onboarding_step ?? 0);

            const { data: prefs } = await supabase
                .from("user_preferences")
                .select("removal_strategy, notification_tier")
                .eq("user_id", profile.id)
                .maybeSingle();

            setRemovalStrategy(prefs?.removal_strategy ?? null);
            setNotificationTier(prefs?.notification_tier ?? null);
            setIsLoading(false);
        }
        load();
    // location.key changes on every navigation to this route, ensuring
    // a fresh DB fetch each time the user returns from step 2 or step 3.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.key]);

    // Slide in completion drawer when all tasks done
    useEffect(() => {
        const done = !isLoading && onboardingStep >= 5 && !!removalStrategy && !!notificationTier;
        if (done) {
            const t = window.setTimeout(() => setCompletionVisible(true), 300);
            return () => window.clearTimeout(t);
        }
        setCompletionVisible(false);
        return undefined;
    }, [isLoading, onboardingStep, removalStrategy, notificationTier]);

    // Auto-collapse step 1 when all subtasks are complete
    useEffect(() => {
        if (!isLoading && onboardingStep >= 5) {
            setExpandedStep(0);
        }
    }, [isLoading, onboardingStep]);

    // Show completion modal once all 3 main steps are done
    useEffect(() => {
        if (isLoading) return;
        const step1Done = onboardingStep >= 5;
        const step2Done = !!removalStrategy;
        const step3Done = !!notificationTier;
        if (step1Done && step2Done && step3Done && !localStorage.getItem(COMPLETE_MODAL_KEY)) {
            setShowModal(true);
        }
    }, [isLoading, onboardingStep, removalStrategy, notificationTier]);

    // Sub-tasks for step 1 (Search Profile Setup)
    const subTasks = [
        {
            label: "Primary Info",
            icon: FileText,
            route: "/onboarding/primary-info",
            isComplete: onboardingStep >= 1,
        },
        {
            label: "Phone Numbers",
            icon: Phone,
            route: "/onboarding/phone-numbers",
            isComplete: onboardingStep >= 2,
        },
        {
            label: "Aliases",
            icon: User,
            route: "/onboarding/aliases",
            isComplete: onboardingStep >= 3,
        },
        {
            label: "Addresses",
            icon: Home,
            route: "/onboarding/addresses",
            isComplete: onboardingStep >= 4,
        },
        {
            label: "Emails",
            icon: Mail,
            route: "/onboarding/emails",
            isComplete: onboardingStep >= 5,
        },
    ];

    const step1Complete = onboardingStep >= 5;
    const step2Complete = !!removalStrategy;
    const step3Complete = !!notificationTier;
    const allComplete = step1Complete && step2Complete && step3Complete;

    // Overall progress: 5 profile sub-tasks + 2 preference steps = 7 units
    const completedSubTasks = subTasks.filter((t) => t.isComplete).length;
    const totalCompleted =
        completedSubTasks + (step2Complete ? 1 : 0) + (step3Complete ? 1 : 0);
    const progressPercent = Math.round((totalCompleted / 7) * 100);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#022136]">
                <div className="h-6 w-6 rounded-full border-2 border-[#00BFFF] border-t-transparent animate-spin" />
            </div>
        );
    }

    function handleDashboard() {
        localStorage.setItem(COMPLETE_MODAL_KEY, "1");
        navigate("/scanning-started");
    }

    async function handleUseDefaultSettings() {
        if (isApplyingDefaults) return;
        setIsApplyingDefaults(true);
        if (profileId) {
            await supabase
                .from("user_preferences")
                .update({
                    removal_strategy: "aggressive",
                    notification_tier: "general",
                    notification_settings: GENERAL_PRESET,
                })
                .eq("user_id", profileId);
        }
        navigate("/scanning-started");
    }

    return (
        <div className="flex min-h-screen flex-col bg-[#022136]">
            {showModal && <CompletionModal onDashboard={handleDashboard} />}
            {showAreYouSure && (
                <AreYouSureModal
                    onCompleteSetUp={() => setShowAreYouSure(false)}
                    onContinueToDashboard={() => navigate("/scanning-started")}
                />
            )}

            {/* ----------------------------------------------------------------
                Header
            ---------------------------------------------------------------- */}
            <header className="flex items-center justify-between px-4 py-3">
                <img
                    src={PrimaryLogoDark}
                    alt="Vanyshr"
                    className="h-8 w-auto"
                />
                <button
                    type="button"
                    onClick={() => {
                        if (allComplete) {
                            navigate("/scanning-started");
                        } else {
                            setShowAreYouSure(true);
                        }
                    }}
                    className={cx(
                        "flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold font-ubuntu outline-none transition-colors duration-150",
                        "text-white bg-white/5 hover:bg-white/10",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#022136]",
                    )}
                >
                    Dashboard
                </button>
            </header>

            {/* ----------------------------------------------------------------
                Scrollable content
            ---------------------------------------------------------------- */}
            <main className="flex-1 overflow-y-auto px-4 pb-36">
                <div className="mx-auto max-w-lg">

                    {/* Progress ring + headline */}
                    <div className="flex flex-col items-center gap-3 py-6">
                        {/* Header — above the ring */}
                        <h1 className="text-2xl font-bold text-white font-ubuntu text-center">
                            Finish Account Set Up
                        </h1>

                        <ProgressRing progress={progressPercent} />

                        {/* Completion pill — below ring */}
                        <div className="rounded-full bg-[#2D3847] border border-[#2A4A68] px-4 py-1.5">
                            <span className="text-xs font-medium text-[#B8C4CC] font-ubuntu">
                                <span className="text-white font-bold">{totalCompleted}</span>
                                {" "}of{" "}
                                <span className="text-white font-bold">7</span>
                                {" "}tasks complete
                            </span>
                        </div>

                        {/* Subtext */}
                        <p className="text-sm text-[#B8C4CC] font-ubuntu text-center">
                            3 steps to start Vanyshing
                        </p>
                    </div>

                    {/* Section label */}
                    <p className="text-[11px] font-medium uppercase tracking-wide text-[#7A92A8] font-ubuntu mb-3">
                        Setup Steps
                    </p>

                    {/* --------------------------------------------------------
                        Step cards
                    -------------------------------------------------------- */}
                    <div className="flex flex-col gap-3" role="list" aria-label="Onboarding steps">

                        {/* Step 1 — Search Profile Setup */}
                        <div role="listitem">
                            <StepCard
                                stepNumber={1}
                                title="Verify Search Profile Data"
                                description={
                                    step1Complete
                                        ? "All 5 sub-tasks complete"
                                        : `${completedSubTasks} of 5 sub-tasks complete`
                                }
                                isComplete={step1Complete}
                                isExpanded={expandedStep === 1}
                                onToggle={() =>
                                    setExpandedStep((prev) => (prev === 1 ? 0 : 1))
                                }
                                hasSubTasks
                            >
                                {subTasks.map((task) => (
                                    <SubTaskRow
                                        key={task.label}
                                        icon={task.icon}
                                        label={task.label}
                                        isComplete={task.isComplete}
                                        onClick={() => navigate(task.route)}
                                    />
                                ))}
                            </StepCard>
                        </div>

                        {/* Step 2 — Removal Strategy */}
                        <div role="listitem">
                            <StepCard
                                stepNumber={2}
                                title="Removal Strategy"
                                description="Set how aggressively we remove your data"
                                isComplete={step2Complete}
                                isExpanded={false}
                                onToggle={() => {}}
                                onNavigate={() => navigate("/onboarding/removal-strategy")}
                                hasSubTasks={false}
                            />
                        </div>

                        {/* Step 3 — Notification Preferences */}
                        <div role="listitem">
                            <StepCard
                                stepNumber={3}
                                title="Notification Preferences"
                                description="Choose how and when we alert you"
                                isComplete={step3Complete}
                                isExpanded={false}
                                onToggle={() => {}}
                                onNavigate={() => navigate("/onboarding/notifications")}
                                hasSubTasks={false}
                            />
                        </div>
                    </div>

                    {/* Privacy reassurance */}
                    <div className="mt-6 rounded-xl bg-[#00BFFF]/10 px-4 py-3">
                        <p className="text-xs text-[#00BFFF] font-ubuntu">
                            <strong>Why this matters:</strong> The more info you confirm, the more
                            thoroughly we can find and remove your data from broker sites.
                        </p>
                    </div>
                </div>
            </main>

            {/* ----------------------------------------------------------------
                Sticky footer — dynamic based on completion state
            ---------------------------------------------------------------- */}
            <footer
                className={cx(
                    "fixed bottom-0 left-0 right-0 border-t px-4 py-4",
                    "border-[#2A4A68] bg-[#2D3847]",
                    "shadow-[0_-8px_24px_rgba(0,0,0,0.45)]",
                )}
            >
                <div className="mx-auto max-w-lg">
                    {step1Complete ? (
                        <button
                            type="button"
                            onClick={handleUseDefaultSettings}
                            disabled={isApplyingDefaults}
                            className={cx(
                                "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition-colors duration-150 font-ubuntu",
                                isApplyingDefaults
                                    ? "bg-[#00BFFF]/60 cursor-not-allowed"
                                    : "bg-[#00BFFF] hover:bg-[#00D4FF]",
                                "text-[#022136]",
                                "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]",
                            )}
                        >
                            {isApplyingDefaults ? "Saving..." : "Use Default Settings"}
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setShowAreYouSure(true)}
                            className={cx(
                                "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition-colors duration-150 font-ubuntu",
                                "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF]",
                                "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]",
                            )}
                        >
                            Skip For Now
                        </button>
                    )}
                </div>
            </footer>

            {/* ----------------------------------------------------------------
                Completion drawer — slides up over footer when all tasks done
            ---------------------------------------------------------------- */}
            <div
                className={cx(
                    "fixed bottom-0 left-0 right-0 z-30",
                    "rounded-t-2xl border-t border-[#00D4AA]/30",
                    "bg-[#1A2B3C] shadow-[0_-12px_32px_rgba(0,212,170,0.12)]",
                    "px-4 pb-8 pt-6",
                    "transition-transform duration-500 ease-out",
                    completionVisible ? "translate-y-0" : "translate-y-full",
                )}
                aria-hidden={!completionVisible}
            >
                <div className="mx-auto max-w-lg flex flex-col items-center gap-3 text-center">
                    {/* Glow badge */}
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#00D4AA]/15 border-2 border-[#00D4AA]/40 mb-1">
                        <Check className="h-6 w-6 text-[#00D4AA]" aria-hidden />
                    </div>
                    <h2 className="text-xl font-bold text-white font-ubuntu">
                        Set Up Complete!
                    </h2>
                    <p className="text-sm text-[#B8C4CC] font-ubuntu">
                        Let's start Vanyshing!
                    </p>
                    <button
                        type="button"
                        onClick={handleDashboard}
                        className={cx(
                            "mt-2 flex h-[52px] w-full items-center justify-center rounded-xl font-ubuntu",
                            "text-sm font-semibold text-[#022136] bg-[#00D4AA] hover:bg-[#00E8BB]",
                            "transition-colors duration-150 outline-none",
                            "focus-visible:ring-2 focus-visible:ring-[#00D4AA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A2B3C]",
                        )}
                    >
                        Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
