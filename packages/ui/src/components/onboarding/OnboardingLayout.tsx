import { useState } from "react";
import PrimaryLogo from "@/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@/assets/PrimaryLogo-DarkMode.png";
import { StepProgressIndicator, type OnboardingStep } from "./StepProgressIndicator";
import { cx } from '@/utils/cx';

interface OnboardingLayoutProps {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
    title: string;
    /** Subtext shown below the title (e.g. "Click on Field to Edit") */
    subtitle?: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
    /** Called when user confirms they want to go to the dashboard */
    onDashboardNavigate?: () => void;
}

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

export function OnboardingLayout({
    currentStep,
    completedSteps,
    title,
    subtitle,
    children,
    footer,
    onDashboardNavigate,
}: OnboardingLayoutProps) {
    const [showAreYouSure, setShowAreYouSure] = useState(false);

    const handleDashboardClick = () => {
        if (onDashboardNavigate) {
            setShowAreYouSure(true);
        }
    };

    return (
        <div
            className={cx(
                "flex min-h-screen flex-col transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
        >
            {showAreYouSure && onDashboardNavigate && (
                <AreYouSureModal
                    onCompleteSetUp={() => setShowAreYouSure(false)}
                    onContinueToDashboard={onDashboardNavigate}
                />
            )}

            {/* Header */}
            <header
                className={cx(
                    "flex items-center justify-between px-4 py-3",
                    "bg-[#F0F4F8] dark:bg-[#022136]",
                )}
            >
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
                {onDashboardNavigate && (
                    <button
                        type="button"
                        onClick={handleDashboardClick}
                        className={cx(
                            "flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold font-ubuntu outline-none transition-colors duration-150",
                            "text-[#022136] dark:text-white bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                    >
                        Dashboard
                    </button>
                )}
            </header>

            {/* Step Progress Indicator */}
            <div className="bg-[#F0F4F8] dark:bg-[#022136]">
                <StepProgressIndicator
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                />
            </div>

            {/* Page Title + Subtitle */}
            <div className="px-4 py-4 bg-[#F0F4F8] dark:bg-[#022136]">
                <h1 className="text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    {title}
                </h1>
                {subtitle && (
                    <p className="mt-1 text-center text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                        {subtitle}
                    </p>
                )}
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto px-4 pb-28 bg-[#F0F4F8] dark:bg-[#022136]">
                <div className="mx-auto flex max-w-lg flex-col gap-4">
                    {children}
                </div>
            </main>

            {/* Footer */}
            {(footer || onDashboardNavigate) && (
                <footer
                    className={cx(
                        "fixed bottom-0 left-0 right-0 border-t py-4 px-4",
                        "rounded-tl-2xl rounded-tr-2xl",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        "bg-[var(--bg-surface)]/80 dark:bg-[#2D3847]/80",
                        "backdrop-blur-md",
                    )}
                >
                    <div className="mx-auto max-w-lg flex flex-col items-center gap-3">
                        {footer}
                        {onDashboardNavigate && (
                            <button
                                type="button"
                                onClick={handleDashboardClick}
                                className="text-sm font-semibold text-[#00BFFF] hover:text-[#00D4FF] transition-colors duration-150 cursor-pointer outline-none focus-visible:underline"
                            >
                                Skip for Now
                            </button>
                        )}
                    </div>
                </footer>
            )}
        </div>
    );
}
