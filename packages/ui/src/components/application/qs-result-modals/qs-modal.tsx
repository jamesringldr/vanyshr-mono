import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/utils/cx";

/**
 * Shared chrome for the QuickScan result modals. Tokens match the
 * email-confirmation modal on the loading screen so all overlays in
 * this flow read as one family.
 */
export const qsModal = {
    overlay: "fixed inset-0 z-50 flex items-center justify-center bg-bg-page/80 backdrop-blur-sm p-4",
    panel: cx(
        "relative flex w-full max-w-md flex-col overflow-hidden",
        "max-h-[85vh] rounded-xl border border-border-subtle bg-bg-surface",
        "transform transition-all duration-300",
    ),
    header: "relative flex-shrink-0 border-b border-border-subtle px-5 py-5 pr-12",
    title: "text-[20px] font-semibold leading-tight tracking-tight text-text-primary",
    subtitle: "mt-1.5 text-[15px] leading-relaxed text-text-secondary",
    accent: "whitespace-nowrap text-accent-primary",
    body: "flex-1 overflow-y-auto px-5 py-4",
    footer: "flex flex-shrink-0 gap-3 border-t border-border-subtle px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
    close: cx(
        "absolute top-3 right-3 z-10 flex h-11 w-11 items-center justify-center rounded-lg",
        "text-text-tertiary transition-colors duration-150 hover:bg-bg-surface-secondary hover:text-text-primary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
    ),
    card: "rounded-lg border border-border-subtle px-4 py-3",
    muted: "text-[14px] text-text-tertiary",
    bodyText: "text-[15px] leading-relaxed text-text-secondary",
    input: cx(
        "h-12 w-full rounded-lg border px-4 text-[15px]",
        "border-border-subtle bg-bg-page text-text-primary placeholder:text-text-tertiary",
        "outline-none transition-colors duration-150 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary",
    ),
    primaryBtn: cx(
        "inline-flex min-h-12 items-center justify-center rounded-lg bg-accent-primary px-4",
        "text-[15px] font-semibold text-brand-ink transition-colors duration-150",
        "hover:bg-accent-hover",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
        "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-tertiary",
    ),
    secondaryBtn: cx(
        "inline-flex min-h-12 items-center justify-center rounded-lg border border-border-subtle bg-bg-page px-4",
        "text-[15px] font-semibold text-text-primary transition-colors duration-150",
        "hover:bg-bg-surface-secondary",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
    ),
    option: "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left text-[15px] text-text-primary transition-colors duration-150",
    optionOn: "border-accent-primary",
    optionOff: "border-border-subtle hover:bg-bg-page",
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
