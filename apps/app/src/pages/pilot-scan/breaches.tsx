import { useState } from "react";
import { Dialog, DialogButton } from "konsta/react";
import { Info } from "lucide-react";
import { Card } from "@vanyshr/ui/components/ui/card/card";
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

/** "Zacks.com (2024)" -> "zacks.com"; null when the source name has no domain ("AT&T"). */
function breachDomain(name: string): string | null {
    const m = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(name);
    return m ? m[1].toLowerCase() : null;
}

/**
 * Logo badge for a breach source: the site's favicon via DuckDuckGo's icon service (no tracking;
 * no-referrer so the report URL isn't sent), else the source's first letter.
 */
function BreachLogo({ name }: { name: string }) {
    const domain = breachDomain(name);
    const [failed, setFailed] = useState(false);

    return (
        <span
            className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-elevated"
            aria-hidden
        >
            {domain && !failed ? (
                <img
                    src={`https://icons.duckduckgo.com/ip3/${domain}.ico`}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() => setFailed(true)}
                    className="size-6 object-contain"
                />
            ) : (
                <span className="text-md font-bold text-text-secondary">{name.trim().charAt(0).toUpperCase()}</span>
            )}
        </span>
    );
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
    // One group per email, newest breach first within each; groups in order of their newest breach.
    const groups = new Map<string, typeof breachCards>();
    for (const b of breachCards) groups.set(b.email, [...(groups.get(b.email) ?? []), b]);
    const emailCount = groups.size;
    const [infoOpen, setInfoOpen] = useState(false);

    return (
        <div>
            <h1 className="sr-only">Breaches</h1>
            <div className="flex items-center gap-1">
                <p className="text-data font-medium uppercase tracking-widest text-text-tertiary">
                    Dark Web Breaches
                </p>
                {/* size-11 keeps a 44px target around the small icon. */}
                <button
                    type="button"
                    onClick={() => setInfoOpen(true)}
                    aria-label="What is a breach?"
                    className="-my-3 flex size-11 items-center justify-center rounded-full text-text-tertiary outline-none transition-colors duration-fast hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus"
                >
                    <Info className="size-4" aria-hidden />
                </button>
            </div>
            <Dialog
                opened={infoOpen}
                onBackdropClick={() => setInfoOpen(false)}
                title={<span className="text-brand-navy">What is a breach?</span>}
                content={
                    <span className="text-brand-navy">
                        A breach is a leak from a company or site — emails, passwords, or personal details that
                        then get posted or traded.
                    </span>
                }
                buttons={
                    <DialogButton strong onClick={() => setInfoOpen(false)}>
                        Got it
                    </DialogButton>
                }
            />
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
                    <div className="flex flex-col gap-6">
                        {[...groups].map(([email, cards]) => (
                            <section key={email} aria-label={email}>
                                <h2 className="text-md text-text-primary">
                                    <span className="break-all font-bold">{email}</span> -{" "}
                                    <span className="text-lg font-bold text-accent-text">{cards.length}</span>{" "}
                                    {cards.length === 1 ? "Breach" : "Breaches"} found
                                </h2>
                                <ul className="mt-2 flex flex-col gap-2">
                                    {cards.map((b, i) => (
                                        <li key={`${b.name}-${i}`}>
                                            <Card className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <BreachLogo name={b.name} />
                                                    <p className="min-w-0 flex-1 truncate text-lg font-semibold text-text-primary">
                                                        {b.name}
                                                    </p>
                                                    <p className="shrink-0 text-md font-bold tabular-nums text-text-primary">
                                                        {formatBreachDate(b.date, b.year)}
                                                    </p>
                                                </div>
                                            </Card>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
