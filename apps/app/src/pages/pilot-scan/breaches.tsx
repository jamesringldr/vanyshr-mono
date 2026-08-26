import { buildRiskAreas, type ConsolidatedProfile } from "./consolidated-profile";

/**
 * Breaches slide — same breach-card list previously reachable only as a
 * drill-down under risk-summary's "Critical" area, now its own page.
 */
export function BreachesBody({ profile }: { profile: ConsolidatedProfile }) {
    const breachCards = buildRiskAreas(profile).find((a) => a.id === "critical")?.breachCards ?? [];

    return (
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Breaches
            </h1>

            <div className="mt-6">
                {breachCards.length === 0 ? (
                    <div className="rounded-2xl bg-[#1A2E42] p-4 sm:p-5">
                        <p className="text-sm text-[#7A92A8]">
                            No breaches found for any confirmed email.
                        </p>
                    </div>
                ) : (
                    <ul className="flex flex-col gap-2.5">
                        {breachCards.map((b, i) => (
                            <li
                                key={`${b.email}-${b.name}-${i}`}
                                className="rounded-2xl bg-[#1A2E42] px-4 py-3.5"
                            >
                                <p className="break-all text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A92A8]">
                                    {b.email}
                                </p>
                                <p className="mt-1 text-sm leading-snug text-white">
                                    {b.name}
                                    {(b.date || b.year) ? ` · ${b.date || b.year}` : ""}
                                </p>
                                {b.fieldsExposed.length > 0 && (
                                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {b.fieldsExposed.map((field) => (
                                            <span
                                                key={field}
                                                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#B8C4CC]"
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
