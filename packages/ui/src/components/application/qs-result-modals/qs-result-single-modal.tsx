import { useState, useEffect } from "react";
import { cx } from '@/utils/cx';
import { ProfileCard } from "./profile-card";
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
 * White card on dark-blurred backdrop — matches prototype ConfirmModal design.
 * Staggered entrance: modal scales in at 10ms, action buttons slide up at 500ms.
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
        if (isOpen) {
            const timer = setTimeout(() => setShowContent(true), 10);
            const buttonTimer = setTimeout(() => setShowButtons(true), 500);
            return () => {
                clearTimeout(timer);
                clearTimeout(buttonTimer);
            };
        } else {
            setShowContent(false);
            setShowButtons(false);
        }
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
                        id="qs-single-modal-title"
                        className="text-xl font-extrabold text-slate-800 leading-tight mb-2"
                    >
                        We Found A Record For
                        <br />
                        <span className="text-[#00BFFF]">
                            {profile.fullName}
                            {region ? ` in ${region}` : ""}
                        </span>
                    </h2>
                    <p
                        id="qs-single-modal-desc"
                        className="text-sm text-slate-500 font-medium"
                    >
                        Is This Your Profile?
                    </p>
                </div>

                {/* Profile card */}
                <div className="flex-1 overflow-y-auto p-4 bg-white">
                    <ProfileCard profile={profile} />
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
                    <div className="flex gap-3">
                        <button
                            onClick={handleThisIsNotMe}
                            className={cx(
                                "flex-1 py-3.5 rounded-lg font-bold text-lg text-slate-800 shadow-lg",
                                "bg-gray-100 hover:bg-gray-200 active:scale-[0.98]",
                                "transition-all duration-700 ease-in-out transform",
                                showButtons
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-8 pointer-events-none",
                            )}
                        >
                            This Isn&apos;t Me
                        </button>
                        <button
                            onClick={handleThisIsMe}
                            className={cx(
                                "flex-1 py-3.5 rounded-lg font-bold text-lg text-white shadow-lg",
                                "bg-[#00BFFF] hover:bg-[#00D4FF] active:scale-[0.98]",
                                "transition-all duration-700 ease-in-out transform",
                                showButtons
                                    ? "opacity-100 translate-y-0"
                                    : "opacity-0 translate-y-8 pointer-events-none",
                            )}
                        >
                            Yes, This Is Me
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
