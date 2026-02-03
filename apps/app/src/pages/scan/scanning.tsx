import { useNavigate } from "react-router";
import { QSInfoCard } from "@vanyshr/ui/components/application/qs-info-card/qs-info-card";
import { QSProgressSteps } from "@vanyshr/ui/components/application/qs-progress-steps/qs-progress-steps";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

const CANCEL_DISCLAIMER =
  "Canceling your search will completely remove any of your data completely from our system.";

export function QSScanning() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-[#F0F4F8] dark:bg-[#022136] transition-colors duration-200"
      role="main"
      aria-label="Scanning in progress"
    >
      {/* Top progress — 3 steps, step 1 active */}
      <div className="px-4 pt-6 pb-4">
        <QSProgressSteps
          totalSteps={3}
          activeStep={1}
          aria-label="Scan progress: step 1 of 3"
        />
      </div>

      {/* Scrollable content — mobile-first */}
      <div className="flex flex-1 flex-col items-center px-4 pb-8 md:px-6">
        {/* Heading */}
        <h1 className="text-center text-xl font-bold text-[#022136] dark:text-white md:text-2xl mt-2 mb-2 max-w-lg">
          Prowling the deepest parts of the web to find who has your data...
        </h1>
        <p className="text-center text-sm text-[#476B84] dark:text-[#A8BFD4] md:text-base max-w-lg mb-6 leading-relaxed">
          We are targeting known data brokers and crawling their databases to identify if they have your data and exactly what data they have..
        </p>

        {/* Large central icon — PrimaryIcon-outline */}
        <div className="flex justify-center mb-6" aria-hidden>
          <img
            src={PrimaryIconOutline}
            alt=""
            className="h-24 w-24 md:h-28 md:w-28 object-contain opacity-90"
          />
        </div>

        {/* QSInfoCard — spammer.png */}
        <div className="w-full max-w-sm mb-8">
          <QSInfoCard iconSrc="/brand/icons/spammer.png" />
        </div>

        {/* Cancel Search — outline button */}
        <button
          type="button"
          onClick={() => navigate("/quick-scan")}
          className="w-full max-w-sm h-[52px] rounded-xl border-2 border-[#022136] dark:border-white bg-transparent text-[#022136] dark:text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#14ABFE] focus-visible:ring-offset-2 hover:opacity-90 active:scale-[0.98]"
          aria-label="Cancel search and return to quick scan"
        >
          Cancel Search
        </button>
        <p className="text-center text-xs text-[#476B84] dark:text-[#A8BFD4] mt-3 max-w-sm">
          {CANCEL_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
