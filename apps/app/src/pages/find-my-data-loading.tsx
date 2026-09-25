import { useEffect, useState } from "react";
import { Page } from "konsta/react";
import { FileText, Fingerprint, Radar } from "lucide-react";
import { ScanProgressCard } from "@vanyshr/ui/components/application/scan-progress-card/scan-progress-card";

/**
 * /find-my-data/loading — layout preview only. The card is centred while the
 * component is reviewed; carousel and final placement come after sign-off.
 * The phase timer and copy below are placeholders, not the real scan progress.
 */

const PREVIEW_PHASES = [
  { label: "Sweeping broker sites", icon: Radar },
  { label: "Matching listings to you", icon: Fingerprint },
  { label: "Building your report", icon: FileText },
] as const;

const PREVIEW_PHASE_MS = 2500;

// Preview only: /find-my-data/loading?complete shows the settled state.
const PREVIEW_COMPLETE = new URLSearchParams(window.location.search).has("complete");

export function FindMyDataLoadingPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PREVIEW_PHASES.length);
    }, PREVIEW_PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Page className="flex flex-col font-body" role="main" aria-label="Scanning in progress">
      <div className="flex flex-1 items-center justify-center px-4">
        <ScanProgressCard phases={PREVIEW_PHASES} activeIndex={activeIndex} status={PREVIEW_COMPLETE ? "complete" : "scanning"} className="w-full" />
      </div>
    </Page>
  );
}
