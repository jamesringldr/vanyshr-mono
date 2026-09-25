import { Card } from "@vanyshr/ui/components/ui/card/card";
import { buildRiskAreas, type ConsolidatedProfile } from "./consolidated-profile";
import { FieldChips } from "./field-chips";

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
            <h1 className="sr-only">Breaches</h1>
            <p className="text-data font-medium uppercase tracking-widest text-text-tertiary">
                Dark web
            </p>
            <p className="mt-2 text-lg leading-relaxed text-text-secondary">
                A breach is a leak from a company or site — emails, passwords, or personal
                details that then get posted or traded.
            </p>
            <p className="mt-1 text-data text-text-tertiary">
                {breachCards.length === 0
                    ? "No breaches found for any confirmed email"
                    : `${breachCards.length} found across ${emailCount} email${emailCount === 1 ? "" : "s"}`}
            </p>

            <div className="mt-4">
                {breachCards.length === 0 ? (
                    <Card className="p-4">
                        <p className="text-lg text-text-secondary">
                            No breaches found for any confirmed email.
                        </p>
                    </Card>
                ) : (
                    <ul className="flex flex-col gap-2">
                        {breachCards.map((b, i) => (
                            <li key={`${b.email}-${b.name}-${i}`}>
                                <Card className="px-4 py-3">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <p className="truncate text-lg font-semibold text-text-primary">
                                            {b.name}
                                        </p>
                                        <p className="shrink-0 text-sm tabular-nums text-text-tertiary">
                                            {formatBreachDate(b.date, b.year)}
                                        </p>
                                    </div>
                                    <p className="truncate text-data text-text-secondary">
                                        {b.email}
                                    </p>
                                    <FieldChips fields={b.fieldsExposed} />
                                </Card>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
