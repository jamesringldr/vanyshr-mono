import { useState, useEffect } from "react";
import { Button } from "@/components/base/buttons/button";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { RadioGroup, RadioButton } from "@/components/base/radio-buttons/radio-buttons";
import { cx } from '@/utils/cx';
import { Plus, Phone } from "lucide-react";

export type NoResultsStep =
    | "initial"
    | "alternate-name"
    | "mobile-question"
    | "mobile-form"
    | "signup-cta";

export interface QSNoResultsModalProps {
    /** Whether the modal is open (controlled). */
    isOpen: boolean;
    /** Called when the modal should close. */
    onOpenChange: (open: boolean) => void;
    /** Name used in "Our QuickScan Didn't Find A {Name}". */
    searchName: string;
    /** Called when user submits alternate name and taps Scan again. */
    onScanAgain?: (type: "first" | "last", value: string) => void;
    /** Called when user submits phone and taps Scan Now. */
    onScanNow?: (phone: string) => void;
    /** Called when user taps Run Full Scan Now on signup CTA. */
    onRunFullScan?: () => void;
}

const INPUT_STYLE = cx(
    "h-[52px] w-full rounded-xl border px-4 py-3 text-sm transition-colors",
    "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
    "text-[var(--text-primary)] dark:text-white",
    "placeholder:text-[var(--text-muted)] dark:placeholder:text-[#7A92A8]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2",
);

/**
 * No-results Quick Scan modal flow: alternate name → mobile number → signup CTA.
 * Used when no results returned or user selects "Not Me" / "None of These Are Me".
 * Vanyshr Design System: rounded-xl, h-[52px] inputs, semantic tokens, dark variants.
 */
export function QSNoResultsModal({
    isOpen,
    onOpenChange,
    searchName,
    onScanAgain,
    onScanNow,
    onRunFullScan,
}: QSNoResultsModalProps) {
    const [step, setStep] = useState<NoResultsStep>("initial");
    const [showAlternateField, setShowAlternateField] = useState(false);
    const [alternateType, setAlternateType] = useState<"first" | "last">("first");
    const [alternateValue, setAlternateValue] = useState("");
    const [phoneValue, setPhoneValue] = useState("");

    const close = () => onOpenChange(false);

    // Reset step when modal opens
    useEffect(() => {
        if (isOpen) {
            setStep("initial");
            setShowAlternateField(false);
            setAlternateValue("");
            setPhoneValue("");
        }
    }, [isOpen]);

    const handleAlternateYes = () => setStep("alternate-name");
    const handleAlternateNo = () => setStep("mobile-question");
    const handleMobileYes = () => setStep("mobile-form");
    const handleMobileNo = () => setStep("signup-cta");

    const handleScanAgain = () => {
        onScanAgain?.(alternateType, alternateValue);
        close();
    };

    const handleScanNow = () => {
        onScanNow?.(phoneValue);
        close();
    };

    const handleRunFullScan = () => {
        onRunFullScan?.();
        close();
    };

    return (
        <ModalOverlay
            isOpen={isOpen}
            onOpenChange={onOpenChange}
            className={(state) =>
                cx(
                    "fixed inset-0 z-50 flex min-h-dvh w-full items-end justify-center overflow-y-auto outline-hidden backdrop-blur-[6px] sm:items-center sm:justify-center",
                    "bg-[#022136]/70 dark:bg-[#022136]/80",
                    "px-4 pt-4 pb-[clamp(16px,8vh,64px)] sm:p-8",
                    state.isEntering && "duration-300 ease-out animate-in fade-in",
                    state.isExiting && "duration-200 ease-in animate-out fade-out",
                )
            }
        >
            <Modal className="max-h-full w-full max-sm:overflow-y-auto">
                <Dialog
                    className="w-full max-w-sm p-0"
                    aria-labelledby="qs-no-results-title"
                    aria-describedby="qs-no-results-desc"
                >
                    <div
                        role="document"
                        className={cx(
                            "flex max-h-[85dvh] flex-col overflow-hidden rounded-xl border shadow-lg transition-colors",
                            "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        <div className="overflow-y-auto px-6 pt-6 pb-6">
                            {/* Step: initial */}
                            {step === "initial" && (
                                <div className="space-y-6 text-center">
                                    <h2
                                        id="qs-no-results-title"
                                        className="text-lg font-bold text-[var(--text-primary)] dark:text-white"
                                    >
                                        Good News! You&apos;re harder to find than most!
                                    </h2>
                                    <p className="text-base font-normal text-[var(--text-primary)] dark:text-white">
                                        Our QuickScan Didn&apos;t Find A
                                        <br />
                                        <span className="font-bold text-[#14ABFE] dark:text-[#14ABFE]">{searchName}</span>
                                    </p>
                                    <p
                                        id="qs-no-results-desc"
                                        className="text-sm text-[var(--text-secondary)] dark:text-[#A8BFD4]"
                                    >
                                        Do you have a maiden or alternate name you regularly go by?
                                    </p>
                                    <div className="flex gap-3">
                                        <Button
                                            type="button"
                                            size="lg"
                                            color="primary"
                                            className="h-[52px] flex-1 rounded-xl bg-[#14ABFE] font-semibold text-white"
                                            onClick={handleAlternateYes}
                                        >
                                            Yes
                                        </Button>
                                        <Button
                                            type="button"
                                            size="lg"
                                            color="secondary"
                                            className={cx(
                                                "h-[52px] flex-1 rounded-xl font-semibold",
                                                "bg-[#F0F4F8] dark:bg-[#022136]/50 dark:text-white",
                                                "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                            )}
                                            onClick={handleAlternateNo}
                                        >
                                            No
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step: alternate name form */}
                            {step === "alternate-name" && (
                                <div className="space-y-4">
                                    <h2 className="text-base font-bold text-[var(--text-primary)] dark:text-white">
                                        Add alternate name
                                    </h2>
                                    <RadioGroup
                                        name="alternateType"
                                        value={alternateType}
                                        onChange={(v) => setAlternateType(v as "first" | "last")}
                                        className="gap-3"
                                    >
                                        <RadioButton value="first" label="Alternate First Name" />
                                        <RadioButton value="last" label="Maiden/Alternate Last Name" />
                                    </RadioGroup>
                                    {!showAlternateField ? (
                                        <button
                                            type="button"
                                            onClick={() => setShowAlternateField(true)}
                                            className={cx(
                                                "flex h-[52px] w-full items-center justify-center gap-2 rounded-xl border border-dashed transition-colors",
                                                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                                "text-[var(--text-secondary)] dark:text-[#A8BFD4]",
                                                "hover:bg-[#F0F4F8]/50 dark:hover:bg-[#022136]/50",
                                            )}
                                        >
                                            <Plus className="size-5" aria-hidden />
                                            <span className="text-sm font-medium">Add name</span>
                                        </button>
                                    ) : (
                                        <div className="space-y-2">
                                            <input
                                                type="text"
                                                value={alternateValue}
                                                onChange={(e) => setAlternateValue(e.target.value)}
                                                placeholder={alternateType === "first" ? "Alternate first name" : "Maiden / alternate last name"}
                                                className={INPUT_STYLE}
                                                autoFocus
                                            />
                                        </div>
                                    )}
                                    <Button
                                        type="button"
                                        size="lg"
                                        color="primary"
                                        className="h-[52px] w-full rounded-xl bg-[#14ABFE] font-semibold text-white"
                                        onClick={handleScanAgain}
                                    >
                                        Scan again
                                    </Button>
                                </div>
                            )}

                            {/* Step: mobile number question */}
                            {step === "mobile-question" && (
                                <div className="space-y-6 text-center">
                                    <h2 className="text-base font-bold text-[var(--text-primary)] dark:text-white">
                                        Scan for your mobile number?
                                    </h2>
                                    <div className="flex gap-3">
                                        <Button
                                            type="button"
                                            size="lg"
                                            color="primary"
                                            className="h-[52px] flex-1 rounded-xl bg-[#14ABFE] font-semibold text-white"
                                            onClick={handleMobileYes}
                                        >
                                            Yes
                                        </Button>
                                        <Button
                                            type="button"
                                            size="lg"
                                            color="secondary"
                                            className={cx(
                                                "h-[52px] flex-1 rounded-xl font-semibold",
                                                "bg-[#F0F4F8] dark:bg-[#022136]/50 dark:text-white",
                                                "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                            )}
                                            onClick={handleMobileNo}
                                        >
                                            No
                                        </Button>
                                    </div>
                                </div>
                            )}

                            {/* Step: mobile number form */}
                            {step === "mobile-form" && (
                                <div className="space-y-4">
                                    <h2 className="text-base font-bold text-[var(--text-primary)] dark:text-white">
                                        Enter your mobile number
                                    </h2>
                                    <div className="relative">
                                        <input
                                            type="tel"
                                            value={phoneValue}
                                            onChange={(e) => setPhoneValue(e.target.value)}
                                            placeholder="(555) 123-4567"
                                            className={cx(INPUT_STYLE, "pl-12")}
                                            autoFocus
                                        />
                                        <Phone className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-[var(--text-muted)] dark:text-[#7A92A8]" aria-hidden />
                                    </div>
                                    <Button
                                        type="button"
                                        size="lg"
                                        color="primary"
                                        className="h-[52px] w-full rounded-xl bg-[#14ABFE] font-semibold text-white"
                                        onClick={handleScanNow}
                                    >
                                        Scan Now
                                    </Button>
                                </div>
                            )}

                            {/* Step: signup CTA */}
                            {step === "signup-cta" && (
                                <div className="space-y-5 text-center">
                                    <h2 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">
                                        Sign up for a Forever Free account and Run a Full Scan
                                    </h2>
                                    <p className="text-sm text-[var(--text-secondary)] dark:text-[#A8BFD4] leading-relaxed">
                                        Our QuickScan searches the most common brokers. However, that&apos;s &lt;5% of brokers and sources we monitor.
                                    </p>
                                    <p className="text-sm font-semibold text-[var(--text-primary)] dark:text-white">
                                        Sign up for a Forever Free account for:
                                    </p>
                                    <ul className="space-y-2 text-left text-sm text-[var(--text-primary)] dark:text-white">
                                        <li className="flex gap-2">
                                            <span className="text-[#14ABFE] dark:text-[#14ABFE]">•</span>
                                            <span>Scan for 300+ additional brokers</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-[#14ABFE] dark:text-[#14ABFE]">•</span>
                                            <span>Dark Web Data Breach Scan</span>
                                        </li>
                                        <li className="flex gap-2">
                                            <span className="text-[#14ABFE] dark:text-[#14ABFE]">•</span>
                                            <span>Access to manually scan brokers once a month</span>
                                        </li>
                                    </ul>
                                    <Button
                                        type="button"
                                        size="lg"
                                        color="primary"
                                        className="h-[52px] w-full rounded-xl bg-[#14ABFE] font-semibold text-white"
                                        onClick={handleRunFullScan}
                                    >
                                        Run Full Scan Now
                                    </Button>
                                    <p className="text-xs text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                                        No credit card required
                                    </p>
                                    <p className="text-xs text-[var(--text-secondary)] dark:text-[#A8BFD4] leading-snug">
                                        Cancel any time for any reason and we will make 100% of your data vanish from our databases.
                                    </p>
                                    <Button
                                        type="button"
                                        size="lg"
                                        color="secondary"
                                        className={cx(
                                            "h-[52px] w-full rounded-xl font-semibold",
                                            "bg-[#F0F4F8] dark:bg-[#022136]/50 dark:text-white",
                                            "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                        )}
                                        onClick={close}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
