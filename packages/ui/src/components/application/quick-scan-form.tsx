import { useState, useCallback, useEffect } from "react";
import { User, MapPin, X, Loader2 } from "lucide-react";
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
  onProfileSelect: (profile: ProfileMatch, searchParams: { firstName: string; lastName: string; zipCode: string; city: string; state: string }) => void;
  onClose?: () => void;
  className?: string;
}

const SCAN_STEPS = [
  {
    title: "Prevent Spam Calls & Texts",
    description: "Predatory companies buy your exposed data from data brokers to relentlessly attempt to sell you unsolicited products.",
    iconSrc: "/brand/icons/spammer.png"
  },
  {
    title: "Secure Your Identity",
    description: "Identity theft starts with a single exposed piece of data. We scan to see what's already out there.",
    iconSrc: "/brand/icons/identity.png"
  },
  {
    title: "Stop Phishing Attacks",
    description: "Scammers use your personal details to craft convincing phishing attempts. Vanyshr helps you vanish from their list.",
    iconSrc: "/brand/icons/phishing.png"
  }
];

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

  // Modal states
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);

  // Validation
  const isFormValid = firstName.trim().length >= 2 && lastName.trim().length >= 2 && zipCode.length === 5;

  // Scanning animation effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (view === "scanning") {
      interval = setInterval(() => {
        setScanStepIndex((prev) => (prev + 1) % SCAN_STEPS.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [view]);

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
            state: zipData.state_code,
            city: zipData.city,
            search_all: true,
          },
        }
      );

      if (searchError) throw new Error(searchError.message || "Failed to search");

      // Artificial delay to ensure user sees the "premium" scanning state
      await new Promise(resolve => setTimeout(resolve, 2000));

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

  const handleSelectProfile = useCallback((profile: QSProfileSummary) => {
    const originalProfile = matches.find(m => m.id === profile.id);
    if (!originalProfile) return;

    onProfileSelect(originalProfile, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      zipCode,
      city: locationInfo?.city || "",
      state: locationInfo?.state || "",
    });
  }, [firstName, lastName, zipCode, locationInfo, onProfileSelect, matches]);

  const isLoading = status === "looking_up_zip" || status === "searching";

  if (view === "scanning") {
    return (
      <div className={cx("w-full h-full min-h-[400px] flex flex-col items-center justify-center p-8 space-y-8 bg-white dark:bg-[#0F2D45]", className)}>
        <div className="w-full max-w-sm space-y-6">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-[#14ABFE] animate-spin" />
            <div className="text-center space-y-1">
              <h2 className="text-xl font-bold text-[#022136] dark:text-white uppercase tracking-wider">
                SCANNING BROKERS
              </h2>
              <p className="text-[#476B84] dark:text-[#A8BFD4] font-medium animate-pulse">
                {status === "looking_up_zip" ? "Identifying your local region..." : "Searching 500+ data sources..."}
              </p>
            </div>
          </div>

          <QSProgressSteps 
            totalSteps={3} 
            activeStep={scanStepIndex + 1} 
            className="w-full"
          />

          <QSInfoCard 
            title={SCAN_STEPS[scanStepIndex].title}
            description={SCAN_STEPS[scanStepIndex].description}
            iconSrc={SCAN_STEPS[scanStepIndex].iconSrc}
            className="shadow-xl border-[#D4DFE8] dark:border-[#2A4A68]"
          />
        </div>
      </div>
    );
  }

  return (
    <div className={cx("w-full bg-white dark:bg-[#0F2D45] rounded-xl overflow-hidden", className)}>
      {/* Header */}
      <div className="p-6 md:p-8 space-y-4 text-center">
        <h1 className="text-2xl md:text-3xl font-bold text-[#022136] dark:text-white tracking-tight">
          See what brokers know about you
        </h1>
        <p className="text-[#476B84] dark:text-[#A8BFD4] text-sm md:text-base leading-relaxed">
          Enter your details to instantly scan top data brokers for your personal information. It's free and takes seconds.
        </p>
      </div>

      {/* Form */}
      <div className="p-6 md:p-8 pt-0">
        <form className="space-y-4" onSubmit={handleScan}>
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#022136] dark:text-white">First Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                disabled={isLoading}
                className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] disabled:opacity-50"
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#022136] dark:text-white">Last Name</label>
            <div className="relative">
              <input
                type="text"
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                disabled={isLoading}
                className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] disabled:opacity-50"
              />
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-[#022136] dark:text-white">Zip Code</label>
            <div className="relative">
              <input
                type="text"
                placeholder="12345"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                disabled={isLoading}
                className="h-[52px] w-full rounded-xl border border-[#D4DFE8] dark:border-[#2A4A68] px-12 py-3 text-sm bg-[#F0F4F8]/50 dark:bg-[#022136]/50 text-[#022136] dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] disabled:opacity-50"
              />
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8]" />
            </div>
          </div>

          <button
            type="submit"
            disabled={!isFormValid || isLoading}
            className={cx(
              "w-full h-[72px] font-bold text-2xl rounded-2xl transition-all shadow-lg active:scale-[0.98] mt-4",
              isFormValid && !isLoading
                ? "bg-[#14ABFE] hover:bg-[#1196E0] text-white"
                : "bg-[#D4DFE8] dark:bg-[#2A4A68] text-[#94A3B8] cursor-not-allowed text-xl"
            )}
          >
            Scan Now
          </button>

          <p className="text-xs text-center text-[#94A3B8] mt-4">
             By clicking "Scan Now", you agree to our Terms of Service and Privacy Policy.
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
