import { Button } from "@/components/base/buttons/button";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
import { cx } from '@/utils/cx';
import { ProfileCard } from "./profile-card";
import type { QSProfileSummary } from "./types";

export interface QSResultMultipleModalProps {
    /** Whether the modal is open (controlled). */
    isOpen: boolean;
    /** Called when the modal should close. */
    onOpenChange: (open: boolean) => void;
    /** Search name shown in header (e.g. "lucas Clark"). */
    searchName: string;
    /** Optional region/state, e.g. "MO". */
    region?: string;
    /** List of potential profiles for the user to select. */
    profiles: QSProfileSummary[];
    /** Called when user selects a profile (e.g. to send full profile URL to edge). */
    onProfileSelect: (profile: QSProfileSummary) => void;
    /** Called when user selects "None of These Are Me". */
    onNoneOfThese: () => void;
}

/**
 * Multiple-users-found Quick Scan result modal.
 * "Select the Record with Your Data" — scrollable list of profile cards; user picks one or "None of These Are Me".
 * Untitled UI structure, Vanyshr Design System tokens (rounded-xl, bg-surface, border-subtle, dark variants).
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
    const close = () => onOpenChange(false);

    const handleSelect = (profile: QSProfileSummary) => {
        onProfileSelect(profile);
        close();
    };

    const handleNoneOfThese = () => {
        onNoneOfThese();
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
                    aria-labelledby="qs-multiple-modal-title"
                    aria-describedby="qs-multiple-modal-desc"
                >
                    <div
                        role="document"
                        className={cx(
                            "flex max-h-[85dvh] flex-col overflow-hidden rounded-xl border shadow-lg transition-colors",
                            "bg-[var(--bg-surface)] dark:bg-[#2A2A3F]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        {/* Header */}
                        <div className="shrink-0 px-6 pt-6 pb-3 text-center">
                            <h2
                                id="qs-multiple-modal-title"
                                className="text-base font-bold text-[var(--text-primary)] dark:text-white"
                            >
                                We found multiple records for
                                <br />
                                <span className="font-bold text-[#00BFFF] dark:text-[#00BFFF]">
                                    {searchName}
                                    {region ? ` in ${region}` : ""}
                                </span>
                                .
                            </h2>
                            <p
                                id="qs-multiple-modal-desc"
                                className="mt-3 text-sm text-[var(--text-secondary)] dark:text-[#B8C4CC]"
                            >
                                Select the Record with Your Data
                            </p>
                        </div>

                        {/* Scrollable profile list */}
                        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-3">
                            <ul className="flex flex-col gap-3" role="list">
                                {profiles.map((profile) => (
                                    <li key={profile.id}>
                                        <button
                                            type="button"
                                            onClick={() => handleSelect(profile)}
                                            className={cx(
                                                "w-full cursor-pointer rounded-xl border p-0 text-left transition-colors",
                                                "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                                                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                                "hover:bg-[#E4EAEF]/70 dark:hover:bg-[#022136]/70",
                                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2",
                                            )}
                                            aria-label={`Select profile: ${profile.fullName}`}
                                        >
                                            <ProfileCard profile={profile} className="border-0" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 px-6 pb-6 pt-4">
                            <Button
                                type="button"
                                size="lg"
                                color="primary"
                                className="h-[52px] w-full rounded-xl bg-[#00BFFF] font-semibold text-white hover:bg-[#0E9AE8] dark:bg-[#00BFFF] dark:hover:bg-[#0E9AE8]"
                                onClick={handleNoneOfThese}
                            >
                                None of These Are Me
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
