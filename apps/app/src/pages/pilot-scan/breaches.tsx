import { buildRiskAreas, type ConsolidatedProfile } from "./consolidated-profile";

const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

/** "2019-05" / "2019-05-14" -> "May 2019". Falls back to year-only, then the raw value. */
function formatBreachDate(date?: string | null, year?: string | null): string {
    const m = date ? /^(\d{4})-(\d{2})/.exec(date) : null;
    if (m) {
        const monthIndex = parseInt(m[2], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) return `${MONTHS[monthIndex]} ${m[1]}`;
    }
    return year || date || "Date unknown";
}

/**
 * Breaches slide — same breach-card list previously reachable only as a
 * drill-down under risk-summary's "Critical" area, now its own page.
 */
export function BreachesBody({ profile }: { profile: ConsolidatedProfile }) {
    // Newest first — breachCards is grouped by email (each email's own
    // breaches already sorted), not globally sorted across emails.
    const breachCards = [...(buildRiskAreas(profile).find((a) => a.id === "critical")?.breachCards ?? [])].sort(
        (a, b) => (b.date || b.year || "").localeCompare(a.date || a.year || ""),
    );
    const emailCount = new Set(breachCards.map((b) => b.email)).size;

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Breaches
            </h1>
            <p className="mt-1.5 text-sm text-[#94A3B8]">
                {breachCards.length === 0
                    ? "No breaches found for any confirmed email"
                    : `${breachCards.length} breach${breachCards.length === 1 ? "" : "es"} across ${emailCount} email${emailCount === 1 ? "" : "s"}`}
            </p>

            <div className="mt-6">
                {breachCards.length === 0 ? (
                    <div className="rounded-2xl bg-[#1A2E42] p-4 sm:p-5">
                        <p className="text-sm text-[#8CA3B8]">
                            No breaches found for any confirmed email.
                        </p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2.5">
                        {breachCards.map((b, i) => (
                            <li
                                key={`${b.email}-${b.name}-${i}`}
                                className="rounded-2xl bg-[#1A2E42] p-4 sm:p-5"
                            >
                                <div className="flex items-baseline justify-between gap-3">
                                    <p className="truncate text-[15px] font-semibold text-white">
                                        {b.name}
                                    </p>
                                    <p className="shrink-0 text-xs text-[#8CA3B8]">
                                        {formatBreachDate(b.date, b.year)}
                                    </p>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-[#8CA3B8]">
                                    {b.email}
                                </p>
                                {b.fieldsExposed.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {b.fieldsExposed.map((field) => (
                                            <span
                                                key={field}
                                                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#94A3B8]"
                                            >
                                                {field}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
