import { useState, useEffect } from "react";
import { cx } from "@/utils/cx";
import { Plus, Phone } from "lucide-react";
import type { ZabaPhoneResult } from "@vanyshr/shared/types";
import { QSModalFrame, qsModal } from "./qs-modal";

export type NoResultsStep =
    | "initial"
    | "alternate-name"
    | "mobile-question"
    | "mobile-form"
    | "phone-loading"
    | "phone-result"
    | "phone-error"
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
    /** Called when user taps Run Full Scan Now on signup CTA. */
    onRunFullScan?: () => void;
    /** Called when user submits a phone number for lookup. Should call the phone-lookup edge function. */
    onPhoneLookup?: (phone: string) => Promise<ZabaPhoneResult | { error: string }>;
}

function DarkOption({
    selected,
    onSelect,
    children,
}: {
    selected: boolean;
    onSelect: () => void;
    children: string;
}) {
    return (
        <button
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={onSelect}
            className={cx(qsModal.option, selected ? qsModal.optionOn : qsModal.optionOff)}
        >
            <span
                className={cx(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition",
                    selected ? "border-accent-primary bg-accent-primary" : "border-border-subtle bg-transparent",
                )}
                aria-hidden
            >
                {selected ? <span className="h-1.5 w-1.5 rounded-full bg-bg-page" /> : null}
            </span>
            {children}
        </button>
    );
}

/**
 * No-results Quick Scan modal flow: alternate name → mobile number → signup CTA.
 * Navy overlay matching the rest of the loading-flow modals.
 */
export function QSNoResultsModal({
    isOpen,
    onOpenChange,
    searchName,
    onScanAgain,
    onRunFullScan,
    onPhoneLookup,
}: QSNoResultsModalProps) {
    const [step, setStep] = useState<NoResultsStep>("initial");
    const [showContent, setShowContent] = useState(false);
    const [showAlternateField, setShowAlternateField] = useState(false);
    const [alternateType, setAlternateType] = useState<"first" | "last">("first");
    const [alternateValue, setAlternateValue] = useState("");
    const [phoneValue, setPhoneValue] = useState("");
    const [inlinePhoneError, setInlinePhoneError] = useState<string | null>(null);
    const [phoneResult, setPhoneResult] = useState<ZabaPhoneResult | null>(null);
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [showMoreDetails, setShowMoreDetails] = useState(false);

    const close = () => onOpenChange(false);

    useEffect(() => {
        if (!isOpen) {
            setShowContent(false);
            return;
        }
        setStep("initial");
        setShowAlternateField(false);
        setAlternateValue("");
        setPhoneValue("");
        setInlinePhoneError(null);
        setPhoneResult(null);
        setPhoneError(null);
        setShowMoreDetails(false);
        const timer = setTimeout(() => setShowContent(true), 10);
        return () => clearTimeout(timer);
    }, [isOpen]);

    const handleAlternateYes = () => setStep("alternate-name");
    const handleAlternateNo = () => setStep("mobile-question");
    const handleMobileYes = () => setStep("mobile-form");
    const handleMobileNo = () => setStep("signup-cta");

    const handleScanAgain = () => {
        onScanAgain?.(alternateType, alternateValue);
        close();
    };

    const handleRunFullScan = () => {
        onRunFullScan?.();
        close();
    };

    const handleScanNow = async () => {
        const digits = phoneValue.replace(/\D/g, "");
        const normalized =
            digits.length === 11 && digits[0] === "1" ? digits.slice(1) : digits;

        if (normalized.length !== 10) {
            setInlinePhoneError("Please enter a valid 10-digit US phone number.");
            return;
        }
        setInlinePhoneError(null);

        if (!onPhoneLookup) {
            close();
            return;
        }

        setStep("phone-loading");

        try {
            const result = await onPhoneLookup(normalized);

            if ("error" in result) {
                setPhoneError(result.error);
                setStep("phone-error");
                return;
            }

            setPhoneResult(result);
            setStep("phone-result");
        } catch {
            setPhoneError("fetch_failed");
            setStep("phone-error");
        }
    };

    if (!isOpen) return null;

    const isLoadingStep = step === "phone-loading";

    const titles: Record<NoResultsStep, string> = {
        initial: "Good news!",
        "alternate-name": "Add alternate name",
        "mobile-question": "Scan your mobile number?",
        "mobile-form": "Enter your mobile number",
        "phone-loading": "Searching records...",
        "phone-result": "Record found",
        "phone-error": "Search complete",
        "signup-cta": "Run a full scan",
    };

    return (
        <QSModalFrame showContent={showContent} onClose={close} closeDisabled={isLoadingStep}>
            <div className={qsModal.header}>
                <h2 id="qs-no-results-title" className={qsModal.title}>
                    {titles[step]}
                </h2>
                {step === "initial" ? (
                    <p className={qsModal.subtitle}>You&apos;re harder to find than most</p>
                ) : null}
            </div>

            <div className={qsModal.body}>
                {step === "initial" && (
                    <div className="space-y-5">
                        <div className={qsModal.card}>
                            <p className={qsModal.bodyText}>Our QuickScan didn&apos;t find a</p>
                            <p className={cx("mt-1 text-lg font-bold", qsModal.accent)}>{searchName}</p>
                        </div>
                        <p id="qs-no-results-desc" className={qsModal.muted}>
                            Do you have a maiden or alternate name you regularly go by?
                        </p>
                        <div className="flex gap-3">
                            <button type="button" onClick={handleAlternateYes} className={cx(qsModal.primaryBtn, "flex-1")}>
                                Yes
                            </button>
                            <button type="button" onClick={handleAlternateNo} className={cx(qsModal.secondaryBtn, "flex-1")}>
                                No
                            </button>
                        </div>
                    </div>
                )}

                {step === "alternate-name" && (
                    <div className="space-y-4">
                        <p className={cx(qsModal.muted, "text-center")}>
                            Select the name type and enter your alternate name below.
                        </p>
                        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Alternate name type">
                            <DarkOption selected={alternateType === "first"} onSelect={() => setAlternateType("first")}>
                                Alternate first name
                            </DarkOption>
                            <DarkOption selected={alternateType === "last"} onSelect={() => setAlternateType("last")}>
                                Maiden / alternate last name
                            </DarkOption>
                        </div>

                        {!showAlternateField ? (
                            <button
                                type="button"
                                onClick={() => setShowAlternateField(true)}
                                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-subtle text-text-tertiary transition-colors hover:border-accent-primary/50 hover:text-accent-primary focus:outline-none focus:ring-2 focus:ring-accent-primary"
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
                                className={qsModal.input}
                                autoFocus
                            />
                        )}

                        <button type="button" onClick={handleScanAgain} className={cx(qsModal.primaryBtn, "w-full")}>
                            Scan again
                        </button>
                    </div>
                )}

                {step === "mobile-question" && (
                    <div className="space-y-5">
                        <p className={qsModal.muted}>
                            Some brokers list records by phone number. Would you like us to scan for your mobile number?
                        </p>
                        <div className="flex gap-3">
                            <button type="button" onClick={handleMobileYes} className={cx(qsModal.primaryBtn, "flex-1")}>
                                Yes
                            </button>
                            <button type="button" onClick={handleMobileNo} className={cx(qsModal.secondaryBtn, "flex-1")}>
                                No
                            </button>
                        </div>
                    </div>
                )}

                {step === "mobile-form" && (
                    <div className="space-y-4">
                        <p className={cx(qsModal.muted, "text-center")}>
                            Enter your mobile number to search broker records.
                        </p>
                        <div className="relative">
                            <input
                                type="tel"
                                value={phoneValue}
                                onChange={(e) => {
                                    setPhoneValue(e.target.value);
                                    setInlinePhoneError(null);
                                }}
                                placeholder="(555) 123-4567"
                                className={cx(qsModal.input, "pl-12")}
                                autoFocus
                            />
                            <Phone className="absolute left-4 top-1/2 size-5 -translate-y-1/2 text-text-tertiary" aria-hidden />
                        </div>
                        {inlinePhoneError && (
                            <p className="text-xs font-medium text-accent-orange">{inlinePhoneError}</p>
                        )}
                        <button type="button" onClick={handleScanNow} className={cx(qsModal.primaryBtn, "w-full")}>
                            Scan now
                        </button>
                    </div>
                )}

                {step === "phone-loading" && (
                    <div className="space-y-4 py-6 text-center">
                        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-border-subtle border-t-accent-primary" />
                        <p className={cx(qsModal.muted, "font-medium")}>Searching phone records...</p>
                    </div>
                )}

                {step === "phone-result" && phoneResult && (
                    <div className="space-y-4">
                        <div className={qsModal.card}>
                            <p className="text-lg font-bold text-white">{phoneResult.name ?? "Record found"}</p>
                            {phoneResult.age && (
                                <p className="mt-0.5 text-sm text-text-tertiary">
                                    Age {phoneResult.age}
                                    {phoneResult.birth_year && ` · Born ${phoneResult.birth_year}`}
                                </p>
                            )}
                        </div>

                        <div className="space-y-2 text-sm">
                            {phoneResult.location && (
                                <div className="flex items-start gap-2">
                                    <span className="w-20 shrink-0 font-semibold text-accent-primary">Location</span>
                                    <span className="text-text-secondary">{phoneResult.location}</span>
                                </div>
                            )}
                            {(phoneResult.line_type || phoneResult.carrier) && (
                                <div className="flex items-start gap-2">
                                    <span className="w-20 shrink-0 font-semibold text-accent-primary">Line Type</span>
                                    <span className="text-text-secondary">
                                        {[phoneResult.line_type, phoneResult.carrier].filter(Boolean).join(" · ")}
                                    </span>
                                </div>
                            )}
                            {phoneResult.most_recent_address && (
                                <div className="flex items-start gap-2">
                                    <span className="w-20 shrink-0 font-semibold text-accent-primary">Address</span>
                                    <span className="text-text-secondary">{phoneResult.most_recent_address}</span>
                                </div>
                            )}
                            {phoneResult.previous_phones.length > 0 && (
                                <div className="flex items-start gap-2">
                                    <span className="w-20 shrink-0 font-semibold text-accent-primary">Also Used</span>
                                    <span className="text-text-secondary">{phoneResult.previous_phones.join(", ")}</span>
                                </div>
                            )}
                        </div>

                        {(phoneResult.aliases.length > 0 ||
                            phoneResult.related_persons.length > 0 ||
                            phoneResult.previous_addresses.length > 0 ||
                            phoneResult.jobs.length > 0) && (
                            <div>
                                <button
                                    type="button"
                                    onClick={() => setShowMoreDetails((v) => !v)}
                                    className="text-sm font-semibold text-accent-primary transition-colors hover:text-accent-hover"
                                >
                                    {showMoreDetails ? "Show less ↑" : "Show more details ↓"}
                                </button>
                                {showMoreDetails && (
                                    <div className="mt-3 space-y-3 text-sm text-text-secondary">
                                        {phoneResult.aliases.length > 0 && (
                                            <div>
                                                <p className="mb-0.5 font-semibold text-white">Also known as</p>
                                                <p>{phoneResult.aliases.join(", ")}</p>
                                            </div>
                                        )}
                                        {phoneResult.related_persons.length > 0 && (
                                            <div>
                                                <p className="mb-0.5 font-semibold text-white">Related persons</p>
                                                <p>{phoneResult.related_persons.map((r) => r.name).join(", ")}</p>
                                            </div>
                                        )}
                                        {phoneResult.previous_addresses.length > 0 && (
                                            <div>
                                                <p className="mb-0.5 font-semibold text-white">Previous addresses</p>
                                                <ul className="space-y-0.5">
                                                    {phoneResult.previous_addresses.map((a, i) => (
                                                        <li key={i}>{a}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {phoneResult.jobs.length > 0 && (
                                            <div>
                                                <p className="mb-0.5 font-semibold text-white">Jobs</p>
                                                <ul className="space-y-0.5">
                                                    {phoneResult.jobs.map((j, i) => (
                                                        <li key={i}>{j}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <button type="button" onClick={handleRunFullScan} className={cx(qsModal.primaryBtn, "w-full")}>
                            Run full scan now
                        </button>
                        <p className="text-center text-xs text-text-tertiary">
                            No credit card required &middot; Cancel any time
                        </p>
                    </div>
                )}

                {step === "phone-error" && (
                    <div className="space-y-5">
                        <div className={qsModal.card}>
                            <p className={qsModal.bodyText}>
                                {phoneError === "no_result"
                                    ? "No records were found for that phone number."
                                    : "Something went wrong. Please try again."}
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button type="button" onClick={() => setStep("mobile-form")} className={cx(qsModal.secondaryBtn, "flex-1")}>
                                Try again
                            </button>
                            <button type="button" onClick={handleRunFullScan} className={cx(qsModal.primaryBtn, "flex-1")}>
                                Full scan
                            </button>
                        </div>
                    </div>
                )}

                {step === "signup-cta" && (
                    <div className="space-y-5">
                        <div className={qsModal.card}>
                            <p className="text-sm leading-relaxed text-text-secondary">
                                Our QuickScan searches the most common brokers — that&apos;s less than 5% of all the brokers and sources we monitor.
                            </p>
                        </div>

                        <div>
                            <p className="mb-3 text-sm font-semibold text-white">Sign up for a Forever Free account to:</p>
                            <ul className="space-y-2 text-sm text-text-secondary">
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 font-bold text-accent-primary">•</span>
                                    <span>Scan 300+ additional brokers</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 font-bold text-accent-primary">•</span>
                                    <span>Dark Web Data Breach Scan</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="flex-shrink-0 font-bold text-accent-primary">•</span>
                                    <span>Access to manually scan brokers once a month</span>
                                </li>
                            </ul>
                        </div>

                        <button type="button" onClick={handleRunFullScan} className={cx(qsModal.primaryBtn, "w-full")}>
                            Run full scan now
                        </button>

                        <p className="text-center text-xs text-text-tertiary">
                            No credit card required &middot; Cancel any time
                        </p>

                        <button type="button" onClick={close} className={cx(qsModal.secondaryBtn, "w-full")}>
                            Cancel
                        </button>
                    </div>
                )}
            </div>
        </QSModalFrame>
    );
}
