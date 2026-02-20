import { useState, useEffect } from "react";
import { cx } from '@/utils/cx';
import { ProfileCard } from "./profile-card";
import type { QSProfileSummary } from "./types";

export interface QSResultMultipleModalProps {
    /** Whether the modal is open (controlled). */
    isOpen: boolean;
    /** Called when the modal should close. */
    onOpenChange: (open: boolean) => void;
    /** Search name shown in header (e.g. "Lucas Clark"). */
    searchName: string;
    /** Optional region/state, e.g. "MO". */
    region?: string;
    /** List of potential profiles for the user to select. */
    profiles: QSProfileSummary[];
    /** Called when user selects a profile. */
    onProfileSelect: (profile: QSProfileSummary) => void;
    /** Called when user selects "None of These Are Me". */
    onNoneOfThese: () => void;
}

/**
 * Multiple-users-found Quick Scan result modal.
 * White card on dark-blurred backdrop — matches prototype Modal design.
 * Profile cards highlight on hover/select with brand azure.
 * "None of These Are Me" button delayed 2s to encourage users to review cards first.
 */
export function QSResultMultipleModal({
    isOpen,
    onOpenChange,
    searchName,
    region = "",
    profiles,
    onProfileSelect,
    onNoneOfThese,
}: QSResultMultipleModalProps) {
    const [showContent, setShowContent] = useState(false);
    const [showNoneButton, setShowNoneButton] = useState(false);
    const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setShowContent(true), 10);
            const buttonTimer = setTimeout(() => setShowNoneButton(true), 2000);
            return () => {
                clearTimeout(timer);
                clearTimeout(buttonTimer);
            };
        } else {
            setShowContent(false);
            setShowNoneButton(false);
            setSelectedProfileId(null);
        }
    }, [isOpen]);

    const close = () => onOpenChange(false);

    const handleSelect = (profile: QSProfileSummary) => {
        setSelectedProfileId(profile.id);
        onProfileSelect(profile);
        close();
    };

    const handleNoneOfThese = () => {
        onNoneOfThese();
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
                <div className="p-6 text-center border-b border-gray-100 flex-shrink-0 relative">
                    <button
                        onClick={close}
                        className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                        aria-label="Close"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <h2
                        id="qs-multiple-modal-title"
                        className="text-xl font-extrabold text-slate-800 leading-tight mb-2"
                    >
                        We Found Multiple Records For
                        <br />
                        <span className="text-[#00BFFF]">
                            {searchName}
                            {region ? ` in ${region}` : ""}
                        </span>
                    </h2>
                    <p
                        id="qs-multiple-modal-desc"
                        className="text-sm text-slate-500 font-medium"
                    >
                        Select the Record with Your Data
                    </p>
                </div>

                {/* Scrollable profile list */}
                <div className="flex-1 overflow-y-auto p-4 bg-white space-y-4">
                    {profiles.map((profile) => (
                        <div
                            key={profile.id}
                            onClick={() => handleSelect(profile)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && handleSelect(profile)}
                            aria-label={`Select profile: ${profile.fullName}`}
                            className={cx(
                                "rounded-lg cursor-pointer transition-all duration-200 group relative",
                                selectedProfileId === profile.id
                                    ? "bg-[#00BFFF]/10 border-2 border-[#00BFFF] shadow-md"
                                    : "bg-gray-50 border-2 border-transparent hover:border-[#00BFFF]/50 hover:shadow-lg hover:bg-white",
                            )}
                        >
                            <ProfileCard
                                profile={profile}
                                className={cx(
                                    "border-0",
                                    selectedProfileId === profile.id
                                        ? "bg-transparent"
                                        : "bg-transparent",
                                )}
                            />
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
                    <button
                        onClick={handleNoneOfThese}
                        className={cx(
                            "w-full py-3.5 rounded-lg font-bold text-lg text-white shadow-lg",
                            "bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98]",
                            "transition-all duration-700 ease-in-out transform",
                            showNoneButton
                                ? "opacity-100 translate-y-0"
                                : "opacity-0 translate-y-8 pointer-events-none",
                        )}
                    >
                        None of These Are Me
                    </button>
                </div>
            </div>
        </div>
    );
}
