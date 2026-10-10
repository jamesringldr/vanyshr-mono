import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Page } from "konsta/react";
import { useNavigate, useSearchParams } from "react-router";
import { ChevronRight, EyeOff, MessageSquareOff, ScanSearch, ShieldAlert, type LucideIcon } from "lucide-react";
import {
  PulseDots,
  ScanProgressCard,
  ScanVinnie,
} from "@vanyshr/ui/components/application/scan-progress-card/scan-progress-card";
import { cx } from "@/utils/cx";
import { LiveScan, PHASES, REPORT_PATH, SCAN_SLIDES } from "./find-my-data-loading";

/**
 * /finding-your-data/:scanId? — the find-my-data flow's scan page. Same live scan and modals as
 * /loading (profile pick, no results, dark-web emails), with its own views:
 * - while still matching the user: a large Vinnie with "Matching your profile";
 * - once a profile is picked ("Yes, this is me"): the URL gains the scan id, the scan status card
 *   sits on top and a carousel of questions fills the page while the rest of the scan runs.
 *
 * ?preview shows the matching view alone; ?preview=questions shows the picked view. Neither scans.
 */
export function FindingYourDataPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview");

  if (preview === "questions") return <PickedView activeIndex={1} status="scanning" />;
  if (preview !== null) return <MatchingProfileView />;

  return (
    <LiveScan
      slides={SCAN_SLIDES}
      matchingView={<MatchingProfileView />}
      renderPickedView={(card) => <PickedView {...card} />}
      // Same route with the optional :scanId param, so this doesn't remount the running scan.
      onProfilePicked={(scanId) => navigate(`/finding-your-data/${scanId}`, { replace: true })}
    />
  );
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

// Beat between the card settling and leaving for the report, so the settled state is seen
// (same as ScanLoadingView).
const COMPLETE_BEAT_MS = 800;

interface ReasonOption {
  id: string;
  label: string;
  icon: LucideIcon;
}

const REASONS: readonly ReasonOption[] = [
  { id: "exposure", label: "See if my data is exposed", icon: ScanSearch },
  { id: "identity", label: "Protect against hackers/Identity Thieves", icon: ShieldAlert },
  { id: "spam", label: "Stop the Spam calls, texts & emails", icon: MessageSquareOff },
  { id: "privacy", label: "Improve my general privacy", icon: EyeOff },
];

// Carousel steps, in order. Each step's answers live in PickedView state for now.
const STEPS = ["reasons"] as const;

function PickedView({ activeIndex, status }: { activeIndex: number; status: "scanning" | "complete" }) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [step, setStep] = useState(0);
  const [reasons, setReasons] = useState<string[]>([]);

  useEffect(() => {
    if (status !== "complete") return;
    const id = window.setTimeout(() => navigate(REPORT_PATH, { replace: true }), COMPLETE_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [status, navigate]);

  const hasAnswer = STEPS[step] === "reasons" ? reasons.length > 0 : false;
  const advance = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));

  const toggleReason = (id: string) =>
    setReasons((prev) => (prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]));

  return (
    <Page className="flex h-dvh flex-col bg-bg-app font-body" role="main" aria-label="Scanning in progress">
      <header className="mx-4 shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <ScanProgressCard phases={PHASES} activeIndex={activeIndex} status={status} className="w-full" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-8">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step}
            initial={reduceMotion ? false : { opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -32 }}
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
            aria-labelledby="fyd-step-title"
          >
            <h1 id="fyd-step-title" className="m-0 font-display text-display-xs font-bold leading-tight tracking-tight text-text-primary">
              What&apos;s your reason for trying Vanyshr?
            </h1>
            <p className="m-0 mt-2 text-md text-text-secondary">Select all that apply</p>

            <div role="group" aria-labelledby="fyd-step-title" className="mt-8 flex flex-col gap-3">
              {REASONS.map(({ id, label, icon: Icon }) => {
                const selected = reasons.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role="checkbox"
                    aria-checked={selected}
                    onClick={() => toggleReason(id)}
                    className={cx(
                      "flex min-h-16 w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-lg font-semibold transition-colors duration-fast",
                      "outline-none focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
                      selected ? "bg-primary text-primary-on" : "bg-bg-surface text-text-primary active:bg-state-active",
                    )}
                  >
                    <span
                      className={cx(
                        "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-fast",
                        selected ? "bg-primary-on text-primary" : "bg-bg-elevated text-text-primary",
                      )}
                      aria-hidden
                    >
                      <Icon className="size-5" />
                    </span>
                    {label}
                  </button>
                );
              })}
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="flex shrink-0 justify-end px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
        {/* Secondary "Skip" until an answer is picked, then primary "Next" (DESIGN.md §11.1, md size). */}
        <button
          type="button"
          onClick={advance}
          className={cx(
            "flex h-12 w-1/2 items-center justify-center gap-2 rounded-full px-5 text-md transition-colors duration-fast",
            "outline-none focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
            hasAnswer
              ? "bg-primary font-bold text-primary-on hover:bg-primary-hover active:bg-primary-active"
              : "bg-bg-elevated font-semibold text-text-primary hover:bg-state-hover active:bg-state-active",
          )}
        >
          {hasAnswer ? (
            "Next"
          ) : (
            <>
              Skip
              <ChevronRight className="size-4 shrink-0" aria-hidden />
            </>
          )}
        </button>
      </footer>
    </Page>
  );
}
