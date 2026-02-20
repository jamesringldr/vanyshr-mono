import { Button } from "@/components/base/buttons/button";
import { ModalOverlay, Modal, Dialog } from "@/components/application/modals/modal";
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
 * "We Found A Record For **Name** in {region}". User confirms or denies; on confirm, send full profile URL to edge.
 * Untitled UI structure, Vanyshr Design System tokens (rounded-xl, bg-surface, border-subtle, dark variants).
 */
export function QSResultSingleModal({
    isOpen,
    onOpenChange,
    profile,
    region = "",
    onThisIsMe,
    onThisIsNotMe,
}: QSResultSingleModalProps) {
    const close = () => onOpenChange(false);

    const handleThisIsMe = () => {
        onThisIsMe(profile);
        close();
    };

    const handleThisIsNotMe = () => {
        onThisIsNotMe();
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
                    aria-labelledby="qs-single-modal-title"
                    aria-describedby="qs-single-modal-desc"
                >
                    <div
                        role="document"
                        className={cx(
                            "rounded-xl border shadow-lg transition-colors",
                            "bg-[var(--bg-surface)] dark:bg-[#2A2A3F]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                            "flex flex-col overflow-hidden",
                        )}
                    >
                        {/* Header */}
                        <div className="flex flex-col items-center px-6 pt-6 pb-4 text-center">
                            <h2
                                id="qs-single-modal-title"
                                className="text-base font-bold text-[var(--text-primary)] dark:text-white"
                            >
                                We Found A Record For
                                <br />
                                <span className="font-bold text-[#00BFFF] dark:text-[#00BFFF]">
                                    {profile.fullName}
                                    {region ? ` in ${region}` : ""}
                                </span>
                                .
                            </h2>
                            <h1
                                id="qs-single-modal-desc"
                                className="mt-4 text-xl font-semibold text-[var(--text-primary)] dark:text-white"
                            >
                                Is This Your Profile?
                            </h1>
                        </div>

                        {/* Profile card */}
                        <div className="px-6 pb-4">
                            <ProfileCard profile={profile} />
                        </div>

                        {/* Footer */}
                        <div className="flex gap-3 px-6 pb-6">
                            <Button
                                type="button"
                                size="lg"
                                color="secondary"
                                className={cx(
                                    "h-[52px] flex-1 rounded-xl font-semibold",
                                    "bg-[#F0F4F8] text-[var(--text-primary)] dark:bg-[#022136]/50 dark:text-white",
                                    "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                                    "hover:bg-[#E4EAEF] dark:hover:bg-[#2A2A3F]",
                                )}
                                onClick={handleThisIsNotMe}
                            >
                                Not Me
                            </Button>
                            <Button
                                type="button"
                                size="lg"
                                color="primary"
                                className="h-[52px] flex-1 rounded-xl bg-[#00BFFF] font-semibold text-white hover:bg-[#0E9AE8] dark:bg-[#00BFFF] dark:hover:bg-[#0E9AE8]"
                                onClick={handleThisIsMe}
                            >
                                This is Me
                            </Button>
                        </div>
                    </div>
                </Dialog>
            </Modal>
        </ModalOverlay>
    );
}
