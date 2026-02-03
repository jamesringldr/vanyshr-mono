import { StatusBadge, type BadgeStatus } from "./StatusBadge";
import { cx } from '@/utils/cx';

interface OnboardingDataCardProps {
    /** Optional - omit for list items (e.g. phone/alias/address/email cards) */
    label?: string;
    value?: string;
    status: BadgeStatus;
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
    value,
    status,
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
    return (
        <div
            role="button"
            tabIndex={0}
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onClick?.();
                }
            }}
            className={cx(
                "rounded-xl border p-4 outline-none transition-colors cursor-pointer",
                "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
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
                    <StatusBadge status={status} />
                </div>
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
                                "relative h-6 w-11 shrink-0 rounded-full outline-none transition",
                                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2",
                                toggleValue
                                    ? "bg-[#14ABFE] dark:bg-[#14ABFE]"
                                    : "bg-[var(--border-subtle)] dark:bg-[#2A4A68]",
                            )}
                        >
                            <span
                                className={cx(
                                    "absolute top-1 rounded-full bg-white shadow transition-transform",
                                    "h-5 w-5 left-0.5",
                                    toggleValue && "translate-x-5",
                                )}
                            />
                        </button>
                    </div>
                )}
            </div>

            {/* Row 2: Value (always visible so data is on the card) */}
            {value !== undefined && !isExpanded && (
                <p className="mt-3 text-lg font-bold tracking-tight text-[#022136] dark:text-white">
                    {value}
                </p>
            )}

            {/* Expanded: edit form + Update (saves this field) */}
            {isExpanded && (
                <>
                    {editContent ? (
                        <div className="mt-4 space-y-4" onClick={(e) => e.stopPropagation()}>
                            {editContent}
                        </div>
                    ) : (
                        value !== undefined && (
                            <p className="mt-4 text-center text-2xl font-bold tracking-tight text-[#022136] dark:text-white sm:text-3xl">
                                {value}
                            </p>
                        )
                    )}
                    <div className={cx("mt-4 flex gap-3", showDelete ? "" : "")}>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onConfirmAndContinue?.();
                            }}
                            className={cx(
                                "flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold text-white outline-none transition",
                                "bg-[#14ABFE] hover:bg-[#0E9AE8]",
                                "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                            )}
                        >
                            Update
                        </button>
                        {showDelete && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDelete?.();
                                }}
                                className={cx(
                                    "flex flex-1 items-center justify-center rounded-xl py-3 text-sm font-semibold outline-none transition",
                                    "border border-[#FF5757] text-[#FF5757] dark:border-[#FF5757] dark:text-[#FF5757]",
                                    "hover:bg-[#FF5757]/10 dark:hover:bg-[#FF5757]/10",
                                    "focus-visible:ring-2 focus-visible:ring-[#FF5757] focus-visible:ring-offset-2",
                                )}
                            >
                                Delete
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
