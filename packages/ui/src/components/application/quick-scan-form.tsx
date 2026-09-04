import { useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";
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
   * UI-only / pilot path: when provided, form submit skips live scraping and
   * calls this with the entered fields instead.
   */
  onPilotSubmit?: (fields: {
    firstName: string;
    lastName: string;
    zipCode: string;
    city: string;
    state: string;
  }) => void | Promise<void>;
  className?: string;
  /** Product name used in the "Your Privacy is Paramount" bullets. Defaults to "QuickScan". */
  scanLabel?: string;
  /** Overrides the startAtPrivacy heading. Defaults to "Is your data exposed? / Run a Quickscan". */
  heading?: ReactNode;
  /** Optional line shown under the startAtPrivacy heading. */
  headingSubtext?: string;
  firstNamePlaceholder?: string;
  /**
   * Optional hint rendered inside the first-name field in place of the plain
   * placeholder (visible only while the field is empty).
   */
  firstNameHint?: ReactNode;
  lastNamePlaceholder?: string;
  autoFocusFirstName?: boolean;
  /** Submit button label. Defaults to "Scan Now". */
  submitButtonText?: string;
  /** Leading clause of the disclaimer under the submit button. Defaults to `By selecting "Scan Now"`. */
  disclaimerLeadIn?: string;
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
    background: "var(--color-accent-primary)",
    width: 4,
    height: 4,
    position: "absolute",
    top,
    left,
    animationName: "qs_loader",
    animationDuration: "675ms",
    animationTimingFunction: "cubic-bezier(0.2, 0, 0, 1)",
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
  className,
  scanLabel = "QuickScan",
  heading = (
    <>
      Is your data exposed?
      <br />
      Run a Quickscan
    </>
  ),
  headingSubtext,
  firstNamePlaceholder = "Legal First Name",
  firstNameHint,
  lastNamePlaceholder = "Legal Last Name",
  autoFocusFirstName = false,
  submitButtonText = "Scan Now",
  disclaimerLeadIn = 'By selecting "Scan Now"',
}: QuickScanFormProps) {
  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  
  // Scan state
  const [view, setView] = useState<"form" | "scanning">("form");
  const [status, setStatus] = useState<"idle" | "looking_up_zip" | "searching" | "complete" | "error">("idle");
  const [, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [locationInfo, setLocationInfo] = useState<{ city: string; state: string } | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState(0);

  // DB scan tracking
  const [scanId, setScanId] = useState<string | null>(null);
  const [zabaSearchDone, setZabaSearchDone] = useState(false);

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

  // Warm up universal-search on mount so it's hot by the time the user submits
  useEffect(() => {
    if (!supabaseClient || onPilotSubmit) return;
    supabaseClient.functions.invoke("universal-search", { body: { ping: true } }).catch(() => {});
  }, [supabaseClient, onPilotSubmit]);

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
      try {
        await onPilotSubmit({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          zipCode,
          city: zipLocation.city,
          state: zipLocation.state,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start scan");
      }
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
  }, [firstName, lastName, zipCode, zipLocation, isFormValid, supabaseClient, onTotalFailure, onPilotSubmit, onProfileSelect]);

  const handleSelectProfile = useCallback(async (profile: QSProfileSummary) => {
    const originalProfile = matches.find(m => m.id === profile.id);
    if (!originalProfile) return;

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
  }, [firstName, lastName, zipCode, locationInfo, onProfileSelect, matches, scanId, zabaSearchDone, supabaseClient]);

  // Called when user rejects all AnyWho results — fall through to residential Zaba on serv01
  const handleNoneOfThese = useCallback(async () => {
    setShowSingleModal(false);
    setShowMultipleModal(false);
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
  }, [firstName, lastName, locationInfo]);

  const isLoading = status === "searching";

  if (view === "scanning") {
    const topCopy = STEP_TOP_COPY[scanStepIndex] ?? STEP_TOP_COPY[0];
    const step = SCAN_STEPS[scanStepIndex] ?? SCAN_STEPS[0];
    return (
      <div className={cx("w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 gap-8 bg-bg-surface", className)}>
        <div className="w-full max-w-sm flex flex-col gap-6">

          {/* Heading + loader/subtext row */}
          <div className="flex flex-col gap-1">
            <h2 className="text-xl font-bold text-white uppercase tracking-wider">
              {topCopy.heading}
            </h2>
            <div className="flex items-center gap-2">
              <SquareLoader />
              <p className="text-text-secondary font-medium animate-pulse">
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
            className="shadow-xl border-border-subtle"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cx("w-full overflow-hidden bg-bg-surface", className)}>

      <div className={cx("flex flex-col gap-6 p-6", startAtPrivacy ? "pt-2" : "pt-8")}>
        {/* Header Section */}
        {!startAtPrivacy && (
          <div className="flex flex-col gap-2 text-center">
            <h1 className="text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary">
              Are you exposed?
            </h1>
            <p className="text-[15px] leading-relaxed text-text-secondary">
              Run a QuickScan to see what<br />personal info is public.
            </p>
            <div className="mt-1 flex justify-center">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-[13px] font-medium text-text-secondary">
                <Zap className="h-3 w-3 text-accent-primary" />
                About 90 seconds
              </span>
            </div>
          </div>
        )}

        {startAtPrivacy && (
          <div className="flex flex-col items-center gap-3 text-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-[13px] font-medium text-text-secondary">
              <Zap className="h-3 w-3 text-accent-primary" />
              Real results in about 3 minutes
            </span>
            <h2 className="text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary">
              {heading}
            </h2>
            {headingSubtext && (
              <p className="text-[15px] leading-relaxed text-text-secondary">
                {headingSubtext}
              </p>
            )}
          </div>
        )}

        {/* Privacy Section */}
        <div className="flex w-full flex-col gap-2">
          <h3 className="text-[15px] font-semibold text-text-primary">
            Your privacy is paramount
          </h3>
          <ul className="flex list-none flex-col gap-2 text-[14px] leading-relaxed text-text-secondary">
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-primary" aria-hidden />
              <span>{scanLabel}s do not create a profile for you</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-primary" aria-hidden />
              <span>We do not save data from your {scanLabel}</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent-primary" aria-hidden />
              <span>{scanLabel} data is never sold, shared, or used to send you marketing</span>
            </li>
          </ul>
        </div>

        <form className="flex w-full flex-col gap-3" onSubmit={handleScan}>
          <div className="relative">
            <input
              type="text"
              placeholder={firstNameHint ? "" : firstNamePlaceholder}
              aria-label={firstNameHint ? firstNamePlaceholder : undefined}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={isLoading}
              autoFocus={autoFocusFirstName}
              className="h-12 w-full rounded-lg border border-border-subtle bg-bg-page px-4 text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary disabled:opacity-50"
            />
            {firstNameHint && !firstName && (
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 whitespace-nowrap text-[15px] text-text-tertiary">
                {firstNameHint}
              </span>
            )}
          </div>

          <div className="relative">
            <input
              type="text"
              placeholder={lastNamePlaceholder}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={isLoading}
              className="h-12 w-full rounded-lg border border-border-subtle bg-bg-page px-4 text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 focus:border-accent-primary focus:ring-1 focus:ring-accent-primary disabled:opacity-50"
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
                "h-12 w-full rounded-lg border bg-bg-page px-4 text-[15px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-150 disabled:opacity-50",
                zipStatus === "invalid"
                  ? "border-error focus:border-error focus:ring-1 focus:ring-error"
                  : "border-border-subtle focus:border-accent-primary focus:ring-1 focus:ring-accent-primary"
              )}
            />
            {zipStatus === "valid" && zipLocation && (
              <p className="px-1 text-[13px] font-medium text-accent-primary">
                {zipLocation.city}, {zipLocation.state}
              </p>
            )}
            {zipStatus === "invalid" && (
              <p className="px-1 text-[13px] font-medium text-error">
                Enter a valid US zip code
              </p>
            )}
            {zipStatus === "checking" && (
              <p className="px-1 text-[13px] text-text-tertiary">Checking zip…</p>
            )}
          </div>

          <div className="mt-2 flex flex-col gap-3">
            <p className="text-center text-[13px] text-text-tertiary">
              No credit card or sign up required
            </p>
            <button
              type="submit"
              disabled={!isFormValid || isLoading}
              className={cx(
                "h-12 w-full rounded-lg text-[16px] font-semibold transition-colors duration-150",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
                isFormValid && !isLoading
                  ? "bg-accent-primary text-brand-ink hover:bg-accent-hover"
                  : "cursor-not-allowed border border-border-subtle bg-bg-page text-text-tertiary"
              )}
            >
              {submitButtonText}
            </button>
          </div>

          <p className="text-center text-[12px] leading-snug text-text-tertiary">
            {disclaimerLeadIn} you agree to<br />Vanyshr&apos;s Terms of Service and Privacy Policy
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
