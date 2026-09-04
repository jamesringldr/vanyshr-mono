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
    // No longer rendered — subtitle now shows just the name. Kept for API compatibility.
    region: _region = "",
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
                    Is this you?
                </h2>
                <p id="qs-single-modal-desc" className={qsModal.subtitle}>
                    <span className="font-bold">We found a possible match for </span>
                    <span className={cx(qsModal.accent, "font-bold")}>{profile.fullName}</span>
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
                        "transition-[opacity,transform] duration-300",
                        showButtons ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
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
                        "transition-[opacity,transform] duration-300",
                        showButtons ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
                    )}
                >
                    Yes, this is me
                </button>
            </div>
        </QSModalFrame>
    );
}
