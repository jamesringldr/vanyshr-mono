import type { HTMLAttributes } from "react";
import { cx } from "@/utils/cx";
import type { QSProfileSummary } from "./types";

export interface ProfileCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
    profile: QSProfileSummary;
}

/**
 * Profile summary card — name, age, aliases, phones, relatives, address.
 * Dark card for the navy QuickScan result modals.
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
            className={cx("rounded-lg border border-[#2A4A68] bg-[#022136] p-5", className)}
            {...props}
        >
            <h3 className="mb-1 text-lg font-bold text-white">{fullName}</h3>

            {age != null && <p className="mb-2 text-sm text-[#7A92A8]">Age: {age}</p>}

            {aliases?.length ? (
                <div className="mb-1 py-[5px]">
                    <div className="flex items-center gap-2">
                        <span className="flex-shrink-0 text-[0.675rem] font-bold uppercase tracking-wide text-[#7A92A8]">
                            Aliases
                        </span>
                        <div className="flex flex-1 flex-wrap gap-x-2 text-[0.675rem] font-medium text-[#B8C4CC]">
                            {aliases.slice(0, 2).map((alias, idx) => (
                                <span key={idx} className="truncate">
                                    {alias}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>
            ) : null}

            {(hasLeft || hasRight) && (
                <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <div className="space-y-3">
                        {phones?.length ? (
                            <div>
                                <span className="block text-xs font-bold uppercase tracking-wide text-[#7A92A8]">
                                    Phones
                                </span>
                                {phones.slice(0, 2).map((phone, idx) => (
                                    <span key={idx} className="block font-medium text-[#B8C4CC]">
                                        {phone}
                                    </span>
                                ))}
                            </div>
                        ) : null}

                        {addressLine ? (
                            <div>
                                <span className="block text-xs font-bold uppercase tracking-wide text-[#7A92A8]">
                                    Current Address
                                </span>
                                <div className="font-medium leading-snug text-[#B8C4CC]">{addressLine}</div>
                            </div>
                        ) : null}
                    </div>

                    <div className="space-y-3">
                        {relatives?.length ? (
                            <div>
                                <span className="block text-xs font-bold uppercase tracking-wide text-[#7A92A8]">
                                    Relatives
                                </span>
                                <div className="font-medium leading-snug text-[#B8C4CC]">
                                    {relatives.slice(0, 3).map((rel, idx) => (
                                        <span key={idx} className="block truncate">
                                            {rel}
                                        </span>
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
