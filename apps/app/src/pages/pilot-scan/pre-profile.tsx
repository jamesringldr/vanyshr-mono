import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import {
    Menu,
    CreditCard,
    Users,
    MapPin,
    Phone,
    Scale,
} from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

/**
 * quickscan.consolidated_profile, as returned inline by full-profile-scan.
 * Already deduped/merged server-side — no client-side broker-merge logic
 * needed here (unlike the old /quick-scan/pre-profile, which did its own
 * Zaba-match merge on raw broker data).
 */
interface ConsolidatedProfile {
    full_name: string | null;
    age: number | null;
    primary_address: string | null;
    previous_addresses: string[];
    phones: string[];
    emails: string[];
    relatives: Array<{ name: string; relation?: string | null; age?: number | null }>;
    aliases: string[];
}

interface PreProfileData {
    brokerCount: number;
    totalDataPoints: number;
    scamRisks: number;
    spamRisks: number;
    contact: {
        fullName: string;
        age: number | null;
        currentAddress: string;
        primaryPhone: string;
    };
    alsoKnownAs: string[];
    familyAndFriends: { name: string; age?: number; relationship?: string }[];
    pastAddresses: Array<{ street: string; cityStateZip: string }>;
    pastPhones: string[];
}

type LoadingState = "loading" | "loaded" | "error";

function toProperCase(str: string): string {
    return str.replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatPhone(num: string): string {
    const digits = num.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return num;
}

/** "413 Lovers Ln, Cameron, MO 64429" -> { street, cityStateZip } for two-line display. */
function parseFullAddress(fullAddr: string): { street: string; cityStateZip: string } {
    const lastComma = fullAddr.lastIndexOf(",");
    if (lastComma !== -1) {
        return {
            street: fullAddr.slice(0, lastComma).trim(),
            cityStateZip: fullAddr.slice(lastComma + 1).trim(),
        };
    }
    return { street: fullAddr, cityStateZip: "" };
}

function convertToPreProfileData(profile: ConsolidatedProfile, brokerCount: number): PreProfileData {
    const phoneCount = profile.phones?.length || 0;
    const addressCount = (profile.primary_address ? 1 : 0) + (profile.previous_addresses?.length || 0);
    const relativeCount = profile.relatives?.length || 0;
    const aliasCount = profile.aliases?.length || 0;

    const totalDataPoints = phoneCount + addressCount + relativeCount + aliasCount;
    const scamRisks = Math.min(Math.floor((phoneCount + addressCount) * 3), 30);
    const spamRisks = Math.min(Math.floor(phoneCount * 5 + relativeCount), 35);

    const [primaryPhone, ...restPhones] = profile.phones ?? [];

    return {
        brokerCount: Math.max(brokerCount, 1),
        totalDataPoints,
        scamRisks,
        spamRisks,
        contact: {
            fullName: profile.full_name || "Unknown",
            age: profile.age,
            currentAddress: profile.primary_address || "—",
            primaryPhone: primaryPhone ? formatPhone(primaryPhone) : "—",
        },
        alsoKnownAs: (profile.aliases || []).map(toProperCase),
        familyAndFriends: (profile.relatives || []).map((r) => ({
            name: toProperCase(r.name),
            age: r.age ?? undefined,
            relationship: r.relation ?? undefined,
        })),
        pastAddresses: (profile.previous_addresses || []).map(parseFullAddress),
        pastPhones: restPhones.map(formatPhone),
    };
}

/** Data-type card: icon + title + content. */
function DataTypeCard({
    icon: Icon,
    title,
    children,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section
            role="region"
            aria-label={title}
            className="rounded-xl border p-4 transition-colors bg-[var(--bg-surface)] dark:bg-[#2D3847] border-[var(--border-subtle)] dark:border-[#2A4A68]"
        >
            <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 shrink-0 text-[var(--text-secondary)] dark:text-[#B8C4CC]" aria-hidden />
                <h3 className="text-sm font-semibold text-[var(--text-primary)] dark:text-white">{title}</h3>
            </div>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-xl px-3 py-1.5 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 border border-[var(--border-subtle)] dark:border-[#2A4A68] text-[var(--text-primary)] dark:text-white">
            {children}
        </span>
    );
}

const LIST_PREVIEW_MAX = 5;

function LimitedTwoColumnGrid<T>({
    items,
    renderItem,
    maxVisible = LIST_PREVIEW_MAX,
}: {
    items: T[];
    renderItem: (item: T, index: number) => React.ReactNode;
    maxVisible?: number;
}) {
    const visible = items.slice(0, maxVisible);
    const remaining = items.length - maxVisible;

    return (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2">
            {visible.map((item, i) => (
                <li key={i}>{renderItem(item, i)}</li>
            ))}
            {remaining > 0 && (
                <li className="text-sm font-medium text-[var(--text-muted)] dark:text-[#7A92A8]">
                    {remaining} More...
                </li>
            )}
        </ul>
    );
}

/**
 * Pilot-scan pre-profile — reads quickscan.consolidated_profile (written by
 * summary-scan/full-profile-scan) straight from sessionStorage, no merge
 * logic needed since it's already deduped server-side. Temporary landing
 * spot for the loading sequence while risk-summary isn't wired to the new
 * tables yet — risk-summary goes in front of this once it is.
 */
export function PilotPreProfilePage() {
    const navigate = useNavigate();
    const prefersReducedMotion = useReducedMotion();
    const [loadingState, setLoadingState] = useState<LoadingState>("loading");
    const [data, setData] = useState<PreProfileData | null>(null);

    useEffect(() => {
        const raw = sessionStorage.getItem("pilotConsolidatedProfile");
        if (!raw) {
            setLoadingState("error");
            return;
        }
        try {
            const parsed = JSON.parse(raw) as { profile: ConsolidatedProfile; brokerCount: number };
            setData(convertToPreProfileData(parsed.profile, parsed.brokerCount));
            setLoadingState("loaded");
        } catch {
            setLoadingState("error");
        }
    }, []);

    if (loadingState === "loading") {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
                role="main"
                aria-label="Loading profile"
            >
                <motion.img
                    src={PrimaryIconOutline}
                    alt=""
                    className="h-24 w-24 object-contain opacity-95"
                    aria-hidden
                    animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                    transition={prefersReducedMotion ? undefined : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                />
            </div>
        );
    }

    if (loadingState === "error" || !data) {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
                role="main"
                aria-label="Error loading profile"
            >
                <div className="w-full max-w-md text-center">
                    <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
                        <Scale className="w-8 h-8 text-red-600 dark:text-red-400" />
                    </div>
                    <h1 className="text-xl font-bold text-[#022136] dark:text-white mb-2">No profile data found</h1>
                    <p className="text-sm text-[#B8C4CC] mb-6">
                        Nothing came through from this scan — run it again from the start.
                    </p>
                    <Link
                        to="/pilot-scan"
                        className="inline-flex h-[44px] items-center justify-center px-6 rounded-xl bg-[#00BFFF] hover:bg-[#1196E0] text-white font-semibold transition-all"
                        onClick={() => navigate("/pilot-scan")}
                    >
                        Start over
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen w-full bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
            role="main"
            aria-label="Pre-profile exposure summary"
        >
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:pt-6">
                <header className="mb-6 flex h-14 items-center justify-between gap-4 sm:mb-8">
                    <div className="w-10 shrink-0" aria-hidden />
                    <div className="flex min-w-0 flex-1 justify-center">
                        <img src={PrimaryLogo} alt="Vanyshr" className="h-[2.1875rem] w-auto dark:hidden sm:h-[2.5rem]" />
                        <img src={PrimaryLogoDark} alt="Vanyshr" className="hidden h-[2.1875rem] w-auto dark:block sm:h-[2.5rem]" />
                    </div>
                    <button
                        type="button"
                        aria-label="Open menu"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-primary)] dark:text-white outline-none transition hover:bg-black/5 dark:hover:bg-white/10"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                <div
                    className="rounded-xl border-2 p-5 text-center sm:p-6 border-[#DC2626] dark:border-[#B91C1C] bg-[var(--bg-surface)] dark:bg-[#2D3847]"
                    role="region"
                    aria-label="Exposure summary"
                >
                    <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)] dark:text-white sm:text-4xl">
                        {data.brokerCount} Broker{data.brokerCount === 1 ? "" : "s"}
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text-primary)] dark:text-white">
                        Exposing Your Personal Data
                    </p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 sm:mt-6">
                    <div className="rounded-xl border p-4 text-center bg-[var(--bg-surface)] dark:bg-[#2D3847] border-[var(--border-subtle)] dark:border-[#2A4A68]">
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.totalDataPoints}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[var(--text-secondary)] dark:text-[#B8C4CC]">
                            Data<br />Points
                        </p>
                    </div>
                    <div className="rounded-xl border p-4 text-center border-[#DC2626] dark:border-[#B91C1C] bg-[#DC2626]/20 dark:bg-[#B91C1C]/20">
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.scamRisks}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[#DC2626] dark:text-red-200">
                            Scam<br />Risks
                        </p>
                    </div>
                    <div className="rounded-xl border p-4 text-center border-[#F59E0B] dark:border-[#D97706] bg-[#F59E0B]/20 dark:bg-[#D97706]/20">
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.spamRisks}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[#B45309] dark:text-amber-200">
                            Spam<br />Risks
                        </p>
                    </div>
                </div>

                <div className="mt-6 space-y-4 sm:mt-8">
                    <section
                        role="region"
                        aria-label="Contact"
                        className="rounded-xl border p-4 sm:p-5 bg-[var(--bg-surface)] dark:bg-[#2D3847] border-[var(--border-subtle)] dark:border-[#2A4A68]"
                    >
                        <div className="flex flex-wrap items-end justify-between gap-2">
                            <h2 className="text-lg font-bold text-[var(--text-primary)] dark:text-white">
                                {data.contact.fullName}
                            </h2>
                            {data.contact.age != null && (
                                <span className="text-lg text-[var(--text-primary)] dark:text-white">
                                    <span className="font-semibold tabular-nums">{data.contact.age}</span>{" "}
                                    <span className="font-normal">years old</span>
                                </span>
                            )}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] dark:text-[#7A92A8]">
                                    Primary phone
                                </p>
                                <p className="mt-0.5 font-mono text-sm tabular-nums text-[var(--text-primary)] dark:text-white">
                                    {data.contact.primaryPhone}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] dark:text-[#7A92A8]">
                                    Current address
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-primary)] dark:text-white whitespace-pre-line">
                                    {data.contact.currentAddress}
                                </p>
                            </div>
                        </div>
                    </section>

                    {data.alsoKnownAs.length > 0 && (
                        <DataTypeCard icon={CreditCard} title="Also Known As">
                            <div className="flex flex-wrap gap-2">
                                {data.alsoKnownAs.map((alias, i) => (
                                    <Pill key={i}>{alias}</Pill>
                                ))}
                            </div>
                        </DataTypeCard>
                    )}

                    {data.familyAndFriends.length > 0 && (
                        <DataTypeCard icon={Users} title="Family & Friends">
                            <LimitedTwoColumnGrid
                                items={data.familyAndFriends}
                                renderItem={(item) => (
                                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                                        <span className="text-sm text-[var(--text-primary)] dark:text-white">
                                            {item.name}
                                            {item.relationship && (
                                                <span className="text-[var(--text-muted)] dark:text-[#7A92A8] ml-1">
                                                    ({item.relationship})
                                                </span>
                                            )}
                                        </span>
                                        {item.age != null && (
                                            <span className="shrink-0 text-sm text-[var(--text-muted)] dark:text-[#7A92A8] tabular-nums">
                                                {item.age}
                                            </span>
                                        )}
                                    </div>
                                )}
                            />
                        </DataTypeCard>
                    )}

                    {data.pastAddresses.length > 0 && (
                        <DataTypeCard icon={MapPin} title="Past addresses">
                            <LimitedTwoColumnGrid
                                items={data.pastAddresses}
                                maxVisible={3}
                                renderItem={(addr) => (
                                    <div>
                                        {addr.street && (
                                            <p className="text-sm font-bold text-[var(--text-primary)] dark:text-white">
                                                {addr.street}
                                            </p>
                                        )}
                                        {addr.cityStateZip && (
                                            <p className="text-sm font-normal text-[var(--text-secondary)] dark:text-[#B8C4CC]">
                                                {addr.cityStateZip}
                                            </p>
                                        )}
                                    </div>
                                )}
                            />
                        </DataTypeCard>
                    )}

                    {data.pastPhones.length > 0 && (
                        <DataTypeCard icon={Phone} title="Past phone numbers">
                            <LimitedTwoColumnGrid
                                items={data.pastPhones}
                                renderItem={(phone) => (
                                    <span className="font-mono text-sm tabular-nums text-[var(--text-primary)] dark:text-white">
                                        {phone}
                                    </span>
                                )}
                            />
                        </DataTypeCard>
                    )}
                </div>
            </div>
        </div>
    );
}
