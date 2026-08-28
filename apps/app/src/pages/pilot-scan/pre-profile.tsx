import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
    Menu,
    CreditCard,
    Users,
    MapPin,
    Phone,
    Briefcase,
    GraduationCap,
    Home,
    Gavel,
} from "lucide-react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import {
    loadConsolidatedProfile,
    toProperCase,
    formatPhone,
    formatMoney,
    formatJob,
    formatEducation,
    parseFullAddress,
    cityState,
    cityStateZip,
    type ConsolidatedProfile,
} from "./consolidated-profile";

type ParsedAddress = { street: string; city: string; state: string; zip: string };

interface PreProfileData {
    contact: {
        fullName: string;
        age: number | null;
        currentAddress: ParsedAddress | null;
        primaryPhone: string;
    };
    alsoKnownAs: string[];
    familyAndFriends: { name: string; age?: number; relationship?: string }[];
    pastAddresses: ParsedAddress[];
    pastPhones: string[];
    employment: { label: string; isCurrent: boolean }[];
    education: string[];
    homeSpecs: { address?: ParsedAddress; facts: { label: string; value: string }[] }[];
    legalRecords: { county?: string; countyCount?: number; nationwideCount?: number } | null;
}

/** Common US name suffixes -- stripped before reading off a "last name" so
 *  "Michael Scott Jr" matches on "Scott", not "Jr". */
const NAME_SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

function lastNameOf(fullName: string): string {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    while (parts.length > 1 && NAME_SUFFIXES.has(parts[parts.length - 1].toLowerCase().replace(/\.$/, ""))) {
        parts.pop();
    }
    return parts[parts.length - 1] || "";
}

function convertToPreProfileData(profile: ConsolidatedProfile): PreProfileData {
    const [primaryPhone, ...restPhones] = profile.phones ?? [];

    return {
        contact: {
            fullName: profile.full_name || "Unknown",
            age: profile.age,
            currentAddress: profile.primary_address ? parseFullAddress(profile.primary_address) : null,
            primaryPhone: primaryPhone ? formatPhone(primaryPhone) : "—",
        },
        alsoKnownAs: (profile.aliases || []).map(toProperCase),
        // Shared last name (likely immediate family, e.g. a spouse or kid) sorts
        // first; suffix-stripped so "Michael Scott Jr" still matches "Scott".
        familyAndFriends: (profile.relatives || [])
            .map((r) => ({
                name: toProperCase(r.name),
                age: r.age ?? undefined,
                relationship: r.relation ?? undefined,
            }))
            .sort((a, b) => {
                const mainLastName = lastNameOf(profile.full_name || "").toLowerCase();
                const aMatches = lastNameOf(a.name).toLowerCase() === mainLastName;
                const bMatches = lastNameOf(b.name).toLowerCase() === mainLastName;
                if (aMatches === bMatches) return 0;
                return aMatches ? -1 : 1;
            }),
        pastAddresses: (profile.previous_addresses || []).map(parseFullAddress),
        pastPhones: restPhones.map(formatPhone),
        employment: (profile.employment || [])
            .map((job) => ({ label: formatJob(job), isCurrent: job.kind === "current" }))
            .filter((job) => job.label),
        education: (profile.education || []).map(formatEducation).filter(Boolean),
        homeSpecs: (profile.properties || []).map((p) => {
            const facts: { label: string; value: string }[] = [];
            if (p.beds) facts.push({ label: "Beds", value: p.beds });
            if (p.baths) facts.push({ label: "Baths", value: p.baths });
            if (p.squareFeet) facts.push({ label: "Sq Ft", value: p.squareFeet.toLocaleString("en-US") });
            if (p.yearBuilt) facts.push({ label: "Year Built", value: String(p.yearBuilt) });
            if (p.estimatedValue) facts.push({ label: "Est. Value", value: formatMoney(p.estimatedValue) });
            if (p.estimatedEquity) facts.push({ label: "Est. Equity", value: formatMoney(p.estimatedEquity) });
            if (p.lastSaleAmount) facts.push({ label: "Last Sale", value: formatMoney(p.lastSaleAmount) });
            if (p.lastSaleDate) facts.push({ label: "Sale Date", value: p.lastSaleDate });
            if (p.landUse) facts.push({ label: "Land Use", value: p.landUse });
            if (p.occupancyType) facts.push({ label: "Occupancy", value: p.occupancyType });
            return { address: p.address ? parseFullAddress(p.address) : undefined, facts };
        }).filter((p) => p.facts.length > 0),
        legalRecords: (profile.legal_records?.countyRecords || profile.legal_records?.nationwideCount != null)
            ? {
                county: profile.legal_records.countyRecords?.location,
                countyCount: profile.legal_records.countyRecords?.count ?? undefined,
                nationwideCount: profile.legal_records.nationwideCount ?? undefined,
            }
            : null,
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
            className="rounded-2xl bg-[#1A2E42] p-4"
        >
            <div className="flex items-center gap-2">
                <Icon className="h-5 w-5 shrink-0 text-[#7A92A8]" aria-hidden />
                <h3 className="text-sm font-semibold text-white">{title}</h3>
            </div>
            <div className="mt-3">{children}</div>
        </section>
    );
}

function Pill({ children }: { children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full px-3 py-1.5 text-sm bg-white/10 text-white">
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
                <li className="text-sm font-medium text-[#7A92A8]">
                    {remaining} More...
                </li>
            )}
        </ul>
    );
}

/**
 * Pre-profile slide content — title + data-type cards, no page chrome. Used
 * standalone by PilotPreProfilePage's own header/background below, and as
 * one slide of the report carousel (report.tsx), which supplies its own
 * shared header instead.
 */
export function PreProfileBody({ profile }: { profile: ConsolidatedProfile }) {
    const data = useMemo(() => convertToPreProfileData(profile), [profile]);
    return (
        <div>
            <h1 className="sr-only">Exposed Data</h1>
            <p className="text-base leading-relaxed text-[#B8C4CC]">
                This is the personal data that's publicly available about you right now. Hackers and scammers use this information to target you and your family with sophisticated social engineering attacks—impersonating trusted companies, authorities, or loved ones. The more data they have, the more convincing their attacks become.
            </p>

            <div className="mt-6 space-y-4">
                <section
                    role="region"
                    aria-label="Contact"
                    className="rounded-2xl bg-[#1A2E42] p-4 sm:p-5"
                >
                    <h2 className="text-2xl font-bold text-white">
                        {data.contact.fullName}
                        {data.contact.age != null && <span className="text-sm text-[#7A92A8] font-normal"> ({data.contact.age})</span>}
                    </h2>
                    <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A92A8]">
                                Primary phone
                            </p>
                            <p className="mt-0.5 font-mono text-sm tabular-nums text-white">
                                {data.contact.primaryPhone}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[#7A92A8]">
                                Current address
                            </p>
                            {data.contact.currentAddress ? (
                                <div className="mt-0.5 text-sm text-white">
                                    {data.contact.currentAddress.street && <p>{data.contact.currentAddress.street}</p>}
                                    {cityState(data.contact.currentAddress) && <p>{cityState(data.contact.currentAddress)}</p>}
                                </div>
                            ) : (
                                <p className="mt-0.5 text-sm text-white">—</p>
                            )}
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
                                <span className="text-sm text-white">
                                    {item.name}
                                </span>
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
                                        <p className="text-sm text-white">
                                            {addr.street}
                                        </p>
                                    )}
                                    {cityState(addr) && (
                                        <p className="text-sm text-white">
                                            {cityState(addr)}
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
                                <span className="font-mono text-sm tabular-nums text-white">
                                    {phone}
                                </span>
                            )}
                        />
                    </DataTypeCard>
                )}

                {data.employment.length > 0 && (
                    <DataTypeCard icon={Briefcase} title="Employment">
                        <ul className="space-y-2">
                            {data.employment.map((job, i) => (
                                <li key={i} className="text-sm text-white">
                                    {toProperCase(job.label)}
                                    {job.isCurrent && (
                                        <span className="text-[#7A92A8] ml-1">
                                            (Current)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </DataTypeCard>
                )}

                {data.education.length > 0 && (
                    <DataTypeCard icon={GraduationCap} title="Education">
                        <ul className="space-y-1.5">
                            {data.education.map((entry, i) => (
                                <li key={i} className="text-sm text-white">
                                    {entry}
                                </li>
                            ))}
                        </ul>
                    </DataTypeCard>
                )}

                {data.homeSpecs.length > 0 && (
                    <DataTypeCard icon={Home} title="Residential details">
                        <div className="space-y-4">
                            {data.homeSpecs.map((home, i) => {
                                return (
                                    <div key={i}>
                                        {home.address && (
                                            <div className="mb-2 text-sm text-white">
                                                {home.address.street && <p>{home.address.street}</p>}
                                                {cityStateZip(home.address) && <p>{cityStateZip(home.address)}</p>}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                                            {home.facts.map((fact, j) => (
                                                <div key={j}>
                                                    <p className="text-xs font-semibold uppercase tracking-wide text-[#7A92A8]">
                                                        {fact.label}
                                                    </p>
                                                    <p className="mt-0.5 text-sm text-white">
                                                        {fact.value}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </DataTypeCard>
                )}

                {data.legalRecords && (
                    <DataTypeCard icon={Gavel} title="Legal records">
                        <div className="flex flex-wrap gap-2">
                            {data.legalRecords.nationwideCount != null && (
                                <Pill>{data.legalRecords.nationwideCount} nationwide</Pill>
                            )}
                            {data.legalRecords.county && (
                                <Pill>
                                    {data.legalRecords.countyCount ?? "?"} in {data.legalRecords.county}
                                </Pill>
                            )}
                        </div>
                    </DataTypeCard>
                )}
            </div>
        </div>
    );
}

/**
 * Standalone pre-profile page — reads quickscan.consolidated_profile (written
 * by summary-scan/full-profile-scan, refreshed by manage-emails) from
 * sessionStorage. Not part of the normal flow any more (loading.tsx navigates
 * to the report carousel instead — see report.tsx), kept as a direct-link
 * fallback.
 */
export function PilotPreProfilePage() {
    const navigate = useNavigate();
    const [{ data: stored }] = useState(() => loadConsolidatedProfile());

    if (!stored) {
        return (
            <div
                className="flex min-h-screen w-full flex-col items-center justify-center bg-[#022136] p-4 font-sans"
                role="main"
                aria-label="Error loading profile"
            >
                <div className="w-full max-w-md text-center">
                    <h1 className="mb-2 text-xl font-bold text-white">No profile data found</h1>
                    <p className="mb-6 text-sm text-[#B8C4CC]">
                        Nothing came through from this scan — run it again from the start.
                    </p>
                    <Link
                        to="/pilot-scan"
                        className="inline-flex h-[44px] items-center justify-center rounded-xl bg-[#00BFFF] px-6 font-semibold text-white transition-all hover:bg-[#1196E0]"
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
            className="min-h-screen w-full bg-[#022136] font-sans"
            role="main"
            aria-label="Pre-profile exposure summary"
        >
            <div className="mx-auto max-w-3xl px-4 pb-16 pt-4 sm:pt-6">
                <header className="mb-6 flex h-14 items-center justify-between gap-4 sm:mb-8">
                    <div className="w-10 shrink-0" aria-hidden />
                    <div className="flex min-w-0 flex-1 justify-center">
                        <img src={PrimaryLogoDark} alt="Vanyshr" className="h-[2.1875rem] w-auto sm:h-[2.5rem]" />
                    </div>
                    <button
                        type="button"
                        aria-label="Open menu"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white outline-none transition hover:bg-white/10"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                <PreProfileBody profile={stored.profile} />
            </div>
        </div>
    );
}
