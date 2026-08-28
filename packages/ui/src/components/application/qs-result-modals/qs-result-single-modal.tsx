import { useState, useEffect } from "react";
import { cx } from "@/utils/cx";
import { ProfileCard } from "./profile-card";
import { QSModalFrame, qsModal } from "./qs-modal";
import type { QSProfileSummary } from "./types";

export interface QSResultSingleModalProps {
    /** Whether the modal is open (controlled). */
    isOpen: boolean;
    /** Called when the modal should close (e.g. overlay, close button, or after action). */
    onOpenChange: (open: boolean) => void;
    /** Single profile found — summary data for "Is this your profile?". */
    profile: QSProfileSummary;
    /** Optional region/location text, e.g. "in MO". */
    region?: string;
    /** Called when user confirms "Yes, This Is Me". Send full profile URL to edge from here. */
    onThisIsMe: (profile: QSProfileSummary) => void;
    /** Called when user selects "This Isn't Me". */
    onThisIsNotMe: () => void;
}

/**
 * Single-user-found Quick Scan result modal.
 * Navy overlay matching the rest of the loading-flow modals.
 * Staggered entrance: panel scales in at 10ms, action buttons slide up at 500ms.
 */
export function QSResultSingleModal({
    isOpen,
    onOpenChange,
    profile,
    region = "",
    onThisIsMe,
    onThisIsNotMe,
}: QSResultSingleModalProps) {
    const [showContent, setShowContent] = useState(false);
    const [showButtons, setShowButtons] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setShowContent(false);
            setShowButtons(false);
            return;
        }
        const timer = setTimeout(() => setShowContent(true), 10);
        const buttonTimer = setTimeout(() => setShowButtons(true), 500);
        return () => {
            clearTimeout(timer);
            clearTimeout(buttonTimer);
        };
    }, [isOpen]);

    const close = () => onOpenChange(false);

    const handleThisIsMe = () => {
        onThisIsMe(profile);
        close();
    };

    const handleThisIsNotMe = () => {
        onThisIsNotMe();
        close();
    };

    if (!isOpen) return null;

    return (
        <QSModalFrame showContent={showContent} onClose={close}>
            <div className={qsModal.header}>
                <h2 id="qs-single-modal-title" className={qsModal.title}>
                    We found a record for{" "}
                    <span className={qsModal.accent}>
                        {profile.fullName}
                        {region ? ` in ${region}` : ""}
                    </span>
                </h2>
                <p id="qs-single-modal-desc" className={qsModal.subtitle}>
                    Is this your profile?
                </p>
            </div>

            <div className={qsModal.body}>
                <ProfileCard profile={profile} />
            </div>

            <div className={qsModal.footer}>
                <button
                    type="button"
                    onClick={handleThisIsNotMe}
                    className={cx(
                        qsModal.secondaryBtn,
                        "flex-1",
                        "duration-700 ease-in-out",
                        showButtons ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0",
                    )}
                >
                    This isn&apos;t me
                </button>
                <button
                    type="button"
                    onClick={handleThisIsMe}
                    className={cx(
                        qsModal.primaryBtn,
                        "flex-1",
                        "duration-700 ease-in-out",
                        showButtons ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-8 opacity-0",
                    )}
                >
                    Yes, this is me
                </button>
            </div>
        </QSModalFrame>
    );
}
