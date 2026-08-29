import { StatusBadge, type BadgeStatus } from "./StatusBadge";
import { cx } from '@/utils/cx';
import { Trash2 } from "lucide-react";

interface OnboardingDataCardProps {
    /** Optional - omit for list items (e.g. phone/alias/address/email cards) */
    label?: string;
    /** Optional explainer text shown beneath the label */
    description?: string;
    value?: string;
    /** Override the displayed value in the closed state (e.g. formatted date) */
    displayValue?: string;
    status: BadgeStatus;
    /** Hide the status badge entirely (e.g. for Legal Name) */
    hideStatus?: boolean;
    isExpanded: boolean;
    isEditing?: boolean;
    editContent?: React.ReactNode;
    onEdit?: () => void;
    onConfirmAndContinue?: () => void;
    onClick?: () => void;
    /** List cards: toggle e.g. "Primary Mobile", "Current Address", "Primary" */
    toggleLabel?: string;
    toggleValue?: boolean;
    onToggleChange?: (value: boolean) => void;
    showDelete?: boolean;
    onDelete?: () => void;
}

export function OnboardingDataCard({
    label,
    description,
    value,
    displayValue,
    status,
    hideStatus = false,
    isExpanded,
    isEditing: _isEditing = false,
    editContent,
    onEdit: _onEdit,
    onConfirmAndContinue,
    onClick,
    toggleLabel,
    toggleValue = false,
    onToggleChange,
    showDelete = false,
    onDelete,
}: OnboardingDataCardProps) {
    const shownValue = displayValue ?? value;

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return;
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.();
                }
            }}
            className={cx(
                "rounded-xl border p-4 outline-none transition-colors cursor-pointer",
                "bg-[var(--bg-surface)] dark:bg-[#112538]",
                "border-[var(--border-subtle)] dark:border-[#1E3A52]",
                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1B2B]",
            )}
            aria-expanded={isExpanded}
        >
            {/* Row 1: Label (optional) + Status + optional Toggle */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                    {label != null && label !== "" && (
                        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] dark:text-[#7A92A8]">
                            {label}
                        </span>
                    )}
                    {!hideStatus && <StatusBadge status={status} />}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                    {toggleLabel != null && (
                        <div
                            className="flex shrink-0 items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <span className="text-xs text-[var(--text-muted)] dark:text-[#7A92A8]">
                                {toggleLabel}
                            </span>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={toggleValue}
                                aria-label={`${toggleLabel} ${toggleValue ? "on" : "off"}`}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleChange?.(!toggleValue);
                                }}
                                className={cx(
                                    "relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors duration-200 overflow-hidden",
                                    "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2",
                                    toggleValue
                                        ? "bg-[#14ABFE]"
                                        : "bg-[var(--border-subtle)] dark:bg-[#1E3A52]",
                                )}
                            >
                                <span
                                    className={cx(
                                        "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
                                        toggleValue && "translate-x-5",
                                    )}
                                />
                            </button>
                        </div>
                    )}
                    {showDelete && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.();
                            }}
                            className={cx(
                                "flex h-8 w-8 items-center justify-center rounded-full outline-none transition",
                                "text-[#FF5757]/80 hover:bg-[#FF5757]/10 hover:text-[#FF5757]",
                                "focus-visible:ring-2 focus-visible:ring-[#FF5757] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1B2B]",
                            )}
                            title="Delete"
                            aria-label="Delete"
                        >
                            <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                    )}
                </div>
            </div>

            {/* Description: explainer beneath the label */}
            {description && (
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--text-muted)] dark:text-[#7A92A8]">
                    {description}
                </p>
            )}

            {/* Row 2: Value (always visible so data is on the card) */}
            {shownValue !== undefined && !isExpanded && (
                <p className="mt-3 text-lg font-bold tracking-tight text-[#0B1B2B] dark:text-white">
                    {shownValue}
                </p>
            )}

            {/* Expanded: edit form + Save (saves this field) */}
            {isExpanded && (
                <>
                    {editContent ? (
                        <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                            {editContent}
                        </div>
                    ) : (
                        shownValue !== undefined && (
                            <p className="mt-4 text-center text-2xl font-bold tracking-tight text-[#0B1B2B] dark:text-white sm:text-3xl">
                                {shownValue}
                            </p>
                        )
                    )}
                    <div className="mt-4 flex gap-3">
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirmAndContinue?.();
                            }}
                            className={cx(
                                "flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold text-white outline-none transition",
                                "bg-[#14ABFE] hover:bg-[#0E9AE8]",
                                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#0B1B2B]",
                            )}
                        >
                            Save
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
