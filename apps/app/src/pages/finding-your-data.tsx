import { useReducedMotion } from "framer-motion";
import { Page } from "konsta/react";
import { useSearchParams } from "react-router";
import { PulseDots, ScanVinnie } from "@vanyshr/ui/components/application/scan-progress-card/scan-progress-card";
import { LiveScan, SCAN_SLIDES } from "./find-my-data-loading";

/**
 * /finding-your-data — the find-my-data flow's scan page. Same live scan and modals as /loading
 * (profile pick, no results, dark-web emails), but while it's still matching the user it shows a
 * large Vinnie with "Matching your profile" instead of the progress card and slides. After a
 * profile is picked it currently falls back to the /loading view (next page still to be designed).
 *
 * ?preview shows the matching view alone, without starting a scan.
 */
export function FindingYourDataPage() {
  const [searchParams] = useSearchParams();
  if (searchParams.has("preview")) return <MatchingProfileView />;
  return <LiveScan slides={SCAN_SLIDES} matchingView={<MatchingProfileView />} />;
}

function MatchingProfileView() {
  const reduceMotion = useReducedMotion();

  return (
    <Page className="flex flex-col items-center justify-center bg-bg-app px-6 font-body" role="main" aria-label="Matching your profile">
      {/* Same Vinnie as the scan status card (h-16), 3x larger. */}
      <ScanVinnie className="h-48 w-48" />
      <h1 role="status" className="m-0 mt-6 text-center text-xl font-bold text-text-primary">
        Matching your profile
      </h1>
      <p className="m-0 mt-2 flex items-center justify-center text-center text-md text-text-secondary">
        Scanning millions of public broker listings
        <PulseDots animated={!reduceMotion} />
      </p>
    </Page>
  );
}
