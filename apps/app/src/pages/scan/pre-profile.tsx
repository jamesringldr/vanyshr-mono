import { Link } from "react-router";
import {
    Menu,
    CreditCard,
    Users,
    MapPin,
    Phone,
    Building2,
    Landmark,
    Scale,
    ArrowRight,
} from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";

/** PreProfile page data — summary and per–data-type exposure. */
export interface PreProfileData {
    brokerCount: number;
    totalDataPoints: number;
    scamRisks: number;
    spamRisks: number;
    contact: {
        fullName: string;
        age: number | null;
        location: string;
        currentAddress: string;
        primaryPhone: string;
    };
    alsoKnownAs: string[];
    familyAndFriends: { name: string; age?: number }[];
    pastAddresses: string[];
    pastPhones: string[];
    employers: string[];
    financialAssets: string[];
    courtRecords: string[];
}

const MOCK_PRE_PROFILE: PreProfileData = {
    brokerCount: 49,
    totalDataPoints: 146,
    scamRisks: 25,
    spamRisks: 26,
    contact: {
        fullName: "James A Oehring",
        age: 37,
        location: "Cameron, MO",
        currentAddress: "413 Lovers Ln\nCameron, MO",
        primaryPhone: "(816) 225-8592",
    },
    alsoKnownAs: ["James Allen Oehring Jr."],
    familyAndFriends: [{ name: "Rickilinda Oehring", age: 65 }],
    pastAddresses: [],
    pastPhones: [],
    employers: [],
    financialAssets: [],
    courtRecords: [],
};

/** Data-type card: icon + title + content. Vanyshr tokens, rounded-xl, border-subtle. */
function DataTypeCard({
    icon: Icon,
    title,
    children,
    className,
}: {
    icon: React.ElementType;
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section
            role="region"
            aria-label={title}
            className={cx(
                "rounded-xl border p-4 transition-colors",
                "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <Icon
                    className="h-5 w-5 shrink-0 text-[var(--text-secondary)] dark:text-[#A8BFD4]"
                    aria-hidden
                />
                <h3 className="text-sm font-semibold text-[var(--text-primary)] dark:text-white">
                    {title}
                </h3>
            </div>
            <div className="mt-3">{children}</div>
        </section>
    );
}

/** Pill/chip for alias or single-value display. Input-like bg per design system. */
function Pill({
    children,
    className,
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <span
            className={cx(
                "inline-flex items-center rounded-xl px-3 py-1.5 text-sm",
                "bg-[#F0F4F8]/50 dark:bg-[#022136]/50",
                "border border-[var(--border-subtle)] dark:border-[#2A4A68]",
                "text-[var(--text-primary)] dark:text-white",
                className,
            )}
        >
            {children}
        </span>
    );
}

export function PreProfile() {
    const data = MOCK_PRE_PROFILE;

    return (
        <div
            className="min-h-screen w-full bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
            role="main"
            aria-label="Pre-profile exposure summary"
        >
            <div className="mx-auto max-w-3xl px-4 pb-28 pt-4 sm:pt-6">
                {/* Header */}
                <header className="mb-6 flex h-14 items-center justify-between gap-4 sm:mb-8">
                    <div className="w-10 shrink-0" aria-hidden />
                    <div className="flex min-w-0 flex-1 justify-center">
                        <img
                            src={PrimaryLogo}
                            alt="Vanyshr"
                            className="h-[2.1875rem] w-auto dark:hidden sm:h-[2.5rem]"
                        />
                        <img
                            src={PrimaryLogoDark}
                            alt="Vanyshr"
                            className="hidden h-[2.1875rem] w-auto dark:block sm:h-[2.5rem]"
                        />
                    </div>
                    <button
                        type="button"
                        aria-label="Open menu"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-primary)] dark:text-white outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:hover:bg-white/10 dark:focus-visible:ring-offset-[#022136]"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                {/* Primary summary card (hook) */}
                <div
                    className={cx(
                        "rounded-xl border-2 p-5 text-center sm:p-6",
                        "border-[#DC2626] dark:border-[#B91C1C]",
                        "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                    )}
                    role="region"
                    aria-label="Exposure summary"
                >
                    <p className="text-3xl font-bold tracking-tight text-[var(--text-primary)] dark:text-white sm:text-4xl">
                        {data.brokerCount} Brokers
                    </p>
                    <p className="mt-1 text-sm font-bold text-[var(--text-primary)] dark:text-white">
                        Exposing Your Personal Data
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)] dark:text-white">
                        You are at risk of Spam, Robocallers, Identity Theft, Hacks & other
                        Threats
                    </p>
                </div>

                {/* Stat cards */}
                <div className="mt-4 grid grid-cols-3 gap-3 sm:mt-6">
                    <div
                        className={cx(
                            "rounded-xl border p-4 text-center",
                            "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.totalDataPoints}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[var(--text-secondary)] dark:text-[#A8BFD4]">
                            Data<br />Points
                        </p>
                    </div>
                    <div
                        className={cx(
                            "rounded-xl border p-4 text-center",
                            "border-[#DC2626] dark:border-[#B91C1C]",
                            "bg-[#DC2626]/20 dark:bg-[#B91C1C]/20",
                        )}
                    >
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.scamRisks}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[#DC2626] dark:text-red-200">
                            Scam<br />Risks
                        </p>
                    </div>
                    <div
                        className={cx(
                            "rounded-xl border p-4 text-center",
                            "border-[#F59E0B] dark:border-[#D97706]",
                            "bg-[#F59E0B]/20 dark:bg-[#D97706]/20",
                        )}
                    >
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.spamRisks}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[#B45309] dark:text-amber-200">
                            Spam<br />Risks
                        </p>
                    </div>
                </div>

                {/* Data type cards */}
                <div className="mt-6 space-y-4 sm:mt-8">
                    {/* Contact card — top-level identifiers */}
                    <section
                        role="region"
                        aria-label="Contact"
                        className={cx(
                            "rounded-xl border p-4 sm:p-5",
                            "bg-[var(--bg-surface)] dark:bg-[#0F2D45]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
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
                                    {data.contact.primaryPhone || "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)] dark:text-[#7A92A8]">
                                    Current address
                                </p>
                                <p className="mt-0.5 text-sm text-[var(--text-primary)] dark:text-white whitespace-pre-line">
                                    {data.contact.currentAddress || "—"}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Also Known As */}
                    <DataTypeCard icon={CreditCard} title="Also Known As">
                        {data.alsoKnownAs.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                                {data.alsoKnownAs.map((alias, i) => (
                                    <Pill key={i}>{alias}</Pill>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No aliases found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Family & Friends */}
                    <DataTypeCard icon={Users} title="Family & Friends">
                        {data.familyAndFriends.length > 0 ? (
                            <ul className="space-y-2">
                                {data.familyAndFriends.map((item, i) => (
                                    <li
                                        key={i}
                                        className="flex flex-wrap items-center justify-between gap-2"
                                    >
                                        <span className="text-sm text-[var(--text-primary)] dark:text-white">
                                            {item.name}
                                        </span>
                                        {item.age != null && (
                                            <span className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8] tabular-nums">
                                                {item.age}
                                            </span>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No family or friends found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Past addresses */}
                    <DataTypeCard icon={MapPin} title="Past addresses">
                        {data.pastAddresses.length > 0 ? (
                            <ul className="space-y-1.5">
                                {data.pastAddresses.map((addr, i) => (
                                    <li
                                        key={i}
                                        className="text-sm text-[var(--text-primary)] dark:text-white"
                                    >
                                        {addr}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No past addresses found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Past phone numbers */}
                    <DataTypeCard icon={Phone} title="Past phone numbers">
                        {data.pastPhones.length > 0 ? (
                            <ul className="space-y-1.5">
                                {data.pastPhones.map((phone, i) => (
                                    <li
                                        key={i}
                                        className="font-mono text-sm tabular-nums text-[var(--text-primary)] dark:text-white"
                                    >
                                        {phone}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No past phone numbers found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Employers */}
                    <DataTypeCard icon={Building2} title="Employers">
                        {data.employers.length > 0 ? (
                            <ul className="space-y-1.5">
                                {data.employers.map((emp, i) => (
                                    <li
                                        key={i}
                                        className="text-sm text-[var(--text-primary)] dark:text-white"
                                    >
                                        {emp}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No employers found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Financial Assets */}
                    <DataTypeCard icon={Landmark} title="Financial Assets">
                        {data.financialAssets.length > 0 ? (
                            <ul className="space-y-1.5">
                                {data.financialAssets.map((asset, i) => (
                                    <li
                                        key={i}
                                        className="text-sm text-[var(--text-primary)] dark:text-white"
                                    >
                                        {asset}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No financial assets found
                            </p>
                        )}
                    </DataTypeCard>

                    {/* Court Records */}
                    <DataTypeCard icon={Scale} title="Court Records">
                        {data.courtRecords.length > 0 ? (
                            <ul className="space-y-1.5">
                                {data.courtRecords.map((record, i) => (
                                    <li
                                        key={i}
                                        className="text-sm text-[var(--text-primary)] dark:text-white"
                                    >
                                        {record}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-[var(--text-muted)] dark:text-[#7A92A8]">
                                No court records found
                            </p>
                        )}
                    </DataTypeCard>
                </div>
            </div>

            {/* Sticky footer: CTA + disclaimer */}
            <footer
                className={cx(
                    "sticky bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-4 border-t py-4 text-center",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    "bg-[#F0F4F8] dark:bg-[#022136]",
                )}
                role="contentinfo"
                aria-label="Sign up footer"
            >
                <div className="mx-auto w-full max-w-3xl px-4 flex flex-col items-center gap-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#14ABFE] dark:text-[#14ABFE]">
                        NO CREDIT CARD REQUIRED
                    </p>
                    <Link
                        to="/signup"
                        className={cx(
                            "flex h-[52px] w-full max-w-md items-center justify-center gap-2 rounded-xl px-4 font-semibold text-white outline-none transition",
                            "bg-[#14ABFE] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                        aria-label="Start Vanyshing for free"
                    >
                        Start Vanyshing for FREE
                        <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />
                    </Link>
                </div>
            </footer>
        </div>
    );
}
