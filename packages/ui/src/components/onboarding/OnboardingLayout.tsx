import { Menu } from "lucide-react";
import PrimaryLogo from "@/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@/assets/PrimaryLogo-DarkMode.png";
import { StepProgressIndicator, type OnboardingStep } from "./StepProgressIndicator";
import { cx } from '@/utils/cx';

interface OnboardingLayoutProps {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
    title: string;
    children: React.ReactNode;
    onMenuClick?: () => void;
    footer?: React.ReactNode;
}

export function OnboardingLayout({
    currentStep,
    completedSteps,
    title,
    children,
    onMenuClick,
    footer,
}: OnboardingLayoutProps) {
    return (
        <div
            className={cx(
                "flex min-h-screen flex-col transition-colors duration-200",
                "bg-[#F0F4F8] dark:bg-[#022136]",
            )}
            role="main"
        >
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
                <button
                    type="button"
                    onClick={onMenuClick}
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

            {/* Step Progress Indicator */}
            <div className="bg-[#F0F4F8] dark:bg-[#022136]">
                <StepProgressIndicator
                    currentStep={currentStep}
                    completedSteps={completedSteps}
                />
            </div>

            {/* Page Title */}
            <div className="px-4 py-4 bg-[#F0F4F8] dark:bg-[#022136]">
                <h1 className="text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white">
                    {title}
                </h1>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto px-4 pb-28 bg-[#F0F4F8] dark:bg-[#022136]">
                <div className="mx-auto flex max-w-lg flex-col gap-4">
                    {children}
                </div>
            </main>

            {/* Footer */}
            {footer && (
                <footer
                    className={cx(
                        "fixed bottom-0 left-0 right-0 border-t py-4 px-4",
                        "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                    )}
                >
                    <div className="mx-auto max-w-lg">{footer}</div>
                </footer>
            )}
        </div>
    );
}
