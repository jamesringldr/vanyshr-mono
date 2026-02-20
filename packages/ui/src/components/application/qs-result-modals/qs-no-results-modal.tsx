import { useState, useEffect } from "react";
import { cx } from '@/utils/cx';
import { RadioGroup, RadioButton } from "@/components/base/radio-buttons/radio-buttons";
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
    "h-[52px] w-full rounded-lg border-2 px-4 py-3 text-sm transition-colors",
    "bg-gray-50 border-gray-200",
    "text-slate-800 placeholder:text-slate-400",
    "focus:outline-none focus:border-[#00BFFF] focus:ring-2 focus:ring-[#00BFFF]/20",
);

/**
 * No-results Quick Scan modal flow: alternate name → mobile number → signup CTA.
 * White card on dark-blurred backdrop — consistent with prototype modal design.
 * Steps: initial → alternate-name → mobile-question → mobile-form → signup-cta.
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
    const [showContent, setShowContent] = useState(false);
    const [showAlternateField, setShowAlternateField] = useState(false);
    const [alternateType, setAlternateType] = useState<"first" | "last">("first");
    const [alternateValue, setAlternateValue] = useState("");
    const [phoneValue, setPhoneValue] = useState("");

    const close = () => onOpenChange(false);

    useEffect(() => {
        if (isOpen) {
            setStep("initial");
            setShowAlternateField(false);
            setAlternateValue("");
            setPhoneValue("");
            const timer = setTimeout(() => setShowContent(true), 10);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div
                className={cx(
                    "bg-white w-full max-w-md rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden",
                    "transform transition-all duration-300 ease-out",
                    showContent ? "scale-100 opacity-100" : "scale-95 opacity-0",
                )}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex-shrink-0 relative text-center">
                    <button
                        onClick={close}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {step === "initial" && (
                        <>
                            <h2
                                id="qs-no-results-title"
                                className="text-xl font-extrabold text-slate-800 leading-tight mb-2"
                            >
                                Good News!
                            </h2>
                            <p className="text-sm text-slate-500 font-medium">
                                You&apos;re harder to find than most
                            </p>
                        </>
                    )}
                    {step === "alternate-name" && (
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
                            Add Alternate Name
                        </h2>
                    )}
                    {step === "mobile-question" && (
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
                            Scan Your Mobile Number?
                        </h2>
                    )}
                    {step === "mobile-form" && (
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
                            Enter Your Mobile Number
                        </h2>
                    )}
                    {step === "signup-cta" && (
                        <h2 className="text-xl font-extrabold text-slate-800 leading-tight">
                            Run a Full Scan
                        </h2>
                    )}
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-white">

                    {/* Step: initial */}
                    {step === "initial" && (
                        <div className="space-y-5 text-center">
                            <div className="rounded-lg p-4 bg-gray-50 border-2 border-[#00BFFF]/20">
                                <p className="text-base text-slate-700">
                                    Our QuickScan Didn&apos;t Find A
                                </p>
                                <p className="text-lg font-bold text-[#00BFFF] mt-1">
                                    {searchName}
                                </p>
                            </div>
                            <p
                                id="qs-no-results-desc"
                                className="text-sm text-slate-500"
                            >
                                Do you have a maiden or alternate name you regularly go by?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleAlternateYes}
                                    className="flex-1 py-3.5 rounded-lg font-bold text-lg text-white bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98] shadow-lg transition-all duration-200"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={handleAlternateNo}
                                    className="flex-1 py-3.5 rounded-lg font-bold text-lg text-slate-800 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] shadow-lg transition-all duration-200"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: alternate name form */}
                    {step === "alternate-name" && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 text-center">
                                Select the name type and enter your alternate name below.
                            </p>
                            <RadioGroup
                                name="alternateType"
                                value={alternateType}
                                onChange={(v) => setAlternateType(v as "first" | "last")}
                                className="gap-3"
                            >
                                <RadioButton value="first" label="Alternate First Name" />
                                <RadioButton value="last" label="Maiden / Alternate Last Name" />
                            </RadioGroup>

                            {!showAlternateField ? (
                                <button
                                    type="button"
                                    onClick={() => setShowAlternateField(true)}
                                    className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-gray-200 text-slate-500 transition-colors hover:border-[#00BFFF]/50 hover:text-[#00BFFF] focus:outline-none focus:border-[#00BFFF]"
                                >
                                    <Plus className="size-5" aria-hidden />
                                    <span className="text-sm font-medium">Add name</span>
                                </button>
                            ) : (
                                <input
                                    type="text"
                                    value={alternateValue}
                                    onChange={(e) => setAlternateValue(e.target.value)}
                                    placeholder={alternateType === "first" ? "Alternate first name" : "Maiden / alternate last name"}
                                    className={INPUT_STYLE}
                                    autoFocus
                                />
                            )}

                            <button
                                type="button"
                                onClick={handleScanAgain}
                                className="w-full py-3.5 rounded-lg font-bold text-lg text-white bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98] shadow-lg transition-all duration-200"
                            >
                                Scan Again
                            </button>
                        </div>
                    )}

                    {/* Step: mobile number question */}
                    {step === "mobile-question" && (
                        <div className="space-y-5 text-center">
                            <p className="text-sm text-slate-500">
                                Some brokers list records by phone number. Would you like us to scan for your mobile number?
                            </p>
                            <div className="flex gap-3">
                                <button
                                    type="button"
                                    onClick={handleMobileYes}
                                    className="flex-1 py-3.5 rounded-lg font-bold text-lg text-white bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98] shadow-lg transition-all duration-200"
                                >
                                    Yes
                                </button>
                                <button
                                    type="button"
                                    onClick={handleMobileNo}
                                    className="flex-1 py-3.5 rounded-lg font-bold text-lg text-slate-800 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] shadow-lg transition-all duration-200"
                                >
                                    No
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step: mobile number form */}
                    {step === "mobile-form" && (
                        <div className="space-y-4">
                            <p className="text-sm text-slate-500 text-center">
                                Enter your mobile number to search broker records.
                            </p>
                            <div className="relative">
                                <input
                                    type="tel"
                                    value={phoneValue}
                                    onChange={(e) => setPhoneValue(e.target.value)}
                                    placeholder="(555) 123-4567"
                                    className={cx(INPUT_STYLE, "pl-12")}
                                    autoFocus
                                />
                                <Phone className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" aria-hidden />
                            </div>
                            <button
                                type="button"
                                onClick={handleScanNow}
                                className="w-full py-3.5 rounded-lg font-bold text-lg text-white bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98] shadow-lg transition-all duration-200"
                            >
                                Scan Now
                            </button>
                        </div>
                    )}

                    {/* Step: signup CTA */}
                    {step === "signup-cta" && (
                        <div className="space-y-5">
                            <div className="rounded-lg p-4 bg-gray-50 border-2 border-[#00BFFF]/20 text-center">
                                <p className="text-sm text-slate-600 leading-relaxed">
                                    Our QuickScan searches the most common brokers — that&apos;s less than 5% of all the brokers and sources we monitor.
                                </p>
                            </div>

                            <div>
                                <p className="text-sm font-semibold text-slate-800 mb-3">
                                    Sign up for a Forever Free account to:
                                </p>
                                <ul className="space-y-2 text-sm text-slate-700">
                                    <li className="flex gap-2">
                                        <span className="text-[#00BFFF] font-bold flex-shrink-0">•</span>
                                        <span>Scan 300+ additional brokers</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-[#00BFFF] font-bold flex-shrink-0">•</span>
                                        <span>Dark Web Data Breach Scan</span>
                                    </li>
                                    <li className="flex gap-2">
                                        <span className="text-[#00BFFF] font-bold flex-shrink-0">•</span>
                                        <span>Access to manually scan brokers once a month</span>
                                    </li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={handleRunFullScan}
                                className="w-full py-3.5 rounded-lg font-bold text-lg text-white bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98] shadow-lg transition-all duration-200"
                            >
                                Run Full Scan Now
                            </button>

                            <p className="text-xs text-center text-slate-400">
                                No credit card required &middot; Cancel any time
                            </p>

                            <button
                                type="button"
                                onClick={close}
                                className="w-full py-3 rounded-lg font-bold text-base text-slate-600 bg-gray-100 hover:bg-gray-200 active:scale-[0.98] transition-all duration-200"
                            >
                                Cancel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
