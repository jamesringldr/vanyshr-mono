import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import {
    Menu,
    Check,
    ChevronDown,
    ChevronRight,
    FileText,
    Phone,
    User,
    Home,
    Mail,
    Bell,
    Target,
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
                        <span className="font-semibold text-white text-sm font-ubuntu">
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
// Main page
// ---------------------------------------------------------------------------
export function OnboardingProgress() {
    const [onboardingStep, setOnboardingStep] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedStep, setExpandedStep] = useState<number>(1);
    const navigate = useNavigate();

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { setIsLoading(false); return; }

            const { data: profile } = await supabase
                .from("user_profiles")
                .select("onboarding_step")
                .eq("auth_user_id", user.id)
                .single();

            if (profile) setOnboardingStep(profile.onboarding_step ?? 0);
            setIsLoading(false);
        }
        load();
    }, []);

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
    const step2Complete = onboardingStep >= 6;
    const step3Complete = onboardingStep >= 7;

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

    return (
        <div className="flex min-h-screen flex-col bg-[#022136]">
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
                    aria-label="Open menu"
                    className={cx(
                        "flex h-10 w-10 items-center justify-center rounded-xl text-white outline-none transition-colors duration-150",
                        "hover:bg-white/5",
                        "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#022136]",
                    )}
                >
                    <Menu className="h-6 w-6" aria-hidden />
                </button>
            </header>

            {/* ----------------------------------------------------------------
                Scrollable content
            ---------------------------------------------------------------- */}
            <main className="flex-1 overflow-y-auto px-4 pb-36">
                <div className="mx-auto max-w-lg">

                    {/* Progress ring + headline */}
                    <div className="flex flex-col items-center gap-3 py-6">
                        <ProgressRing progress={progressPercent} />

                        <div className="text-center">
                            <h1 className="text-2xl font-bold text-white font-ubuntu">
                                {progressPercent === 100
                                    ? "Setup Complete!"
                                    : progressPercent === 0
                                    ? "Let's Get You Set Up"
                                    : "You're Making Progress!"}
                            </h1>
                            <p className="mt-1 text-sm text-[#B8C4CC] font-ubuntu">
                                {progressPercent === 100
                                    ? "Your privacy profile is fully configured."
                                    : "Complete each step below to activate your full protection."}
                            </p>
                        </div>

                        {/* Completion pill */}
                        <div className="rounded-full bg-[#2D3847] border border-[#2A4A68] px-4 py-1.5">
                            <span className="text-xs font-medium text-[#B8C4CC] font-ubuntu">
                                <span className="text-white font-bold">{totalCompleted}</span>
                                {" "}of{" "}
                                <span className="text-white font-bold">7</span>
                                {" "}tasks complete
                            </span>
                        </div>
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
                                title="Search Profile Setup"
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

                        {/* Step 2 — Notification Preferences */}
                        <div role="listitem">
                            <StepCard
                                stepNumber={2}
                                title="Notification Preferences"
                                description="Choose how and when we alert you"
                                isComplete={step2Complete}
                                isExpanded={false}
                                onToggle={() => {}}
                                onNavigate={() => navigate("/onboarding/notifications")}
                                hasSubTasks={false}
                            />
                        </div>

                        {/* Step 3 — Removal Aggression Preferences */}
                        <div role="listitem">
                            <StepCard
                                stepNumber={3}
                                title="Removal Aggression"
                                description="Set how aggressively we remove your data"
                                isComplete={step3Complete}
                                isExpanded={false}
                                onToggle={() => {}}
                                onNavigate={() => navigate("/onboarding/removal-aggression")}
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
                Sticky footer
            ---------------------------------------------------------------- */}
            <footer
                className={cx(
                    "fixed bottom-0 left-0 right-0 border-t px-4 py-4",
                    "border-[#2A4A68] bg-[#2D3847]",
                    "shadow-[0_-8px_24px_rgba(0,0,0,0.45)]",
                )}
            >
                <div className="mx-auto max-w-lg">
                    <button
                        type="button"
                        onClick={() => navigate("/dashboard/home")}
                        className={cx(
                            "flex h-[52px] w-full items-center justify-center rounded-xl text-sm font-semibold outline-none transition-colors duration-150 font-ubuntu",
                            "bg-[#00BFFF] text-[#022136] hover:bg-[#00D4FF]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#2D3847]",
                        )}
                    >
                        Skip For Now
                    </button>
                </div>
            </footer>
        </div>
    );
}
