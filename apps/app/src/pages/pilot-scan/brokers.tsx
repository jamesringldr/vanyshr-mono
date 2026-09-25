import { useMemo } from "react";
import { useNavigate } from "react-router";
import { brokerLabel } from "./scan-result";
import { FieldChips } from "./field-chips";
import { cx } from "@/utils/cx";

const BROKER_DESCRIPTIONS: Record<string, string> = {
    fps: "People-search listing with legal name, address history, and phone numbers.",
    npd: "Public records aggregator carrying SSN, date of birth, and legal records.",
    anywho: "Reverse phone/address lookup with legal name and known relatives.",
    zaba: "People-search listing with address, phone, and relative history.",
};

const VISIBLE_COUNT = 2;
const LOCKED_COUNT_KEY = "selfScanLockedBrokerCount";

function lockedSourceCount(): number {
    if (typeof sessionStorage === "undefined") return 18;
    const stored = sessionStorage.getItem(LOCKED_COUNT_KEY);
    if (stored) {
        const n = Number(stored);
        if (n >= 14 && n <= 26) return n;
    }
    const n = 14 + Math.floor(Math.random() * 13);
    sessionStorage.setItem(LOCKED_COUNT_KEY, String(n));
    return n;
}

function sortBrokers(codes: string[]): string[] {
    const unique = Array.from(new Set(codes));
    return unique.sort((a, b) => {
        if (a === "anywho") return -1;
        if (b === "anywho") return 1;
        return 0;
    });
}

function BrokerCard({ code, fields }: { code: string; fields: string[] }) {
    return (
        <div className="rounded-xl border border-border-subtle px-4 py-3.5">
            <p className="text-[15px] font-semibold text-text-primary">{brokerLabel(code)}</p>
            {BROKER_DESCRIPTIONS[code] ? (
                <p className="mt-0.5 text-[13px] leading-snug text-text-secondary">{BROKER_DESCRIPTIONS[code]}</p>
            ) : null}
            <FieldChips fields={fields} />
        </div>
    );
}

/**
 * Brokers slide — which people-search sites had a listing for this pick,
 * and which field types each one exposed (see full-profile-scan's
 * broker_fields, derived server-side from that broker's own raw scrape —
 * same card style as the Breaches page).
 */
export function BrokersBody({
    brokers,
    brokerFields,
    gated = false,
}: {
    brokers: string[];
    brokerFields: Record<string, string[]>;
    /** Self-scan: show AnyWho first, lock cards past the first two. */
    gated?: boolean;
}) {
    const navigate = useNavigate();
    const ordered = useMemo(() => sortBrokers(brokers), [brokers]);
    const extraCount = useMemo(() => lockedSourceCount(), []);
    const visible = gated ? ordered.slice(0, VISIBLE_COUNT) : ordered;
    const locked = gated ? ordered.slice(VISIBLE_COUNT) : [];

    return (
        <div>
            <h1 className="sr-only">Brokers</h1>
            <p className="text-[15px] leading-relaxed text-text-secondary">
                Sources where we found your exposure data and private details...
            </p>
            <p className="mt-1.5 text-[13px] text-text-tertiary">
                {ordered.length} source{ordered.length === 1 ? "" : "s"} had a listing for you
            </p>

            <div className="mt-5">
                {ordered.length === 0 ? (
                    <div className="rounded-xl border border-border-subtle px-4 py-4">
                        <p className="text-[15px] text-text-secondary">No broker sources recorded for this scan.</p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {visible.map((code) => (
                            <li key={code}>
                                <BrokerCard code={code} fields={brokerFields[code] ?? []} />
                            </li>
                        ))}
                        {locked.length > 0 ? (
                            <li className="relative min-h-[220px] overflow-hidden rounded-xl">
                                <div className="pointer-events-none select-none space-y-2 blur-[7px]" aria-hidden>
                                    {locked.map((code) => (
                                        <BrokerCard key={code} code={code} fields={brokerFields[code] ?? []} />
                                    ))}
                                </div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-page/55 px-5 text-center">
                                    <p className="text-[18px] font-semibold leading-snug tracking-tight text-warning">
                                        {extraCount} more sources exposing your data
                                    </p>
                                    <p className="mt-2 max-w-sm text-[14px] leading-snug text-text-secondary">
                                        Create an account to see all sources exposing your data
                                    </p>
                                    <button
                                        type="button"
                                        onClick={() => navigate("/signup")}
                                        className={cx(
                                            "mt-4 inline-flex min-h-12 w-full max-w-sm items-center justify-center rounded-lg bg-accent-primary px-5 text-[15px] font-semibold text-white",
                                            "transition-colors duration-150 hover:bg-accent-hover",
                                        )}
                                    >
                                        Create a Free Account
                                    </button>
                                </div>
                            </li>
                        ) : gated ? (
                            <li className="rounded-xl border border-border-subtle px-5 py-6 text-center">
                                <p className="text-[18px] font-semibold leading-snug tracking-tight text-warning">
                                    {extraCount} more sources exposing your data
                                </p>
                                <p className="mt-2 text-[14px] leading-snug text-text-secondary">
                                    Create an account to see all sources exposing your data
                                </p>
                                <button
                                    type="button"
                                    onClick={() => navigate("/signup")}
                                    className={cx(
                                        "mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-lg bg-accent-primary px-5 text-[15px] font-semibold text-white",
                                        "transition-colors duration-150 hover:bg-accent-hover",
                                    )}
                                >
                                    Create a Free Account
                                </button>
                            </li>
                        ) : null}
                    </ul>
                )}
            </div>
        </div>
    );
}
