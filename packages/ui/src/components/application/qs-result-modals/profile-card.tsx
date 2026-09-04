import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";
import type { QSProfileSummary } from "./types";

export interface ProfileCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    profile: QSProfileSummary;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">{label}</dt>
            <dd className="mt-1 text-[14px] font-medium leading-snug text-text-primary">{children}</dd>
        </div>
    );
}

/**
 * Profile summary — labeled data rows for the identity-confirm overlays.
 */
export function ProfileCard({ profile, className, ...props }: ProfileCardProps) {
    const { fullName, age, aliases, phones, relatives, currentAddress } = profile;
    const addressLine = currentAddress?.length ? currentAddress.join(", ") : undefined;

    return (
        <div
            role="region"
            aria-label={`Profile: ${fullName}`}
            className={cx("rounded-lg border border-border-subtle px-4 py-4", className)}
            {...props}
        >
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-[18px] font-semibold tracking-tight text-text-primary">{fullName}</h3>
                {age != null ? (
                    <span className="shrink-0 text-[13px] tabular-nums text-text-tertiary">{age}</span>
                ) : null}
            </div>

            {aliases?.length ? (
                <p className="mt-1 text-[13px] text-text-secondary">{aliases.slice(0, 2).join(" · ")}</p>
            ) : null}

            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
                {phones?.length ? (
                    <Field label="Phones">
                        {phones.slice(0, 2).map((phone) => (
                            <span key={phone} className="block tabular-nums">
                                {phone}
                            </span>
                        ))}
                    </Field>
                ) : null}

                {relatives?.length ? (
                    <Field label="Possible relatives">
                        {relatives.slice(0, 3).map((rel) => (
                            <span key={rel} className="block truncate">
                                {rel}
                            </span>
                        ))}
                    </Field>
                ) : null}

                {addressLine ? (
                    <Field label="Last known address">
                        <span className="block">{addressLine}</span>
                    </Field>
                ) : null}
            </dl>
        </div>
    );
}
