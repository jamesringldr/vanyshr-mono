import { useEffect, useState, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router";
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
    Loader2,
} from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

// Types matching the backend structures
interface ProfileMatch {
    id: string;
    name: string;
    age?: string;
    city_state?: string;
    phone_snippet?: string;
    detail_link?: string;
    source: string;
}

interface QuickScanProfileData {
    name: string;
    first_name?: string;
    last_name?: string;
    age?: string;
    phones: Array<{
        number: string;
        type?: string;
        provider?: string;
        is_primary?: boolean;
    }>;
    emails: Array<{
        email: string;
        type?: string;
    }>;
    addresses: Array<{
        full_address?: string;
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
        is_current?: boolean;
        years_lived?: string;
    }>;
    relatives: Array<{
        name: string;
        relationship?: string;
        age?: string;
    }>;
    aliases: string[];
    jobs: Array<{
        company?: string;
        title?: string;
        location?: string;
        is_current?: boolean;
    }>;
    assets: Array<{
        type?: string;
        description?: string;
        count?: number;
        estimated_value?: string;
    }>;
    legal_records: Array<{
        record_type?: string;
        description?: string;
        location?: string;
        count?: number;
    }>;
    sources: string[];
}

/** PreProfile page data — summary and per–data-type exposure. */
interface PreProfileData {
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
    familyAndFriends: { name: string; age?: number; relationship?: string }[];
    pastAddresses: string[];
    pastPhones: string[];
    employers: string[];
    financialAssets: string[];
    courtRecords: string[];
}

type LoadingState = "loading" | "loaded" | "error";

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
                "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                className,
            )}
        >
            <div className="flex items-center gap-2">
                <Icon
                    className="h-5 w-5 shrink-0 text-[var(--text-secondary)] dark:text-[#B8C4CC]"
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

// Convert QuickScanProfileData to PreProfileData for display
function convertToPreProfileData(
    profile: QuickScanProfileData,
    selectedProfile?: ProfileMatch
): PreProfileData {
    // Calculate data points
    const phoneCount = profile.phones?.length || 0;
    const addressCount = profile.addresses?.length || 0;
    const relativeCount = profile.relatives?.length || 0;
    const aliasCount = profile.aliases?.length || 0;
    const jobCount = profile.jobs?.length || 0;
    const assetCount = profile.assets?.length || 0;
    const recordCount = profile.legal_records?.length || 0;

    const totalDataPoints = phoneCount + addressCount + relativeCount + aliasCount + jobCount + assetCount + recordCount;

    // Estimate risks based on data exposure
    const scamRisks = Math.min(Math.floor((phoneCount + addressCount) * 3), 30);
    const spamRisks = Math.min(Math.floor(phoneCount * 5 + relativeCount), 35);

    // Find current address
    const currentAddr = profile.addresses?.find(a => a.is_current) || profile.addresses?.[0];
    const currentAddressStr = currentAddr
        ? [currentAddr.street, currentAddr.city && currentAddr.state ? `${currentAddr.city}, ${currentAddr.state}` : currentAddr.full_address]
            .filter(Boolean)
            .join("\n")
        : "—";

    // Find primary phone
    const primaryPhone = profile.phones?.find(p => p.is_primary) || profile.phones?.[0];
    const primaryPhoneStr = primaryPhone?.number || selectedProfile?.phone_snippet || "—";

    // Extract location
    const location = selectedProfile?.city_state ||
        (currentAddr ? `${currentAddr.city || ""}, ${currentAddr.state || ""}`.replace(/^, |, $/g, "") : "");

    // Past addresses (non-current)
    const pastAddresses = profile.addresses
        ?.filter(a => !a.is_current)
        .map(a => a.full_address || `${a.street || ""} ${a.city || ""}, ${a.state || ""} ${a.zip || ""}`.trim())
        .filter(Boolean) || [];

    // Past phones (non-primary)
    const pastPhones = profile.phones
        ?.filter(p => !p.is_primary)
        .map(p => p.number)
        .filter(Boolean) || [];

    // Employers
    const employers = profile.jobs
        ?.map(j => [j.company, j.title].filter(Boolean).join(" - "))
        .filter(Boolean) || [];

    // Financial assets
    const financialAssets = profile.assets
        ?.map(a => [a.description || a.type, a.estimated_value].filter(Boolean).join(" - "))
        .filter(Boolean) || [];

    // Court records
    const courtRecords = profile.legal_records
        ?.map(r => [r.record_type, r.description, r.location].filter(Boolean).join(" - "))
        .filter(Boolean) || [];

    // Parse age from string
    const ageNum = profile.age ? parseInt(profile.age, 10) : (selectedProfile?.age ? parseInt(selectedProfile.age, 10) : null);

    return {
        brokerCount: Math.max(profile.sources?.length || 1, Math.floor(totalDataPoints / 3) + 1),
        totalDataPoints,
        scamRisks,
        spamRisks,
        contact: {
            fullName: profile.name || selectedProfile?.name || "Unknown",
            age: isNaN(ageNum as number) ? null : ageNum,
            location,
            currentAddress: currentAddressStr,
            primaryPhone: primaryPhoneStr,
        },
        alsoKnownAs: profile.aliases || [],
        familyAndFriends: profile.relatives?.map(r => ({
            name: r.name,
            age: r.age ? parseInt(r.age, 10) : undefined,
            relationship: r.relationship,
        })) || [],
        pastAddresses,
        pastPhones,
        employers,
        financialAssets,
        courtRecords,
    };
}

export function PreProfile() {
    const { scanId } = useParams<{ scanId?: string }>();
    const navigate = useNavigate();
    const [loadingState, setLoadingState] = useState<LoadingState>("loading");
    const [data, setData] = useState<PreProfileData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isStarting, setIsStarting] = useState(false);
    const [startError, setStartError] = useState<string | null>(null);

    const handleStartVanyshing = useCallback(async () => {
        if (!scanId) {
            setStartError("Scan ID is missing. Please go back and try again.");
            return;
        }
        setIsStarting(true);
        setStartError(null);
        try {
            const { data: result, error: fnError } = await supabase.functions.invoke<{
                success: boolean;
                profile_id?: string;
                error?: string;
            }>("create-pending-profile", {
                body: { scan_id: scanId },
            });

            if (fnError || !result?.success || !result?.profile_id) {
                throw new Error(result?.error ?? fnError?.message ?? "Failed to create profile");
            }

            // Store profile_id so the auth callback can link it after magic link auth
            sessionStorage.setItem("pendingProfileId", result.profile_id);
            sessionStorage.setItem("pendingScanId", scanId);

            navigate(`/magic-link`);
        } catch (err) {
            console.error("handleStartVanyshing error:", err);
            setStartError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
            setIsStarting(false);
        }
    }, [scanId, navigate]);

    const loadProfileData = useCallback(async () => {
        setLoadingState("loading");
        setError(null);

        try {
            // Try to get selected profile from session storage
            const selectedProfileStr = sessionStorage.getItem("selectedProfile");
            const selectedProfile: ProfileMatch | null = selectedProfileStr
                ? JSON.parse(selectedProfileStr)
                : null;

            if (!selectedProfile) {
                throw new Error("No profile selected. Please go back and select a profile.");
            }

            // If the profile has a detail_link, fetch full details
            if (selectedProfile.detail_link) {
                const { data: detailsData, error: detailsError } = await supabase.functions.invoke<{
                    success: boolean;
                    profile_data?: QuickScanProfileData;
                    error?: string;
                }>("universal-details", {
                    body: {
                        scan_id: scanId ?? undefined,
                        selected_profile: selectedProfile,
                        detailLink: selectedProfile.detail_link,
                        siteName: selectedProfile.source,
                    },
                });

                if (detailsError) {
                    console.error("Error fetching details:", detailsError);
                    // Fall back to basic profile data
                }

                if (detailsData?.success && detailsData.profile_data) {
                    const preProfileData = convertToPreProfileData(detailsData.profile_data, selectedProfile);
                    setData(preProfileData);
                    setLoadingState("loaded");
                    return;
                }
            }

            // If no detail link or fetch failed, create basic profile from selected match
            const basicProfileData: QuickScanProfileData = {
                name: selectedProfile.name,
                age: selectedProfile.age,
                phones: selectedProfile.phone_snippet
                    ? [{ number: selectedProfile.phone_snippet, is_primary: true }]
                    : [],
                emails: [],
                addresses: selectedProfile.city_state
                    ? [{
                        full_address: selectedProfile.city_state,
                        is_current: true,
                    }]
                    : [],
                relatives: [],
                aliases: [],
                jobs: [],
                assets: [],
                legal_records: [],
                sources: [selectedProfile.source],
            };

            const preProfileData = convertToPreProfileData(basicProfileData, selectedProfile);
            setData(preProfileData);
            setLoadingState("loaded");

        } catch (err) {
            console.error("Error loading profile:", err);
            setError(err instanceof Error ? err.message : "Failed to load profile data");
            setLoadingState("error");
        }
    }, [scanId]);

    useEffect(() => {
        loadProfileData();
    }, [loadProfileData]);

    // Loading state
    if (loadingState === "loading") {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
                role="main"
                aria-label="Loading profile"
            >
                <Loader2 className="w-12 h-12 text-[#00BFFF] animate-spin mb-4" />
                <p className="text-lg font-medium text-[#022136] dark:text-white">
                    Compiling your exposure report...
                </p>
                <p className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC] mt-2">
                    Gathering data from multiple sources
                </p>
            </div>
        );
    }

    // Error state
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
                    <h1 className="text-xl font-bold text-[#022136] dark:text-white mb-2">
                        Unable to Load Profile
                    </h1>
                    <p className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC] mb-6">
                        {error || "Something went wrong while loading your profile data."}
                    </p>
                    <Link
                        to="/quick-scan"
                        className="inline-flex h-[44px] items-center justify-center px-6 rounded-xl bg-[#00BFFF] hover:bg-[#1196E0] text-white font-semibold transition-all"
                    >
                        Try Again
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
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--text-primary)] dark:text-white outline-none transition hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:hover:bg-white/10 dark:focus-visible:ring-offset-[#022136]"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </header>

                {/* Primary summary card (hook) */}
                <div
                    className={cx(
                        "rounded-xl border-2 p-5 text-center sm:p-6",
                        "border-[#DC2626] dark:border-[#B91C1C]",
                        "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
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
                            "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
                            "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                        )}
                    >
                        <p className="text-2xl font-bold tabular-nums text-[var(--text-primary)] dark:text-white sm:text-3xl">
                            {data.totalDataPoints}
                        </p>
                        <p className="mt-1 text-[0.9rem] font-bold leading-tight text-[var(--text-secondary)] dark:text-[#B8C4CC]">
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
                            "bg-[var(--bg-surface)] dark:bg-[#2D3847]",
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
                                            {item.relationship && (
                                                <span className="text-[var(--text-muted)] dark:text-[#7A92A8] ml-1">
                                                    ({item.relationship})
                                                </span>
                                            )}
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
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#00BFFF] dark:text-[#00BFFF]">
                        NO CREDIT CARD REQUIRED
                    </p>
                    {startError && (
                        <p className="text-xs text-red-400 text-center">{startError}</p>
                    )}
                    <button
                        type="button"
                        onClick={handleStartVanyshing}
                        disabled={isStarting}
                        className={cx(
                            "flex h-[52px] w-full max-w-md items-center justify-center gap-2 rounded-xl px-4 font-semibold text-white outline-none transition",
                            isStarting
                                ? "bg-[#00BFFF]/60 cursor-not-allowed"
                                : "bg-[#00BFFF] hover:bg-[#0E9AE8]",
                            "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
                        )}
                        aria-label="Start Vanyshing for free"
                    >
                        {isStarting ? "Setting up your profile..." : "Start Vanyshing for FREE"}
                        {!isStarting && <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />}
                    </button>
                </div>
            </footer>
        </div>
    );
}
