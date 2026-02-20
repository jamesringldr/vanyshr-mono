import type { HTMLAttributes } from "react";
import { cx } from '@/utils/cx';
import type { QSProfileSummary } from "./types";

export interface ProfileCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    profile: QSProfileSummary;
}

/**
 * Profile summary card — name, age, aliases, phones, relatives, address.
 * Light card style (bg-gray-50) designed to sit inside the white modal containers.
 * 2-column data grid matching the prototype ConfirmModal/Modal layout.
 */
export function ProfileCard({ profile, className, ...props }: ProfileCardProps) {
    const { fullName, age, aliases, phones, relatives, currentAddress } = profile;
    const addressLine = currentAddress?.length ? currentAddress.join(", ") : undefined;

    const hasLeft = !!(phones?.length || addressLine);
    const hasRight = !!(relatives?.length);

    return (
        <div
            role="region"
            aria-label={`Profile: ${fullName}`}
            className={cx(
                "rounded-lg p-5 bg-gray-50 border-2 border-[#00BFFF]/20",
                className,
            )}
            {...props}
        >
            {/* Name */}
            <h3 className="text-lg font-bold text-slate-800 mb-1">
                {fullName}
            </h3>

            {/* Age */}
            {age != null && (
                <p className="text-sm text-slate-500 mb-2">Age: {age}</p>
            )}

            {/* Aliases row */}
            {aliases?.length ? (
                <div className="py-[5px] mb-1">
                    <div className="flex items-center gap-2">
                        <span
                            className="font-bold text-slate-700 uppercase tracking-wide flex-shrink-0"
                            style={{ fontSize: "0.675rem" }}
                        >
                            Aliases
                        </span>
                        <div
                            className="text-slate-600 font-medium flex-1 flex flex-wrap gap-x-2"
                            style={{ fontSize: "0.675rem" }}
                        >
                            {aliases.slice(0, 2).map((alias, idx) => (
                                <span key={idx} className="truncate">{alias}</span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {/* 2-column data grid */}
            {(hasLeft || hasRight) && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm mt-1">
                    {/* Left column: phones, address */}
                    <div className="space-y-3">
                        {phones?.length ? (
                            <div>
                                <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">
                                    Phones
                                </span>
                                {phones.slice(0, 2).map((phone, idx) => (
                                    <span key={idx} className="block text-slate-600 font-medium">
                                        {phone}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {addressLine ? (
                            <div>
                                <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">
                                    Current Address
                                </span>
                                <div className="text-slate-600 font-medium leading-snug">
                                    {addressLine}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Right column: relatives */}
                    <div className="space-y-3">
                        {relatives?.length ? (
                            <div>
                                <span className="block font-bold text-slate-700 text-xs uppercase tracking-wide">
                                    Relatives
                                </span>
                                <div className="text-slate-600 font-medium leading-snug">
                                    {relatives.slice(0, 3).map((rel, idx) => (
                                        <span key={idx} className="block truncate">{rel}</span>
                                    ))}
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </div>
    );
}
