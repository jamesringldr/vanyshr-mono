import { useState, useCallback, useEffect } from "react";
import { User, MapPin, X } from "lucide-react";
import { cx } from "@/utils/cx";
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
}

export interface QuickScanFormProps {
  supabaseClient: any;
  onProfileSelect: (profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }, scanId: string | null) => void;
  onClose?: () => void;
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

export function QuickScanForm({ supabaseClient, onProfileSelect, onClose, className }: QuickScanFormProps) {
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

  // Modal states
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);

  // Validation
  const isFormValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && zipCode.length === 5;

  // No auto-looping for scan steps

  // Map ProfileMatch to QSProfileSummary
  const mapProfile = (p: ProfileMatch): QSProfileSummary => ({
    id: p.id,
    fullName: p.name,
    age: p.age ? parseInt(p.age) : undefined,
    currentAddress: p.city_state ? [p.city_state] : undefined,
    // Add other fields if available in API response
  });

  // Handle the scan
  const handleScan = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setError(null);
    setMatches([]);
    setScanId(null);
    setView("scanning");
    setScanStepIndex(0);

    try {
      setStatus("looking_up_zip");
      const { data: zipData, error: zipError } = await supabaseClient.functions.invoke(
        "zip-lookup",
        { body: { zip_code: zipCode } }
      );

      if (zipError || !zipData) {
        throw new Error(zipError?.message || "Failed to look up zip code");
      }

      setLocationInfo({ city: zipData.city, state: zipData.state_code });
      setStatus("searching");

      const { data: searchData, error: searchError } = await supabaseClient.functions.invoke(
        "universal-search",
        {
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            zipCode,
            state: zipData.state_code,
            city: zipData.city,
            siteName: "AnyWho",
          },
        }
      );

      if (searchError) throw new Error(searchError.message || "Failed to search");

      // Capture the scan_id created by the edge function
      if (searchData?.scan_id) {
        setScanId(searchData.scan_id);
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
    } catch (err) {
      console.error("Scan error:", err);
      setStatus("error");
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setView("form");
      setShowNoResultsModal(true); // Can show error state here if needed
    }
  }, [firstName, lastName, zipCode, isFormValid, supabaseClient]);

  const handleSelectProfile = useCallback(async (profile: QSProfileSummary) => {
    const originalProfile = matches.find(m => m.id === profile.id);
    if (!originalProfile) return;

    // Show step 2: Full Data Scan — run Zabasearch while the animation is visible
    setView("scanning");
    setScanStepIndex(1);

    try {
      const { data: zabaData } = await supabaseClient.functions.invoke(
        "universal-search",
        {
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            state: locationInfo?.state,
            city: locationInfo?.city,
            siteName: "Zabasearch",
            scan_id: scanId,
          },
        }
      );

      if (zabaData?.profiles?.length) {
        sessionStorage.setItem("zabaMatches", JSON.stringify(zabaData.profiles));
      }
    } catch (err) {
      console.error("Zabasearch scan error:", err);
      // Non-fatal — proceed regardless
    }

    onProfileSelect(originalProfile, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      zipCode,
      city: locationInfo?.city || "",
      state: locationInfo?.state || "",
    }, scanId);
  }, [firstName, lastName, zipCode, locationInfo, onProfileSelect, matches, scanId, supabaseClient]);

  const isLoading = status === "looking_up_zip" || status === "searching";

  if (view === "scanning") {
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
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-4xl font-bold text-white leading-[1.1] tracking-tighter">
            Reveal Your Exposure Risk In Seconds.
          </h1>
          <p className="text-[#00BFFF] text-base font-bold leading-snug">
            QuickScans search ~5% of data brokers and ONLY return publicly available data.
          </p>
        </div>

        {/* Privacy Section */}
        <div className="w-full flex flex-col gap-2">
          <h3 className="text-white text-lg font-bold">
            Your Privacy is Paramount
          </h3>
          <ul className="flex flex-col gap-1.5 list-none text-[#B8C4CC] text-base font-normal">
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-1">•</span>
              <span>QuickScans <span className="text-white font-bold italic uppercase">do not</span> Create Profiles for You</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-1">•</span>
              <span>QuickScan Data is <span className="text-white font-bold italic">NEVER</span> Sold, <span className="text-white font-bold italic">NEVER</span> Shared, and <span className="text-white font-bold italic">NEVER</span> Used to Send You Marketing Spam</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#00BFFF] font-bold leading-none mt-1">•</span>
              <span>We <span className="text-white font-bold italic uppercase">do not</span> Save Any Data From Your QuickScan</span>
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

          <div className="relative">
            <input
              type="text"
              inputMode="numeric"
              placeholder="Zip Code"
              maxLength={5}
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
              disabled={isLoading}
              className="h-[52px] w-full rounded-xl border border-[#2A4A68] focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF] px-4 py-3 text-base bg-[#022136]/50 text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-3 mt-2">
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
          onThisIsNotMe={() => {
            setShowSingleModal(false);
            setShowNoResultsModal(true);
          }}
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
          onNoneOfThese={() => {
            setShowMultipleModal(false);
            setShowNoResultsModal(true);
          }}
        />
      )}
    </div>
  );
}
