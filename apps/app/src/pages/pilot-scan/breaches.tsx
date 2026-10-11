import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Dialog, DialogButton } from "konsta/react";
import { ChevronDown, Info } from "lucide-react";
import { Card } from "@vanyshr/ui/components/ui/card/card";
import { cx } from "@/utils/cx";
import { buildRiskAreas, type BreachCard, type ConsolidatedProfile } from "./consolidated-profile";
import { FieldChips } from "./field-chips";

const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "2019-11" / "2019-11-14" -> "Nov, 2019". Falls back to year-only, then the raw value. */
function formatBreachDate(date?: string | null, year?: string | null): string {
    const m = date ? /^(\d{4})-(\d{2})/.exec(date) : null;
    if (m) {
        const monthIndex = parseInt(m[2], 10) - 1;
        if (monthIndex >= 0 && monthIndex < 12) return `${MONTHS[monthIndex]}, ${m[1]}`;
    }
    return year || date || "Date unknown";
}

/** "Zacks.com (2024)" -> "zacks.com"; null when the source name has no domain ("AT&T"). */
function breachDomain(name: string): string | null {
    const m = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/i.exec(name);
    return m ? m[1].toLowerCase() : null;
}

// Letter-badge tints, picked by a stable hash of the source name. Tokens rather than a computed
// HSL hue (no raw color values in components, CLAUDE.md); each carries a white letter.
const LETTER_TINTS = [
    "bg-primary",
    "bg-secondary",
    "bg-accent",
    "bg-status-success",
    "bg-status-warn",
    "bg-status-danger",
] as const;

function letterTint(name: string): string {
    let hash = 0;
    for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
    return LETTER_TINTS[Math.abs(hash) % LETTER_TINTS.length];
}

/**
 * Logo badge for a breach source: the site's favicon from Google's favicon service (128px, so it
 * stays crisp), else a tinted letter badge. Google answers an unknown domain with a 16px default
 * globe (HTTP 404), which some browsers render instead of firing onError, so a tiny image counts
 * as a miss too. no-referrer keeps the report URL out of the request.
 */
function BreachLogo({ name }: { name: string }) {
    const domain = breachDomain(name);
    const [failed, setFailed] = useState(false);

    if (domain && !failed) {
        return (
            // White logo tile in both themes (iOS app-icon style). --color-brand-primary4 (#fafafa) is the
            // one existing light token that doesn't flip in light mode; `bg-white` maps to
            // --color-bg-inverse here, which goes dark in light mode.
            <span
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-(--color-brand-primary4)"
                aria-hidden
            >
                <img
                    src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
                    alt=""
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() => setFailed(true)}
                    onLoad={(e) => {
                        if (e.currentTarget.naturalWidth <= 16) setFailed(true);
                    }}
                    className="size-7 object-contain"
                />
            </span>
        );
    }

    return (
        <span
            className={cx(
                "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md",
                letterTint(name),
            )}
            aria-hidden
        >
            <span className="text-md font-bold text-text-primary">{name.trim().charAt(0).toUpperCase()}</span>
        </span>
    );
}

/** One breach: logo, name and date; tap to expand the exposed data types. */
function BreachItem({ breach }: { breach: BreachCard }) {
    const [open, setOpen] = useState(false);
    const reduceMotion = useReducedMotion();

    return (
        <Card className="px-4 py-3">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-expanded={open}
                className="flex min-h-11 w-full items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
                <BreachLogo name={breach.name} />
                <span className="min-w-0 flex-1 truncate text-lg font-semibold text-text-primary">{breach.name}</span>
                <span className="shrink-0 text-md font-bold tabular-nums text-text-primary">
                    {formatBreachDate(breach.date, breach.year)}
                </span>
                <ChevronDown
                    className={cx(
                        "size-5 shrink-0 text-text-tertiary transition-transform duration-fast",
                        open && "rotate-180",
                    )}
                    aria-hidden
                />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                        className="overflow-hidden"
                    >
                        <FieldChips fields={breach.fieldsExposed} limit={Infinity} />
                    </motion.div>
                )}
            </AnimatePresence>
        </Card>
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
                                            <BreachItem breach={b} />
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
