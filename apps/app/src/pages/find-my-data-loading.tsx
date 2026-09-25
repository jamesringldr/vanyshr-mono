import { useEffect, useState } from "react";
import { Binoculars, FileText, FileX, Fingerprint, Ghost, Radar, Receipt, ScanEye, ShieldCheck } from "lucide-react";
import { ScanLoadingView, type ScanSlide } from "@/components/ScanLoadingView";

/**
 * /find-my-data/loading — the slide copy below is final; the phase timer and
 * phase copy are placeholders, not the real scan state. Preview flags: ?complete shows the settled state,
 * ?fast advances slides every 4s so the carousel can be seen without waiting,
 * ?empty passes no slides (intro only, no dots).
 */

const PREVIEW_PHASES = [
  { label: "Sweeping broker sites", icon: Radar },
  { label: "Matching listings to you", icon: Fingerprint },
  { label: "Building your report", icon: FileText },
] as const;

const SCAN_SLIDES: ScanSlide[] = [
  { icon: ShieldCheck, headline: "Secure", sub: "Serious protection, minus the complexity." },
  { icon: Radar, headline: "Scan", sub: "We scan 1000s of brokers & dark web forums to find your data." },
  {
    icon: ScanEye,
    headline: "Show",
    sub: "We show you your real data and exactly where it's listed — totally free",
    note: "(Not just teased behind a paywall)",
  },
  { icon: FileX, headline: "Shred", sub: "Our agents are deployed to shred the profiles they built on you." },
  { icon: Ghost, headline: "Stuff", sub: "We stuff their files with synthetic data they can't trust." },
  {
    icon: Binoculars,
    headline: "Scout",
    sub: "We continuously scout out any new data that pops up and our agents automatically remove it.",
  },
  {
    icon: Receipt,
    headline: "Supervise",
    sub: "Every removal status and progress is backed by a receipt so you can supervise our work.",
  },
];

const PREVIEW_PHASE_MS = 2500;

const params = new URLSearchParams(window.location.search);
const PREVIEW_COMPLETE = params.has("complete");
const PREVIEW_FAST = params.has("fast");
const PREVIEW_EMPTY = params.has("empty");

export function FindMyDataLoadingPage() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % PREVIEW_PHASES.length);
    }, PREVIEW_PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <ScanLoadingView
      slides={PREVIEW_EMPTY ? [] : SCAN_SLIDES}
      autoAdvanceMs={PREVIEW_FAST ? 4000 : undefined}
      phases={PREVIEW_PHASES}
      activeIndex={activeIndex}
      status={PREVIEW_COMPLETE ? "complete" : "scanning"}
      onComplete={() => console.info("[preview] onComplete fired — parent would navigate to results here")}
    />
  );
}
