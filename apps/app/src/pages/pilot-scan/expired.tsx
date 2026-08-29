import { useNavigate } from "react-router";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";

/**
 * Pilot scan expired screen — shown when the scan result has passed its
 * retention window (7 days). Prompts the user to run a new scan.
 */
export function PilotExpiredPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#0B1B2B] px-6 font-ubuntu"
      role="main"
      aria-label="Scan expired"
    >
      <img
        src={PrimaryIcon}
        alt=""
        className="h-16 w-16 object-contain opacity-95"
      />
      <div className="max-w-sm text-center">
        <h1 className="text-2xl font-bold tracking-tight text-white">
          Report expired
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[#94A3B8]">
          Your scan results are kept for 7 days to protect your privacy. This report has
          expired and is no longer available.
        </p>
        <p className="mt-4 text-xs text-[#7A92A8]">
          Run a new scan to check your current exposure.
        </p>
      </div>
      <button
        type="button"
        onClick={() => navigate("/pilot-scan")}
        className="h-12 px-8 rounded-full bg-white text-[#0B1B2B] font-semibold outline-none transition hover:bg-[#E8F7FF] focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0B1B2B]"
      >
        Run new scan
      </button>
    </div>
  );
}
