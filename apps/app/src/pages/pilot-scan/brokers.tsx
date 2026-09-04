import { brokerLabel } from "./scan-result";

const BROKER_DESCRIPTIONS: Record<string, string> = {
    fps: "People-search listing with legal name, address history, and phone numbers.",
    npd: "Public records aggregator carrying SSN, date of birth, and legal records.",
    anywho: "Reverse phone/address lookup with legal name and known relatives.",
    zaba: "People-search listing with address, phone, and relative history.",
};

/**
 * Brokers slide — which people-search sites had a listing for this pick,
 * and which field types each one exposed (see full-profile-scan's
 * broker_fields, derived server-side from that broker's own raw scrape —
 * same card style as the Breaches page).
 */
export function BrokersBody({
    brokers,
    brokerFields,
}: {
    brokers: string[];
    brokerFields: Record<string, string[]>;
}) {
    const unique = Array.from(new Set(brokers));

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Brokers
            </h1>
            <p className="mt-1.5 text-sm text-text-secondary">
                {unique.length} data broker{unique.length === 1 ? "" : "s"} had a listing for you
            </p>

            <div className="mt-6">
                {unique.length === 0 ? (
                    <div className="rounded-2xl bg-bg-surface-secondary p-4 sm:p-5">
                        <p className="text-sm text-text-secondary">
                            No broker sources recorded for this scan.
                        </p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2.5">
                        {unique.map((code) => {
                            const fields = brokerFields[code] ?? [];
                            return (
                                <li key={code} className="rounded-2xl bg-bg-surface-secondary p-4 sm:p-5">
                                    <p className="text-[15px] font-semibold text-white">
                                        {brokerLabel(code)}
                                    </p>
                                    {BROKER_DESCRIPTIONS[code] && (
                                        <p className="mt-0.5 text-xs text-text-secondary">
                                            {BROKER_DESCRIPTIONS[code]}
                                        </p>
                                    )}
                                    {fields.length > 0 && (
                                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                                            {fields.map((field) => (
                                                <span
                                                    key={field}
                                                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-text-secondary"
                                                >
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
