import { useState, useCallback, useEffect } from "react";
import { Zap } from "lucide-react";
import { cx } from "@/utils/cx";
import type { ZabaPhoneResult } from "@vanyshr/shared/types";
import { 
  QSProgressSteps, 
  QSInfoCard, 
  QSResultSingleModal, 
  QSResultMultipleModal, 
  QSNoResultsModal,
  type QSProfileSummary
} from "./index";

// Types for the component
export interface ProfileMatch {
  id: string;
  name: string;
  age?: string;
  city_state?: string;
  phone_snippet?: string;
  detail_link?: string;
  source: string;
  match_score?: number;
  /** Present when profile came from residential zaba service (full card) */
  fullProfile?: Record<string, unknown>;
}

/** Map zaba service card → ProfileMatch used by pre-profile / sessionStorage */
function mapZabaServiceProfiles(data: {
  profiles?: Array<Record<string, any>>;
}): ProfileMatch[] {
  const list = data.profiles || [];
  return list.map((p, i) => ({
    id: String(p.id || `zaba-${i}`),
    name: p.name || "",
    age: p.age != null ? String(p.age) : undefined,
    city_state: p.city_state,
    phone_snippet: p.phone_snippet,
    detail_link: p.detail_link,
    source: "Zabasearch",
    fullProfile: {
      phones: p.phones || [],
      addresses: p.addresses || [],
      relatives: p.relatives || [],
      aliases: p.aliases || [],
      emails: p.emails || [],
    },
  }));
}

type PilotDedupGroup = {
  id: string | null;
  name: string;
  age?: number;
  city: string;
  state: string;
  sources?: string[];
  confidence?: number;
  members?: Array<Record<string, unknown>>;
};

/** Map pilot-scan Phase 1 dedup groups → ProfileMatch for selection modals */
function mapPilotDedupGroups(groups: PilotDedupGroup[]): ProfileMatch[] {
  return groups.map((g, i) => ({
    id: String(g.id || `pilot-group-${i}`),
    name: g.name || "",
    age: g.age != null ? String(g.age) : undefined,
    city_state: [g.city, g.state].filter(Boolean).join(", ") || undefined,
    source: (g.sources || []).join(",") || "pilot",
    match_score: g.confidence,
    fullProfile: {
      sources: g.sources || [],
      members: g.members || [],
      confidence: g.confidence,
      city: g.city,
      state: g.state,
    },
  }));
}

/**
 * Call residential zaba-scraper on serv01 (same pattern as FPS).
 * Not via universal-search — Edge has no Tailscale path.
 *
 * Env (Vite):
 *   VITE_ZABA_SERVICE_URL  e.g. http://serv-01.tail7e9bab.ts.net:8788
 *   VITE_ZABA_SERVICE_TOKEN  optional Bearer for the service
 *
 * When URL is unset (typical public prod), returns empty — no 120s edge hang.
 */
async function runZabaResidentialSearch(params: {
  firstName: string;
  lastName: string;
  city?: string;
  state?: string;
}): Promise<ProfileMatch[]> {
  const base = (import.meta as any).env?.VITE_ZABA_SERVICE_URL as string | undefined;
  const token = (import.meta as any).env?.VITE_ZABA_SERVICE_TOKEN as string | undefined;
  if (!base) {
    console.warn(
      "Zaba residential service URL not configured (VITE_ZABA_SERVICE_URL) — skipping Zaba",
    );
    return [];
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${base.replace(/\/$/, "")}/v1/zaba/search`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      first_name: params.firstName,
      last_name: params.lastName,
      city: params.city || null,
      state: params.state || null,
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    throw new Error(`Zaba service HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.status === "failed") {
    throw new Error(data.error || "zaba service failed");
  }
  return mapZabaServiceProfiles(data);
}

export interface QuickScanFormProps {
  supabaseClient?: any;
  onProfileSelect?: (profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }, scanId: string | null) => void;
  onTotalFailure?: (searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }, originalScanId: string | null) => void;
  onClose?: () => void;
  /** Called when user submits a phone number. Should invoke the phone-lookup edge function. */
  onPhoneLookup?: (phone: string) => Promise<ZabaPhoneResult | { error: string }>;
  /** Hide the "Are you exposed?" header — start at "Your Privacy is Paramount". */
  startAtPrivacy?: boolean;
  /**
   * UI-only path: when provided, form submit skips live scraping and
   * calls this with the entered fields instead.
   */
  onPilotSubmit?: (fields: {
    firstName: string;
    lastName: string;
    zipCode: string;
    city: string;
    state: string;
  }) => void;
  /**
   * `legacy` (default) — universal-search + Zaba fallback.
   * `pilot` — Phase 1/2 via `pilot-scan` edge function (new scraper stack).
   */
  searchMode?: "legacy" | "pilot";
  className?: string;
}

const SCAN_STEPS = [
  {
    title: "Risks of Exposure",
    description: "The more AI improves the harder it is to identify threats...",
  },
  {
    title: "Removal on Autopilot",
    description: "Vanyshr uses a swarm of AI agents to continuously monitor where your data is being shared and automatically begins removing it.",
  },
];

const STEP_TOP_COPY = [
  {
    heading: "SCANNING BROKERS",
    getSubtext: (status: string) =>
      status === "looking_up_zip" ? "Identifying your local region..." : "Finding who has your data...",
  },
  {
    heading: "SCANNING DARK WEB",
    getSubtext: () => "Hunting dark web forums...",
  },
];

function SquareLoader() {
  const sq = (
    left: number,
    top: number,
    delay: string,
    dir: "normal" | "alternate" = "normal"
  ): React.CSSProperties => ({
    background: "#00BFFF",
    width: 4,
    height: 4,
    position: "absolute",
    top,
    left,
    animationName: "qs_loader",
    animationDuration: "675ms",
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationDelay: delay,
    animationDirection: dir,
  });
  return (
    <div style={{ position: "relative", width: 20, height: 20, flexShrink: 0 }}>
      <style>{`@keyframes qs_loader { from { opacity: 0; } to { opacity: 1; } }`}</style>
      <div style={sq(0,  0,  "0ms",   "alternate")} />
      <div style={sq(8,  0,  "75ms",  "alternate")} />
      <div style={sq(16, 0,  "150ms")} />
      <div style={sq(0,  8,  "225ms")} />
      <div style={sq(8,  8,  "300ms")} />
      <div style={sq(16, 8,  "375ms")} />
      <div style={sq(0,  16, "450ms")} />
      <div style={sq(8,  16, "525ms")} />
      <div style={sq(16, 16, "600ms")} />
    </div>
  );
}

export function QuickScanForm({
  supabaseClient,
  onProfileSelect,
  onTotalFailure,
  onClose: _onClose,
  onPhoneLookup,
  startAtPrivacy = false,
  onPilotSubmit,
  searchMode = "legacy",
  className,
}: QuickScanFormProps) {
  const isPilotMode = searchMode === "pilot";

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Scan state
  const [view, setView] = useState<"form" | "scanning">("form");
  const [status, setStatus] = useState<"idle" | "looking_up_zip" | "searching" | "complete" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [locationInfo, setLocationInfo] = useState<{ city: string; state: string } | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState(0);

  // DB scan tracking
  const [scanId, setScanId] = useState<string | null>(null);
  const [zabaSearchDone, setZabaSearchDone] = useState(false);
  const [pilotSessionId] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `pilot-${Date.now()}`,
  );

  // Modal states
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);

  // Zip validation
  const [zipStatus, setZipStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [zipLocation, setZipLocation] = useState<{ city: string; state: string } | null>(null);

  // Call Zippopotam.us directly from the browser — no Edge Function, no bundle cost
  useEffect(() => {
    if (zipCode.length !== 5) {
      setZipStatus("idle");
      setZipLocation(null);
      return;
    }
    setZipStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setZipStatus("invalid");
          setZipLocation(null);
        } else {
          const data = await res.json();
          const place = data.places?.[0];
          if (place) {
            setZipStatus("valid");
            setZipLocation({ city: place["place name"], state: place["state abbreviation"] });
          } else {
            setZipStatus("invalid");
            setZipLocation(null);
          }
        }
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          setZipStatus("invalid");
          setZipLocation(null);
        }
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [zipCode]);

  // Warm up search edge function on mount so it's hot by submit time
  useEffect(() => {
    if (!supabaseClient || onPilotSubmit) return;
    const fn = isPilotMode ? "pilot-scan" : "universal-search";
    supabaseClient.functions.invoke(fn, { body: { ping: true } }).catch(() => {});
  }, [supabaseClient, onPilotSubmit, isPilotMode]);

  // Form is only submittable once zip is confirmed valid
  const isFormValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && zipStatus === "valid" && zipLocation !== null;

  // No auto-looping for scan steps

  // Map ProfileMatch to QSProfileSummary
  const mapProfile = (p: ProfileMatch): QSProfileSummary => ({
    id: p.id,
    fullName: p.name,
    age: p.age ? parseInt(p.age) : undefined,
    currentAddress: p.city_state ? [p.city_state] : undefined,
    // Add other fields if available in API response
  });

  // Handle the scan — zip is already validated, city/state known from zipLocation
  // Silently retries once on scraper failure before calling onTotalFailure
  const handleScan = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid || !zipLocation) return;

    if (onPilotSubmit) {
      onPilotSubmit({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        zipCode,
        city: zipLocation.city,
        state: zipLocation.state,
      });
      return;
    }

    if (!supabaseClient || !onProfileSelect) return;

    setError(null);
    setMatches([]);
    setScanId(null);
    setZabaSearchDone(false);
    setLocationInfo(zipLocation);
    setView("scanning");
    setScanStepIndex(0);
    setStatus("searching");

    const searchParams = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      zipCode,
      city: zipLocation.city,
      state: zipLocation.state,
    };

    // ── Pilot path: Phase 1 via pilot-scan (new scraper stack) ──
    if (isPilotMode) {
      let phase1Data: { success?: boolean; dedup_groups?: PilotDedupGroup[]; error?: string; quick_scan_id?: string } | null = null;
      let lastPilotError = "";

      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { data, error: searchError } = await supabaseClient.functions.invoke(
            "pilot-scan",
            {
              body: {
                firstName: searchParams.firstName,
                lastName: searchParams.lastName,
                zipCode: searchParams.zipCode,
                zipcode: searchParams.zipCode,
                sessionId: pilotSessionId,
              },
            },
          );

          if (searchError) throw new Error(searchError.message || "Failed to search");
          if (data?.error) throw new Error(data.error);

          phase1Data = data;
          break;
        } catch (err) {
          console.error(`Pilot scan attempt ${attempt + 1} error:`, err);
          lastPilotError = err instanceof Error ? err.message : "Failed to search";
        }
      }

      if (!phase1Data?.success) {
        setStatus("error");
        setView("form");
        setError(lastPilotError || "Search failed. Please try again in a moment.");
        // Keep the user in the pilot drawer — don't bounce to legacy /quickscan-error
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1200));

      const groups = phase1Data.dedup_groups || [];
      const profiles = mapPilotDedupGroups(groups);
      setMatches(profiles);
      setScanId(
        (phase1Data as { quick_scan_id?: string }).quick_scan_id ||
          pilotSessionId,
      );
      setStatus("complete");
      setView("form");

      if (profiles.length === 0) {
        setShowNoResultsModal(true);
      } else if (profiles.length === 1) {
        setShowSingleModal(true);
      } else {
        setShowMultipleModal(true);
      }
      return;
    }

    // ── Legacy path: universal-search + Zaba fallback ──
    let lastScanId: string | null = null;
    let searchData: any = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { data, error: searchError } = await supabaseClient.functions.invoke(
          "universal-search",
          {
            body: {
              firstName: searchParams.firstName,
              lastName: searchParams.lastName,
              zipCode: searchParams.zipCode,
              state: searchParams.state,
              city: searchParams.city,
              siteName: "AnyWho",
            },
          }
        );

        if (searchError) throw new Error(searchError.message || "Failed to search");

        if (data?.scan_id) {
          lastScanId = data.scan_id;
          setScanId(data.scan_id);
        }

        if (data?.scraper_failed) {
          // Scraper failed — retry silently on next attempt
          continue;
        }

        searchData = data;
        break;
      } catch (err) {
        console.error(`Scan attempt ${attempt + 1} error:`, err);
        // First attempt: retry. Second attempt: fall through to total failure.
      }
    }

    if (!searchData) {
      // Both attempts failed — surface the error UI
      setStatus("error");
      setView("form");
      onTotalFailure?.(searchParams, lastScanId);
      return;
    }

    // Let step 1 animation breathe before showing modal
    await new Promise(resolve => setTimeout(resolve, 3000));

    setStatus("complete");
    setView("form");

    if (!searchData || searchData.count === 0) {
      setMatches([]);
      setShowNoResultsModal(true);
    } else if (searchData.count === 1) {
      setMatches(searchData.profiles);
      setShowSingleModal(true);
    } else {
      setMatches(searchData.profiles);
      setShowMultipleModal(true);
    }
  }, [firstName, lastName, zipCode, zipLocation, isFormValid, supabaseClient, onTotalFailure, onPilotSubmit, onProfileSelect, isPilotMode, pilotSessionId]);

  const handleSelectProfile = useCallback(async (profile: QSProfileSummary) => {
    const originalProfile = matches.find(m => m.id === profile.id);
    if (!originalProfile) return;

    // ── Pilot path: go straight into pilot splash/loading; enrich on loading page ──
    if (isPilotMode) {
      setShowSingleModal(false);
      setShowMultipleModal(false);
      sessionStorage.setItem("pilotDedupGroupId", originalProfile.id);
      sessionStorage.setItem("pilotSessionId", pilotSessionId);
      onProfileSelect?.(originalProfile, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        zipCode,
        city: locationInfo?.city || "",
        state: locationInfo?.state || "",
      }, pilotSessionId);
      return;
    }

    if (!zabaSearchDone && originalProfile.source !== "AnyWho") {
      // Profile already from Zaba path: fetch rich matches from serv01 (not edge).
      setView("scanning");
      setScanStepIndex(1);

      try {
        const profiles = await runZabaResidentialSearch({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          state: locationInfo?.state,
          city: locationInfo?.city,
        });
        if (profiles.length) {
          sessionStorage.setItem("zabaMatches", JSON.stringify(profiles));
        }
      } catch (err) {
        console.error("Zabasearch scan error:", err);
      }
    } else if (originalProfile.source === "AnyWho") {
      // Clear any stale zabaMatches so pre-profile doesn't merge wrong data
      sessionStorage.removeItem("zabaMatches");
    }

    onProfileSelect?.(originalProfile, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      zipCode,
      city: locationInfo?.city || "",
      state: locationInfo?.state || "",
    }, scanId);
  }, [firstName, lastName, zipCode, locationInfo, onProfileSelect, matches, scanId, zabaSearchDone, supabaseClient, isPilotMode, pilotSessionId]);

  // Called when user rejects all results
  const handleNoneOfThese = useCallback(async () => {
    setShowSingleModal(false);
    setShowMultipleModal(false);

    // Pilot Phase 1 already searched all brokers — no secondary fallback
    if (isPilotMode) {
      setView("form");
      setShowNoResultsModal(true);
      return;
    }

    setView("scanning");
    setScanStepIndex(1);

    try {
      const profiles = await runZabaResidentialSearch({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        state: locationInfo?.state,
        city: locationInfo?.city,
      });

      setZabaSearchDone(true);
      setView("form");

      if (profiles.length) {
        sessionStorage.setItem("zabaMatches", JSON.stringify(profiles));
      }

      if (profiles.length === 1) {
        setMatches(profiles);
        setShowSingleModal(true);
      } else if (profiles.length > 1) {
        setMatches(profiles);
        setShowMultipleModal(true);
      } else {
        setShowNoResultsModal(true);
      }
    } catch (err) {
      console.error("Zabasearch fallback error:", err);
      setZabaSearchDone(true);
      setView("form");
      setShowNoResultsModal(true);
    }
  }, [firstName, lastName, locationInfo, isPilotMode]);

  const isLoading = status === "searching";

  if (view === "scanning") {
    // Pilot flow: keep Vanyshr pilot loading aesthetic (not legacy QuickScan steps)
    if (isPilotMode) {
      return (
        <div
          className={cx(
            "flex min-h-[420px] w-full flex-col items-center justify-center gap-6 bg-[#022136] p-8",
            className,
          )}
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="relative flex h-28 w-28 items-center justify-center">
            <div className="absolute inset-0 animate-pulse rounded-full bg-[#00BFFF]/15" />
            <div className="relative h-14 w-14 animate-spin rounded-full border-2 border-[#00BFFF]/30 border-t-[#00BFFF]" />
          </div>
          <div className="max-w-xs text-center">
            <p className="text-sm text-[#B8C4CC]">Just a moment...</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-white">
              {scanStepIndex === 0
                ? "Scanning people-search sites for your info"
                : "Building your exposure report"}
            </p>
          </div>
        </div>
      );
    }

    const topCopy = STEP_TOP_COPY[scanStepIndex] ?? STEP_TOP_COPY[0];
    const step = SCAN_STEPS[scanStepIndex] ?? SCAN_STEPS[0];
    return (
      <div className={cx("w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 gap-8 bg-[#2D3847]", className)}>
        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* Heading + loader/subtext row */}
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">
              {topCopy.heading}
            </h2>
            <div className="flex items-center gap-2">
              <SquareLoader />
              <p className="text-[#B8C4CC] font-medium animate-pulse">
                {topCopy.getSubtext(status)}
              </p>
            </div>
          </div>

          <QSProgressSteps
            totalSteps={2}
            activeStep={scanStepIndex + 1}
            className="w-full"
          />

          <QSInfoCard
            title={step.title}
            description={step.description}
            className="shadow-xl border-[#2A4A68]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cx("w-full bg-[#2D3847] rounded-xl overflow-hidden", className)}>

      <div className="p-6 pt-8 flex flex-col gap-6">
        {/* Header Section */}
        {!startAtPrivacy && (
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-4xl font-bold text-white leading-[1.1] tracking-tighter">
              Are you exposed?
            </h1>
            <p className="text-sm font-light text-[#B8C4CC] leading-snug">
              Run a QuickScan to see what<br />personal info is public.
            </p>
            <div className="flex justify-center mt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#022136] border border-[#2A4A68] text-[#00BFFF] text-xs font-medium">
                <Zap className="w-3 h-3 fill-[#00BFFF]" />
                90 seconds to see your risks
              </span>
            </div>
          </div>
        )}

        {/* Privacy Section */}
        <div className="w-full flex flex-col gap-2">
          <h3 className="text-white text-lg font-bold">
            Your Privacy is Paramount
          </h3>
          <ul className="flex flex-col gap-1.5 list-none text-[#B8C4CC] text-sm font-normal">
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-0.5">•</span>
              <span>QuickScans <span className="text-white font-bold italic uppercase">do not</span> Create Profiles for You</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-0.5">•</span>
              <span>We <span className="text-white font-bold italic uppercase">do not</span> Save Any Data From Your QuickScan</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-0.5">•</span>
              <span>QuickScan Data is <span className="text-white font-bold italic">NEVER</span> Sold, <span className="text-white font-bold italic">NEVER</span> Shared, and <span className="text-white font-bold italic">NEVER</span> Used to Send You Marketing Spam</span>
            </li>
          </ul>
        </div>

        <form className="w-full flex flex-col gap-4" onSubmit={handleScan}>
          <div className="relative">
            <input
              type="text"
              placeholder="Legal First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              className="h-[52px] w-full rounded-xl border border-[#2A4A68] focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF] px-4 py-3 text-base bg-[#022136]/50 text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 disabled:opacity-50"
            />
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder="Legal Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              className="h-[52px] w-full rounded-xl border border-[#2A4A68] focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF] px-4 py-3 text-base bg-[#022136]/50 text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Zip Code"
              maxLength={5}
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              disabled={isLoading}
              className={cx(
                "h-[52px] w-full rounded-xl border px-4 py-3 text-base bg-[#022136]/50 text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 disabled:opacity-50",
                zipStatus === "invalid"
                  ? "border-red-500 focus:border-red-500 focus:ring-1 focus:ring-red-500"
                  : "border-[#2A4A68] focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF]"
              )}
            />
            {zipStatus === "valid" && zipLocation && (
              <p className="text-[#00BFFF] text-xs font-medium px-1">
                {zipLocation.city}, {zipLocation.state}
              </p>
            )}
            {zipStatus === "invalid" && (
              <p className="text-red-400 text-xs font-medium px-1">
                Invalid zip. Please use a valid Zip Code.
              </p>
            )}
            {zipStatus === "checking" && (
              <p className="text-[#7A92A8] text-xs px-1">Checking...</p>
            )}
          </div>

          <div className="flex flex-col gap-3 mt-2">
            {error && (
              <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-center text-xs font-medium text-red-300">
                {error}
              </p>
            )}
            <p className="text-[#00BFFF] text-xs text-center font-bold">
              No Credit Card or Sign Up Required to See Results
            </p>
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={cx(
                "w-full h-[52px] font-bold text-base rounded-xl transition-all duration-150 shadow-md active:scale-[0.98]",
                isFormValid && !isLoading
                  ? "bg-[#00BFFF] hover:bg-[#00D4FF] active:bg-[#0099CC] text-[#022136] active:text-white"
                  : "bg-[#4A5568] text-[#7A92A8] cursor-not-allowed"
              )}
            >
              Scan Now
            </button>
          </div>

          <p className="text-xs text-center text-[#7A92A8] leading-tight">
            By selecting "Scan Now" you agree to<br />Vanyshr's Terms of Service and Privacy Policy
          </p>
        </form>
      </div>

      {/* Result Modals */}
      <QSNoResultsModal
          isOpen={showNoResultsModal}
          onOpenChange={setShowNoResultsModal}
          searchName={`${firstName} ${lastName}`}
          onPhoneLookup={onPhoneLookup}
          onScanAgain={(type, value) => {
            if (type === "first") setFirstName(value);
            else setLastName(value);
          }}
      />

      {matches.length === 1 && (
        <QSResultSingleModal 
          isOpen={showSingleModal}
          onOpenChange={setShowSingleModal}
          profile={mapProfile(matches[0])}
          region={locationInfo?.city}
          onThisIsMe={handleSelectProfile}
          onThisIsNotMe={handleNoneOfThese}
        />
      )}

      {matches.length > 1 && (
        <QSResultMultipleModal 
          isOpen={showMultipleModal}
          onOpenChange={setShowMultipleModal}
          searchName={`${firstName} ${lastName}`}
          region={locationInfo?.city}
          profiles={matches.map(mapProfile)}
          onProfileSelect={handleSelectProfile}
          onNoneOfThese={handleNoneOfThese}
        />
      )}
    </div>
  );
}
