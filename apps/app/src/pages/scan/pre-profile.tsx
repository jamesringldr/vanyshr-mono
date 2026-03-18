import { useEffect, useState, useCallback } from "react";
import { Link, useParams } from "react-router";
import { useBetaModal } from "@/components/BetaModalContext";
import { motion, useReducedMotion } from "framer-motion";
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
    Zap,
} from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
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
    pastAddresses: Array<{ street: string; cityStateZip: string }>;
    pastPhones: string[];
    employers: string[];
    financialAssets: string[];
    courtRecords: string[];
}

type LoadingState = "loading" | "loaded" | "error";

// Shape of a Zabasearch PersonProfile stored in fullProfile on each zabaMatch
interface ZabaPersonProfile {
    phones?: Array<{ number: string; type?: string; primary?: boolean }>;
    addresses?: Array<{ full_address?: string; street?: string; city?: string; state?: string; zip?: string; is_last_known?: boolean }>;
    relatives?: Array<{ name: string; relationship?: string; age?: string }>;
    aliases?: Array<{ alias: string }>;
    emails?: Array<{ email: string; type?: string }>;
    jobs?: Array<{ company?: string; title?: string; is_current?: boolean }>;
}

interface ZabaMatch {
    id: string;
    name: string;
    age?: string;
    city_state?: string;
    fullProfile?: ZabaPersonProfile;
}

function normalizeName(name: string): string {
    return name.toLowerCase().trim().replace(/[^a-z\s]/g, "");
}

function toProperCase(str: string): string {
    return str.replace(/\b\w/g, c => c.toUpperCase());
}

function formatPhone(num: string): string {
    const digits = num.replace(/\D/g, "").slice(-10);
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return num;
}

function phoneKey(n: string): string {
    return n.replace(/\D/g, "").slice(-10);
}

function addressKey(a: { city?: string; state?: string; zip?: string; full_address?: string }): string {
    const parts = `${a.city || ""}-${a.state || ""}-${a.zip || ""}`.toLowerCase();
    return parts !== "--" ? parts : (a.full_address || "").toLowerCase().slice(0, 40);
}

/** Deduplicate an existing profile's arrays, then merge matching Zabasearch data. */
function mergeZabaData(profile: QuickScanProfileData, selectedProfile: ProfileMatch): QuickScanProfileData {
    // Always deduplicate the existing AnyWho data first
    const seenPhones = new Set<string>();
    const seenAddrs = new Set<string>();
    const seenRelatives = new Set<string>();
    const seenAliases = new Set<string>();
    const seenEmails = new Set<string>();
    const seenJobs = new Set<string>();

    const deduped: QuickScanProfileData = {
        ...profile,
        phones: profile.phones.filter(p => {
            const k = phoneKey(p.number);
            if (!k || seenPhones.has(k)) return false;
            seenPhones.add(k);
            return true;
        }),
        addresses: profile.addresses.filter(a => {
            const k = addressKey(a);
            if (!k || seenAddrs.has(k)) return false;
            seenAddrs.add(k);
            return true;
        }),
        relatives: profile.relatives.filter(r => {
            const k = normalizeName(r.name);
            if (!k || seenRelatives.has(k)) return false;
            seenRelatives.add(k);
            return true;
        }),
        aliases: profile.aliases.filter(a => {
            const k = a.toLowerCase();
            if (!k || seenAliases.has(k)) return false;
            seenAliases.add(k);
            return true;
        }),
        emails: profile.emails.filter(e => {
            const k = e.email.toLowerCase();
            if (!k || seenEmails.has(k)) return false;
            seenEmails.add(k);
            return true;
        }),
        jobs: profile.jobs.filter(j => {
            const k = (j.company || "").toLowerCase();
            if (!k || seenJobs.has(k)) return false;
            seenJobs.add(k);
            return true;
        }),
    };

    // Now pull in Zabasearch data
    const zabaRaw = sessionStorage.getItem("zabaMatches");
    if (!zabaRaw) return deduped;

    let zabaMatches: ZabaMatch[];
    try { zabaMatches = JSON.parse(zabaRaw); } catch { return deduped; }
    if (!zabaMatches?.length) return deduped;

    // Find the best matching Zabasearch entry by name
    const targetName = normalizeName(selectedProfile.name || profile.name);
    const parts = targetName.split(/\s+/);
    const targetFirst = parts[0] || "";
    const targetLast = parts[parts.length - 1] || "";

    const bestMatch = zabaMatches.find(zm => {
        const n = normalizeName(zm.name);
        return n.includes(targetFirst) && n.includes(targetLast);
    }) ?? zabaMatches[0];

    const zaba = bestMatch?.fullProfile;
    if (!zaba) return deduped;

    // Merge phones
    const newPhones = (zaba.phones || [])
        .filter(p => p.number && !seenPhones.has(phoneKey(p.number)))
        .map(p => ({ number: p.number, type: p.type, is_primary: p.primary }));

    // Merge addresses
    const newAddresses = (zaba.addresses || [])
        .filter(a => {
            const k = addressKey({ city: a.city, state: a.state, zip: a.zip, full_address: a.full_address });
            return k && !seenAddrs.has(k);
        })
        .map(a => ({ full_address: a.full_address, street: a.street, city: a.city, state: a.state, zip: a.zip, is_current: a.is_last_known }));

    // Merge relatives
    const newRelatives = (zaba.relatives || [])
        .filter(r => r.name && !seenRelatives.has(normalizeName(r.name)))
        .map(r => ({ name: r.name, relationship: r.relationship, age: r.age }));

    // Merge aliases
    const newAliases = (zaba.aliases || [])
        .map(a => a.alias)
        .filter(a => a && !seenAliases.has(a.toLowerCase()));

    // Merge emails
    const newEmails = (zaba.emails || [])
        .filter(e => e.email && !seenEmails.has(e.email.toLowerCase()))
        .map(e => ({ email: e.email, type: e.type }));

    // Merge jobs
    const newJobs = (zaba.jobs || [])
        .filter(j => j.company && !seenJobs.has(j.company.toLowerCase()))
        .map(j => ({ company: j.company, title: j.title, is_current: j.is_current }));

    return {
        ...deduped,
        phones: [...deduped.phones, ...newPhones],
        addresses: [...deduped.addresses, ...newAddresses],
        relatives: [...deduped.relatives, ...newRelatives],
        aliases: [...deduped.aliases, ...newAliases],
        emails: [...deduped.emails, ...newEmails],
        jobs: [...deduped.jobs, ...newJobs],
        sources: deduped.sources.includes("Zabasearch") ? deduped.sources : [...deduped.sources, "Zabasearch"],
    };
}

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

/**
 * Parse a full address string like "500 E 3rd ST Kansas City, Missouri 64106"
 * into a { street, cityStateZip } pair for two-line display.
 */
function parseFullAddress(fullAddr: string): { street: string; cityStateZip: string } {
    // Match "Street City, State Zip"
    const commaMatch = fullAddr.match(/^(.+),\s*([A-Za-z][A-Za-z\s]+?)\s+(\d{5})\s*$/);
    if (commaMatch) {
        const streetAndCity = commaMatch[1].trim();
        const state = commaMatch[2].trim();
        const zip = commaMatch[3];

        // Try 2-word city: pre-city ends with digit or 2+ uppercase letters and has 3+ tokens
        const twoWord = streetAndCity.match(/^(.+?)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)$/);
        if (twoWord && /(\d|[A-Z]{2,})$/.test(twoWord[1]) && twoWord[1].split(/\s+/).length >= 3) {
            return { street: twoWord[1], cityStateZip: `${twoWord[2]}, ${state} ${zip}` };
        }

        // Try 1-word city: last title-case word
        const oneWord = streetAndCity.match(/^(.+?)\s+([A-Z][a-z]+)$/);
        if (oneWord) {
            return { street: oneWord[1], cityStateZip: `${oneWord[2]}, ${state} ${zip}` };
        }

        return { street: streetAndCity, cityStateZip: `${state} ${zip}` };
    }

    // Fallback: split at last comma
    const lastComma = fullAddr.lastIndexOf(",");
    if (lastComma !== -1) {
        return {
            street: fullAddr.slice(0, lastComma).trim(),
            cityStateZip: fullAddr.slice(lastComma + 1).trim(),
        };
    }

    return { street: fullAddr, cityStateZip: "" };
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
    const rawPrimaryPhone = primaryPhone?.number || selectedProfile?.phone_snippet || "";
    const primaryPhoneStr = rawPrimaryPhone ? formatPhone(rawPrimaryPhone) : "—";

    // Extract location
    const location = selectedProfile?.city_state ||
        (currentAddr ? `${currentAddr.city || ""}, ${currentAddr.state || ""}`.replace(/^, |, $/g, "") : "");

    // Past addresses (non-current)
    const pastAddresses = profile.addresses
        ?.filter(a => !a.is_current)
        .map(a => {
            // Happy path: structured fields available
            if (a.city || a.state) {
                const street = a.street || a.full_address || "";
                const cityPart = [a.city, a.state].filter(Boolean).join(", ");
                const cityStateZip = a.zip ? `${cityPart} ${a.zip}`.trim() : cityPart;
                return { street, cityStateZip };
            }
            // Fallback: only full_address stored — try to parse it
            if (a.full_address) {
                return parseFullAddress(a.full_address);
            }
            return { street: a.street || "", cityStateZip: "" };
        })
        .filter(a => a.street || a.cityStateZip) || [];

    // Past phones (non-primary)
    const pastPhones = profile.phones
        ?.filter(p => !p.is_primary)
        .map(p => formatPhone(p.number))
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
        alsoKnownAs: (profile.aliases || []).map(toProperCase),
        familyAndFriends: profile.relatives?.map(r => ({
            name: toProperCase(r.name),
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
    const { openBetaModal } = useBetaModal();
    const prefersReducedMotion = useReducedMotion();
    const [loadingState, setLoadingState] = useState<LoadingState>("loading");
    const [data, setData] = useState<PreProfileData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [startError, setStartError] = useState<string | null>(null);
    const [isFooterVisible, setIsFooterVisible] = useState(false);
    const [loadingEllipsis, setLoadingEllipsis] = useState(".");

    const [isStarting, setIsStarting] = useState(false);

    const handleStartVanyshing = useCallback(async () => {
        if (!scanId) {
            setStartError("Scan ID is missing. Please go back and try again.");
            return;
        }

        setIsStarting(true);
        setStartError(null);

        try {
            const { data, error } = await supabase.functions.invoke<{
                success: boolean;
                profile_id?: string;
                scan_id?: string;
                error?: string;
            }>("create-pending-profile", {
                body: { scan_id: scanId },
            });

            if (error || !data?.success || !data.profile_id) {
                throw new Error(data?.error ?? error?.message ?? "Failed to start. Please try again.");
            }

            sessionStorage.setItem("pendingScanId", scanId);
            sessionStorage.setItem("pendingProfileId", data.profile_id);
            openBetaModal();
        } catch (err) {
            setStartError(err instanceof Error ? err.message : "Failed to start. Please try again.");
        } finally {
            setIsStarting(false);
        }
    }, [scanId, openBetaModal]);


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
                    const merged = mergeZabaData(detailsData.profile_data, selectedProfile);
                    const preProfileData = convertToPreProfileData(merged, selectedProfile);
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

            const mergedBasic = mergeZabaData(basicProfileData, selectedProfile);
            const preProfileData = convertToPreProfileData(mergedBasic, selectedProfile);
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

    useEffect(() => {
        if (loadingState !== "loaded") {
            setIsFooterVisible(false);
            return;
        }

        const timer = window.setTimeout(() => {
            setIsFooterVisible(true);
        }, 3000);

        return () => window.clearTimeout(timer);
    }, [loadingState]);

    useEffect(() => {
        const frames = [".", "..", "..."];
        const intervalId = window.setInterval(() => {
            setLoadingEllipsis((prev) => {
                const currentIndex = frames.indexOf(prev);
                const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % frames.length;
                return frames[nextIndex];
            });
        }, 420);

        return () => window.clearInterval(intervalId);
    }, []);

    // Loading state
    if (loadingState === "loading") {
        return (
            <div
                className="min-h-screen w-full flex flex-col items-center justify-center bg-[#F0F4F8] dark:bg-[#022136] font-sans transition-colors duration-200"
                role="main"
                aria-label="Loading profile"
            >
                <div className="flex flex-col items-center gap-4 px-6 text-center">
                    <motion.img
                        src={PrimaryIconOutline}
                        alt=""
                        className="h-24 w-24 object-contain opacity-95"
                        aria-hidden
                        animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
                        transition={
                            prefersReducedMotion
                                ? undefined
                                : { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                        }
                    />
                    <p className="text-lg font-medium text-[#022136] dark:text-white font-ubuntu">
                        Compiling your exposure report now
                        <span
                            aria-hidden
                            className="inline-block w-[3ch] text-left"
                        >
                            {loadingEllipsis}
                        </span>
                    </p>
                    <p className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC]">
                        Gathering data from multiple sources
                    </p>
                </div>
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
            <div className="mx-auto max-w-3xl px-4 pb-56 pt-4 sm:pt-6">
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
                    {data.alsoKnownAs.length > 0 && (
                        <DataTypeCard icon={CreditCard} title="Also Known As">
                            <div className="flex flex-wrap gap-2">
                                {data.alsoKnownAs.map((alias, i) => (
                                    <Pill key={i}>{alias}</Pill>
                                ))}
                            </div>
                        </DataTypeCard>
                    )}

                    {/* Family & Friends */}
                    {data.familyAndFriends.length > 0 && (
                        <DataTypeCard icon={Users} title="Family & Friends">
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
                        </DataTypeCard>
                    )}

                    {/* Past addresses */}
                    {data.pastAddresses.length > 0 && (
                        <DataTypeCard icon={MapPin} title="Past addresses">
                            <ul className="space-y-3">
                                {data.pastAddresses.map((addr, i) => (
                                    <li key={i}>
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
                                    </li>
                                ))}
                            </ul>
                        </DataTypeCard>
                    )}

                    {/* Past phone numbers */}
                    {data.pastPhones.length > 0 && (
                        <DataTypeCard icon={Phone} title="Past phone numbers">
                            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                                {data.pastPhones.map((phone, i) => (
                                    <li
                                        key={i}
                                        className="font-mono text-sm tabular-nums text-[var(--text-primary)] dark:text-white"
                                    >
                                        {phone}
                                    </li>
                                ))}
                            </ul>
                        </DataTypeCard>
                    )}

                    {/* Employers */}
                    {data.employers.length > 0 && (
                        <DataTypeCard icon={Building2} title="Employers">
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
                        </DataTypeCard>
                    )}

                    {/* Financial Assets */}
                    {data.financialAssets.length > 0 && (
                        <DataTypeCard icon={Landmark} title="Financial Assets">
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
                        </DataTypeCard>
                    )}

                    {/* Court Records */}
                    {data.courtRecords.length > 0 && (
                        <DataTypeCard icon={Scale} title="Court Records">
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
                        </DataTypeCard>
                    )}
                </div>
            </div>

            {/* Delayed slide-in footer CTA */}
            <footer
                className={cx(
                    "fixed bottom-0 left-0 right-0 z-20 border-t px-8 py-5 text-center sm:px-10",
                    "rounded-t-2xl",
                    "border-[var(--border-subtle)] dark:border-[#2A4A68]",
                    "bg-[#F0F4F8]/80 dark:bg-[#022136]/70",
                    "backdrop-blur-md shadow-[0_-8px_24px_rgba(0,0,0,0.45)]",
                    "transition-all duration-700 ease-out",
                    isFooterVisible
                        ? "translate-y-0 opacity-100"
                        : "translate-y-full opacity-0 pointer-events-none",
                )}
                role="contentinfo"
                aria-label="Sign up footer"
            >
                <div className="mx-auto w-full max-w-3xl flex flex-col items-center gap-3">
                    <p className="text-base font-bold font-ubuntu text-white">
                        Let's Remove This Data
                    </p>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00BFFF]/40 bg-[#00BFFF]/10 px-3 py-1.5 text-xs font-medium font-ubuntu text-[#00BFFF]">
                        <Zap className="h-3.5 w-3.5" aria-hidden />
                        3 mins To Start Removing
                    </span>
                    {startError && (
                        <p className="text-xs text-red-400 text-center">{startError}</p>
                    )}
                    <button
                        type="button"
                        onClick={handleStartVanyshing}
                        disabled={isStarting}
                        className="flex h-[52px] w-full max-w-md items-center justify-center gap-2 rounded-xl px-4 font-semibold text-white outline-none transition bg-[#00BFFF] hover:bg-[#0E9AE8] focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        aria-label="Start Vanyshing for free"
                    >
                        {isStarting ? "Starting…" : "Start Vanyshing for FREE"}
                        {!isStarting && <ArrowRight className="h-5 w-5 shrink-0" aria-hidden />}
                    </button>
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#B8C4CC]">
                        NO CREDIT CARD REQUIRED
                    </p>
                </div>
            </footer>
        </div>
    );
}
