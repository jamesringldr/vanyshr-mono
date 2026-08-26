import { Search } from "lucide-react";
import { brokerLabel } from "./scan-result";

const BROKER_DESCRIPTIONS: Record<string, string> = {
    fps: "People-search listing with legal name, address history, and phone numbers.",
    npd: "Public records aggregator carrying SSN, date of birth, and legal records.",
    anywho: "Reverse phone/address lookup with legal name and known relatives.",
    zaba: "People-search listing with address, phone, and relative history.",
};

/** Brokers slide — which people-search sites had a listing for this pick. */
export function BrokersBody({ brokers }: { brokers: string[] }) {
    const unique = Array.from(new Set(brokers));

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Brokers
            </h1>
            <p className="mt-1.5 text-sm text-[#B8C4CC]">
                {unique.length} data broker{unique.length === 1 ? "" : "s"} had a listing for you
            </p>

            <div className="mt-6 flex flex-col gap-2.5">
                {unique.length === 0 ? (
                    <div className="rounded-2xl bg-[#1A2E42] p-4 sm:p-5">
                        <p className="text-sm text-[#7A92A8]">
                            No broker sources recorded for this scan.
                        </p>
                    </div>
                ) : (
                    unique.map((code) => (
                        <div key={code} className="flex items-start gap-3 rounded-2xl bg-[#1A2E42] p-4 sm:p-5">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#00BFFF]/15 text-[#00BFFF]">
                                <Search className="h-4 w-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">{brokerLabel(code)}</p>
                                {BROKER_DESCRIPTIONS[code] && (
                                    <p className="mt-0.5 text-xs leading-snug text-[#7A92A8]">
                                        {BROKER_DESCRIPTIONS[code]}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
