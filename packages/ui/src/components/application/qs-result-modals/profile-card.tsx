import type { HTMLAttributes } from "react";
import { cx } from '@/utils/cx';
import type { QSProfileSummary } from "./types";

export interface ProfileCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    profile: QSProfileSummary;
}

/**
 * Profile summary card — name, age, aliases, phones, relatives, address.
 * Vanyshr tokens; labels vs values hierarchy; Roboto Mono for data/numbers per Design System.
 */
export function ProfileCard({ profile, className, ...props }: ProfileCardProps) {
    const { fullName, age, aliases, phones, relatives, currentAddress } = profile;
    const addressLine = currentAddress?.length ? currentAddress.join(", ") : undefined;

    return (
        <div
            role="region"
            aria-label={`Profile: ${fullName}`}
            className={cx(
                "rounded-xl border p-4 transition-colors",
                "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                className,
            )}
            {...props}
        >
            <p className="font-semibold text-[var(--text-primary)] dark:text-white text-base leading-tight">
                {fullName}
            </p>
            {age != null && (
                <div className="mt-2">
                    <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                        Age
                    </p>
                    <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--text-primary)] dark:text-white">
                        {age}
                    </p>
                </div>
            )}
            <div className="mt-2 space-y-2">
                {aliases?.length ? (
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                            Aliases
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-primary)] dark:text-white leading-snug">
                            {aliases.join(", ")}
                        </p>
                    </div>
                ) : null}
                {phones?.length ? (
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                            Phones
                        </p>
                        <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--text-primary)] dark:text-white leading-snug">
                            {phones.join(", ")}
                        </p>
                    </div>
                ) : null}
                {relatives?.length ? (
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                            Relatives
                        </p>
                        <p className="mt-0.5 text-xs text-[var(--text-primary)] dark:text-white leading-snug">
                            {relatives.join(", ")}
                        </p>
                    </div>
                ) : null}
                {addressLine ? (
                    <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                            Current address
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-[var(--text-primary)] dark:text-white leading-snug">
                            {addressLine}
                        </p>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
