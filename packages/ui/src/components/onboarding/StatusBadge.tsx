import { cx } from '@/utils/cx';

export type BadgeStatus = "confirmed" | "pending" | "new" | "action_required";

interface StatusBadgeProps {
    status: BadgeStatus;
    className?: string;
}

const STATUS_CONFIG: Record<
    BadgeStatus,
    { label: string; bgClass: string; textClass: string }
> = {
    confirmed: {
        label: "CONFIRMED",
        bgClass: "bg-[#00D4AA]/10 dark:bg-[#00D4AA]/20",
        textClass: "text-[#00D4AA] dark:text-[#00D4AA]",
    },
    pending: {
        label: "PENDING",
        bgClass: "bg-amber-400/20 dark:bg-amber-400/20",
        textClass: "text-amber-600 dark:text-amber-400",
    },
    new: {
        label: "NEW",
        bgClass: "bg-[var(--text-secondary)]/20 dark:bg-[#A8BFD4]/20",
        textClass: "text-[var(--text-secondary)] dark:text-[#A8BFD4]",
    },
    action_required: {
        label: "ACTION REQUIRED",
        bgClass: "bg-[#FF5757]/10 dark:bg-[#FF5757]/20",
        textClass: "text-[#FF5757] dark:text-[#FF5757]",
    },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const config = STATUS_CONFIG[status];
    return (
        <span
            className={cx(
                "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold uppercase tracking-wide",
                config.bgClass,
                config.textClass,
                className,
            )}
            role="status"
        >
            {config.label}
        </span>
    );
}
