import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/utils/cx";

/**
 * Shared chrome for the QuickScan result modals. Tokens match the
 * email-confirmation modal on the loading screen so all overlays in
 * this flow read as one family.
 */
export const qsModal = {
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
    panel: cx(
        "relative flex w-full max-w-md flex-col overflow-hidden font-ubuntu",
        "max-h-[85vh] rounded-2xl bg-bg-page shadow-xl",
        "transform transition-all duration-300 ease-out",
    ),
    header: "relative flex-shrink-0 border-b border-border-subtle px-6 py-5 pr-12",
    title: "text-xl font-bold leading-tight text-white",
    subtitle: "mt-1 text-sm text-text-tertiary",
    accent: "text-accent-primary",
    body: "flex-1 overflow-y-auto px-6 py-4",
    footer: "flex flex-shrink-0 gap-3 border-t border-border-subtle px-6 py-4",
    close: "absolute top-4 right-4 z-10 text-text-tertiary transition-colors hover:text-white",
    card: "rounded-lg bg-bg-surface px-4 py-3",
    muted: "text-sm text-text-tertiary",
    bodyText: "text-sm text-text-secondary",
    input: cx(
        "h-[52px] w-full rounded-lg border px-4 py-3 text-sm",
        "border-border-subtle bg-bg-page text-white placeholder:text-text-tertiary",
        "outline-none transition focus:ring-2 focus:ring-accent-primary",
    ),
    primaryBtn: cx(
        "rounded-lg bg-accent-primary py-2.5 font-semibold text-white",
        "transition hover:bg-accent-hover active:scale-[0.98]",
    ),
    secondaryBtn: cx(
        "rounded-lg bg-bg-surface py-2.5 font-semibold text-white",
        "transition hover:bg-bg-surface-secondary active:scale-[0.98]",
    ),
    option: "flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm text-white transition",
    optionOn: "bg-accent-primary/20 ring-1 ring-accent-primary",
    optionOff: "bg-bg-page hover:bg-bg-surface",
} as const;

export function QSModalFrame({
    showContent,
    onClose,
    closeDisabled,
    children,
}: {
    showContent: boolean;
    onClose?: () => void;
    closeDisabled?: boolean;
    children: ReactNode;
}) {
    return (
        <div className={qsModal.overlay}>
            <div
                className={cx(
                    qsModal.panel,
                    showContent ? "scale-100 opacity-100" : "scale-95 opacity-0",
                )}
            >
                {onClose && !closeDisabled ? (
                    <button type="button" onClick={onClose} className={qsModal.close} aria-label="Close">
                        <X className="h-5 w-5" strokeWidth={2} />
                    </button>
                ) : null}
                {children}
            </div>
        </div>
    );
}
