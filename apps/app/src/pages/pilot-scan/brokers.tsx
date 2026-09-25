import { useMemo } from "react";
import { Card } from "@vanyshr/ui/components/ui/card/card";
import { Button } from "@vanyshr/ui/components/ui/buttons/button";
import { brokerLabel } from "./scan-result";
import { FieldChips } from "./field-chips";

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
        <Card className="px-4 py-3">
            <p className="text-lg font-semibold text-text-primary">{brokerLabel(code)}</p>
            {BROKER_DESCRIPTIONS[code] ? (
                <p className="text-data leading-snug text-text-secondary">{BROKER_DESCRIPTIONS[code]}</p>
            ) : null}
            <FieldChips fields={fields} />
        </Card>
    );
}

function CreateAccountPrompt({ extraCount }: { extraCount: number }) {
    return (
        <>
            <p className="text-lg font-semibold leading-snug tracking-tight text-status-warn">
                {extraCount} more sources exposing your data
            </p>
            <p className="mt-2 text-md leading-snug text-text-secondary">
                Create an account to see all sources exposing your data
            </p>
            <Button href="/signup" size="xl" className="mt-4 w-full">
                Create a Free Account
            </Button>
        </>
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
    const ordered = useMemo(() => sortBrokers(brokers), [brokers]);
    const extraCount = useMemo(() => lockedSourceCount(), []);
    const visible = gated ? ordered.slice(0, VISIBLE_COUNT) : ordered;
    const locked = gated ? ordered.slice(VISIBLE_COUNT) : [];

    return (
        <div>
            <h1 className="sr-only">Brokers</h1>
            <p className="text-lg leading-relaxed text-text-secondary">
                Sources where we found your exposure data and private details...
            </p>
            <p className="mt-1 text-data text-text-tertiary">
                {ordered.length} source{ordered.length === 1 ? "" : "s"} had a listing for you
            </p>

            <div className="mt-4">
                {ordered.length === 0 ? (
                    <Card className="p-4">
                        <p className="text-lg text-text-secondary">No broker sources recorded for this scan.</p>
                    </Card>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {visible.map((code) => (
                            <li key={code}>
                                <BrokerCard code={code} fields={brokerFields[code] ?? []} />
                            </li>
                        ))}
                        {locked.length > 0 ? (
                            <li className="relative min-h-56 overflow-hidden rounded-lg">
                                <div className="pointer-events-none select-none space-y-2 blur-sm" aria-hidden>
                                    {locked.map((code) => (
                                        <BrokerCard key={code} code={code} fields={brokerFields[code] ?? []} />
                                    ))}
                                </div>
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg-overlay px-4 text-center">
                                    <CreateAccountPrompt extraCount={extraCount} />
                                </div>
                            </li>
                        ) : gated ? (
                            <li>
                                <Card className="px-4 py-6 text-center">
                                    <CreateAccountPrompt extraCount={extraCount} />
                                </Card>
                            </li>
                        ) : null}
                    </ul>
                )}
            </div>
        </div>
    );
}
