import {
    FileText,
    Phone,
    User,
    Home,
    Mail,
    Check,
} from "lucide-react";
import { cx } from '@/utils/cx';

export type OnboardingStep =
    | "basic"
    | "phone"
    | "aliases"
    | "addresses"
    | "emails";

interface StepProgressIndicatorProps {
    currentStep: OnboardingStep;
    completedSteps: OnboardingStep[];
}

const STEPS: {
    id: OnboardingStep;
    icon: typeof FileText;
    label: string;
}[] = [
    { id: "basic", icon: FileText, label: "Basic Information" },
    { id: "phone", icon: Phone, label: "Phone Numbers" },
    { id: "aliases", icon: User, label: "Aliases" },
    { id: "addresses", icon: Home, label: "Addresses" },
    { id: "emails", icon: Mail, label: "Emails" },
];

export function StepProgressIndicator({
    currentStep,
    completedSteps,
}: StepProgressIndicatorProps) {
    const getStepState = (
        stepId: OnboardingStep,
    ): "completed" | "current" | "upcoming" => {
        if (completedSteps.includes(stepId)) return "completed";
        if (stepId === currentStep) return "current";
        return "upcoming";
    };

    return (
        <div
            className="flex items-center justify-center py-4 px-4"
            role="list"
            aria-label="Onboarding progress"
        >
            <div className="flex items-center gap-0">
                {STEPS.map((step, index) => {
                    const state = getStepState(step.id);
                    const Icon = step.icon;
                    const isLast = index === STEPS.length - 1;

                    return (
                        <div
                            key={step.id}
                            className="flex items-center gap-0"
                            role="listitem"
                            aria-label={`${step.label} - ${state}`}
                        >
                            <div
                                className={cx(
                                    "relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                                    state === "completed" &&
                                        "bg-[#00D4AA] dark:bg-[#00D4AA]",
                                    state === "current" &&
                                        "bg-[#00BFFF] dark:bg-[#00BFFF]",
                                    state === "upcoming" &&
                                        "bg-transparent border-2 border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                )}
                            >
                                {state === "completed" ? (
                                    <Check
                                        className="h-5 w-5 text-white"
                                        aria-hidden
                                    />
                                ) : (
                                    <Icon
                                        className={cx(
                                            "h-5 w-5",
                                            state === "current"
                                                ? "text-white"
                                                : "text-[var(--text-muted)] dark:text-[#7A92A8]",
                                        )}
                                        aria-hidden
                                    />
                                )}
                            </div>
                            {!isLast && (
                                <div
                                    className={cx(
                                        "h-0.5 w-8 flex-shrink-0 transition-colors duration-200",
                                        completedSteps.includes(step.id)
                                            ? "bg-[#00D4AA] dark:bg-[#00D4AA]"
                                            : "bg-[var(--border-subtle)] dark:bg-[#2A4A68]",
                                    )}
                                    aria-hidden
                                />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
