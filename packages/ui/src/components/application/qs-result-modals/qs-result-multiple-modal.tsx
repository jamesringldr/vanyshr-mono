import { useState, useEffect } from "react";
import { cx } from "@/utils/cx";
import { ProfileCard } from "./profile-card";
import { QSModalFrame, qsModal } from "./qs-modal";
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
 * Navy overlay matching the rest of the loading-flow modals.
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
        if (!isOpen) {
            setShowContent(false);
            setShowNoneButton(false);
            setSelectedProfileId(null);
            return;
        }
        const timer = setTimeout(() => setShowContent(true), 10);
        const buttonTimer = setTimeout(() => setShowNoneButton(true), 2000);
        return () => {
            clearTimeout(timer);
            clearTimeout(buttonTimer);
        };
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
        <QSModalFrame showContent={showContent} onClose={close}>
            <div className={qsModal.header}>
                <h2 id="qs-multiple-modal-title" className={qsModal.title}>
                    We found multiple records for{" "}
                    <span className={qsModal.accent}>
                        {searchName}
                        {region ? ` in ${region}` : ""}
                    </span>
                </h2>
                <p id="qs-multiple-modal-desc" className={qsModal.subtitle}>
                    Select the record with your data
                </p>
            </div>

            <div className={cx(qsModal.body, "space-y-3")}>
                {profiles.map((profile) => {
                    const selected = selectedProfileId === profile.id;
                    return (
                        <div
                            key={profile.id}
                            onClick={() => handleSelect(profile)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => e.key === "Enter" && handleSelect(profile)}
                            aria-label={`Select profile: ${profile.fullName}`}
                            className={cx(
                                "cursor-pointer rounded-lg transition",
                                selected
                                    ? "ring-1 ring-[#14ABFE]"
                                    : "hover:ring-1 hover:ring-[#14ABFE]/50",
                            )}
                        >
                            <ProfileCard
                                profile={profile}
                                className={selected ? "border-[#14ABFE] bg-[#0B3B52]" : undefined}
                            />
                        </div>
                    );
                })}
            </div>

            <div className={qsModal.footer}>
                <button
                    type="button"
                    onClick={handleNoneOfThese}
                    className={cx(
                        qsModal.secondaryBtn,
                        "w-full",
                        "duration-700 ease-in-out",
                        showNoneButton
                            ? "translate-y-0 opacity-100"
                            : "pointer-events-none translate-y-8 opacity-0",
                    )}
                >
                    None of these are me
                </button>
            </div>
        </QSModalFrame>
    );
}
