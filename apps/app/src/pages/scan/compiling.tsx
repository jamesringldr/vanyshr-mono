import { useNavigate } from "react-router";
import { QSInfoCard } from "@vanyshr/ui/components/application/qs-info-card/qs-info-card";
import { QSProgressSteps } from "@vanyshr/ui/components/application/qs-progress-steps/qs-progress-steps";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";

const COMPILING_TITLE = "Reduce Scam & Phishing Risk";
const COMPILING_DESCRIPTION =
  "This data is easily available for Hackers, Identity Thieves and Scammers to easily target you and your family with attempts to steal your identity or access your accounts.";

const CANCEL_DISCLAIMER =
  "Canceling your search will completely remove any of your data completely from our system.";

export function QSCompiling() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen w-full flex flex-col bg-[#F0F4F8] dark:bg-[#022136] transition-colors duration-200"
      role="main"
      aria-label="Compiling results"
    >
      {/* Top progress — 3 steps, step 2 active */}
      <div className="px-4 pt-6 pb-4">
        <QSProgressSteps
          totalSteps={3}
          activeStep={2}
          aria-label="Compile progress: step 2 of 3"
        />
      </div>

      {/* Scrollable content — mobile-first */}
      <div className="flex flex-1 flex-col items-center px-4 pb-8 md:px-6">
        {/* Heading */}
        <h1 className="text-center text-xl font-bold text-[#022136] dark:text-white md:text-2xl mt-2 mb-2 max-w-lg">
          We found a broker selling your data!
        </h1>
        <p className="text-center text-sm text-[#B8C4CC] dark:text-[#B8C4CC] md:text-base max-w-lg mb-6 leading-relaxed">
          We are collecting all the data this broker has for you and pinpointing the extent of your exposure and using AI to triangulating how to remove it from this data broker.
        </p>

        {/* Large central icon — PrimaryIcon-outline */}
        <div className="flex justify-center mb-6" aria-hidden>
          <img
            src={PrimaryIconOutline}
            alt=""
            className="h-24 w-24 md:h-28 md:w-28 object-contain opacity-90"
          />
        </div>

        {/* QSInfoCard — scammer.png */}
        <div className="w-full max-w-sm mb-8">
          <QSInfoCard
            iconSrc="/brand/icons/scammer.png"
            title={COMPILING_TITLE}
            description={COMPILING_DESCRIPTION}
          />
        </div>

        {/* Cancel Search — outline button */}
        <button
          type="button"
          onClick={() => navigate("/quick-scan")}
          className="w-full max-w-sm h-[52px] rounded-xl border-2 border-[#022136] dark:border-white bg-transparent text-[#022136] dark:text-white font-semibold text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 hover:opacity-90 active:scale-[0.98]"
          aria-label="Cancel search and return to quick scan"
        >
          Cancel Search
        </button>
        <p className="text-center text-xs text-[#B8C4CC] dark:text-[#B8C4CC] mt-3 max-w-sm">
          {CANCEL_DISCLAIMER}
        </p>
      </div>
    </div>
  );
}
