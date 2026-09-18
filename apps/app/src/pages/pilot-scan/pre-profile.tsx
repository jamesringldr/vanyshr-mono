import { useMemo, useState } from "react";
import {
    Menu,
    CreditCard,
    Mail,
    Users,
    MapPin,
    Phone,
    Briefcase,
    GraduationCap,
    House,
    Gavel,
} from "lucide-react";
import { Navbar, Page } from "konsta/react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryLogoLight from "@vanyshr/ui/assets/PrimaryLogo.png";
import { Card } from "@vanyshr/ui/components/ui/card/card";
import { Badge } from "@vanyshr/ui/components/ui/badge/badge";
import { Button } from "@vanyshr/ui/components/ui/buttons/button";
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
        emails: string[];
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
            emails: profile.emails ?? [],
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
        <Card role="region" aria-label={title} className="px-4 py-3">
            <div className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-text-tertiary" aria-hidden />
                <h3 className="text-data font-medium uppercase tracking-widest text-text-tertiary">{title}</h3>
            </div>
            <div className="mt-2">{children}</div>
        </Card>
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
                <li className="text-data font-medium text-text-tertiary">
                    +{remaining} more
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
export function PreProfileBody({
    profile,
    selfScan,
}: {
    profile: ConsolidatedProfile;
    /** True only on the self-scan report -- drops the intro paragraph below,
     *  which is pilot-scan-specific copy. */
    selfScan?: boolean;
}) {
    const data = useMemo(() => convertToPreProfileData(profile), [profile]);
    return (
        <div>
            <h1 className="sr-only">Exposed Data</h1>
            {!selfScan && (
                <p className="text-md leading-relaxed text-text-secondary">
                    Hackers and scammers use your exposed data to attack or impersonate you with sophisticated attacks. The more data they can source, the more convincing the scam becomes.
                </p>
            )}

            {selfScan ? (
                <p className="mt-4 text-lg leading-relaxed text-text-secondary">
                    This is the public record we matched to you — names, numbers, and places already listed online.
                </p>
            ) : null}

            <div className="mt-4 space-y-3">
                <Card role="region" aria-label="Contact" className="p-4">
                    <h2 className="font-display text-lg font-semibold tracking-tight text-text-primary">
                        {data.contact.fullName}
                        {data.contact.age != null && (
                            <span className="ml-1 font-body text-data font-normal text-text-tertiary">{data.contact.age}</span>
                        )}
                    </h2>
                    <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
                        <div>
                            <dt className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
                                Primary phone
                            </dt>
                            <dd className="mt-1 font-mono text-md tabular-nums text-text-primary">
                                {data.contact.primaryPhone}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
                                Current address
                            </dt>
                            <dd className="mt-1 text-md leading-snug text-text-primary">
                                {data.contact.currentAddress ? (
                                    <>
                                        {data.contact.currentAddress.street && <p>{data.contact.currentAddress.street}</p>}
                                        {cityState(data.contact.currentAddress) && <p>{cityState(data.contact.currentAddress)}</p>}
                                    </>
                                ) : (
                                    "—"
                                )}
                            </dd>
                        </div>
                    </dl>
                </Card>

                {data.employment.length > 0 && (
                    <DataTypeCard icon={Briefcase} title="Employment">
                        <ul className="space-y-2">
                            {data.employment.map((job, i) => (
                                <li key={i} className="text-md text-text-primary">
                                    {toProperCase(job.label)}
                                    {job.isCurrent && (
                                        <span className="ml-1 text-text-tertiary">
                                            (Current)
                                        </span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </DataTypeCard>
                )}

                {data.familyAndFriends.length > 0 && (
                    <DataTypeCard icon={Users} title="Family & Friends">
                        <LimitedTwoColumnGrid
                            items={data.familyAndFriends}
                            renderItem={(item) => (
                                <span className="text-md text-text-primary">
                                    {item.name}
                                </span>
                            )}
                        />
                    </DataTypeCard>
                )}

                {data.homeSpecs.length > 0 && (
                    <DataTypeCard icon={House} title="Residential details">
                        <div className="space-y-4">
                            {data.homeSpecs.map((home, i) => {
                                return (
                                    <div key={i}>
                                        {home.address && (
                                            <div className="mb-2 text-md text-text-primary">
                                                {home.address.street && <p>{home.address.street}</p>}
                                                {cityStateZip(home.address) && <p>{cityStateZip(home.address)}</p>}
                                            </div>
                                        )}
                                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                                            {home.facts.map((fact, j) => (
                                                <div key={j}>
                                                    <p className="text-xs font-medium uppercase tracking-widest text-text-tertiary">
                                                        {fact.label}
                                                    </p>
                                                    <p className="text-md text-text-primary">
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

                {data.alsoKnownAs.length > 0 && (
                    <DataTypeCard icon={CreditCard} title="Also Known As">
                        <div className="flex flex-wrap gap-2">
                            {data.alsoKnownAs.map((alias, i) => (
                                <Badge key={i} color="gray" size="md">{alias}</Badge>
                            ))}
                        </div>
                    </DataTypeCard>
                )}

                {data.pastAddresses.length > 0 && (
                    <DataTypeCard icon={MapPin} title="Past addresses">
                        <LimitedTwoColumnGrid
                            items={data.pastAddresses}
                            renderItem={(addr) => (
                                <div>
                                    {addr.street && (
                                        <p className="text-md text-text-primary">
                                            {addr.street}
                                        </p>
                                    )}
                                    {cityState(addr) && (
                                        <p className="text-data font-normal text-text-secondary">
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
                                <span className="font-mono text-md tabular-nums text-text-primary">
                                    {phone}
                                </span>
                            )}
                        />
                    </DataTypeCard>
                )}

                {data.contact.emails.length > 0 && (
                    <DataTypeCard icon={Mail} title="Emails">
                        <LimitedTwoColumnGrid
                            items={data.contact.emails}
                            renderItem={(email) => (
                                <span className="truncate text-md text-text-primary">{email}</span>
                            )}
                        />
                    </DataTypeCard>
                )}

                {data.education.length > 0 && (
                    <DataTypeCard icon={GraduationCap} title="Education">
                        <ul className="space-y-1">
                            {data.education.map((entry, i) => (
                                <li key={i} className="text-md text-text-primary">
                                    {entry}
                                </li>
                            ))}
                        </ul>
                    </DataTypeCard>
                )}

                {data.legalRecords && (
                    <DataTypeCard icon={Gavel} title="Legal records">
                        <div className="flex flex-wrap gap-2">
                            {data.legalRecords.nationwideCount != null && (
                                <Badge color="gray" size="md">{data.legalRecords.nationwideCount} nationwide</Badge>
                            )}
                            {data.legalRecords.county && (
                                <Badge color="gray" size="md">
                                    {data.legalRecords.countyCount ?? "?"} in {data.legalRecords.county}
                                </Badge>
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
    const [{ data: stored }] = useState(() => loadConsolidatedProfile());

    if (!stored) {
        return (
            <Page className="font-body" role="main" aria-label="Error loading profile">
                <div className="flex min-h-full flex-col items-center justify-center p-4 text-center">
                    <h1 className="mb-2 font-display text-xl font-semibold text-text-primary">No profile data found</h1>
                    <p className="mb-6 text-md text-text-secondary">
                        Nothing came through from this scan — run it again from the start.
                    </p>
                    <Button href="/pilot-scan" size="xl">
                        Start over
                    </Button>
                </div>
            </Page>
        );
    }

    return (
        <Page className="font-body" role="main" aria-label="Pre-profile exposure summary">
            <Navbar
                // Scrolls away with the page, as before (Konsta's default is sticky).
                className="static! mb-6"
                centerTitle
                // Konsta's iOS glass bubble behind the slot isn't token-bridged (literal white); keep the plain button.
                rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
                title={
                    <>
                        <img src={PrimaryLogoDark} alt="Vanyshr" className="h-9 w-auto in-[.light]:hidden" />
                        <img src={PrimaryLogoLight} alt="Vanyshr" className="hidden h-9 w-auto in-[.light]:block" />
                    </>
                }
                right={
                    <button
                        type="button"
                        aria-label="Open menu"
                        className="flex size-11 items-center justify-center rounded-md text-text-primary outline-none hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-border-focus"
                    >
                        <Menu className="size-6" />
                    </button>
                }
            />
            <div className="px-4 pb-12">
                <PreProfileBody profile={stored.profile} />
            </div>
        </Page>
    );
}
