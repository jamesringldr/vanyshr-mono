import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Page } from "konsta/react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowLeft,
  ChevronRight,
  EyeOff,
  MessageSquareOff,
  ScanSearch,
  ShieldAlert,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";
import {
  PulseDots,
  ScanProgressCard,
  ScanVinnie,
} from "@vanyshr/ui/components/application/scan-progress-card/scan-progress-card";
import { supabase } from "@/lib/supabase";
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

interface QuestionOption {
  /** Stable id — this is what gets stored, so the label can be reworded freely. */
  id: string;
  label: string;
  icon: LucideIcon;
}

interface QuestionStep {
  /** Stable, versioned key (becomes question_key when answers are stored). */
  key: string;
  title: string;
  subtitle?: string;
  /** multi: toggle any number, advance with Next. single: one pick, auto-advances. */
  type: "multi" | "single";
  options: readonly QuestionOption[];
}

// Carousel steps, in order.
const STEPS: readonly QuestionStep[] = [
  {
    key: "reasons_v1",
    title: "What's your reason for trying Vanyshr?",
    subtitle: "Select all that apply",
    type: "multi",
    options: [
      { id: "exposure", label: "See if my data is exposed", icon: ScanSearch },
      { id: "identity", label: "Protect against hackers/Identity Thieves", icon: ShieldAlert },
      { id: "spam", label: "Stop the Spam calls, texts & emails", icon: MessageSquareOff },
      { id: "privacy", label: "Improve my general privacy", icon: EyeOff },
    ],
  },
  {
    key: "tried_other_tools_v1",
    title: "Have you tried other data removal tools?",
    type: "single",
    options: [
      { id: "yes", label: "Yes", icon: ThumbsUp },
      { id: "no", label: "No", icon: ThumbsDown },
    ],
  },
];

// Variants (not inline objects) so the exiting slide reads the current direction via `custom`.
const STEP_VARIANTS = {
  enter: (d: 1 | -1) => ({ opacity: 0, x: 32 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: 1 | -1) => ({ opacity: 0, x: -32 * d }),
};
const STEP_VARIANTS_REDUCED = { enter: { opacity: 0 }, center: { opacity: 1 }, exit: { opacity: 0 } };

// Pause after a single-select pick so the selected state registers before the slide moves on.
const AUTO_ADVANCE_MS = 350;

/**
 * Stores one answer in quick_scan_responses via the save-scan-response edge function.
 * Fire-and-forget: a failed save must never block the carousel. No-op without a scan id
 * (?preview=questions).
 */
function saveAnswer(quickscanId: string | undefined, questionKey: string, answer: string[], skipped: boolean) {
  if (!quickscanId) return;
  void supabase.functions
    .invoke("save-scan-response", { body: { quickscanId, questionKey, answer, skipped } })
    .then(({ error }) => {
      if (error) console.warn("save-scan-response failed:", error.message);
    });
}

function PickedView({ activeIndex, status }: { activeIndex: number; status: "scanning" | "complete" }) {
  const navigate = useNavigate();
  // Set on the URL when the profile was picked (/finding-your-data/:scanId).
  const { scanId } = useParams();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(0);
  // 1 = moving forward (slides in from the right), -1 = back (slides in from the left).
  const [direction, setDirection] = useState<1 | -1>(1);
  // Answers by step key: selected option ids.
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const autoAdvanceRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (status !== "complete") return;
    const id = window.setTimeout(() => navigate(REPORT_PATH, { replace: true }), COMPLETE_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [status, navigate]);

  useEffect(() => () => window.clearTimeout(autoAdvanceRef.current), []);

  const step = STEPS[stepIndex];
  const selectedIds = answers[step.key] ?? [];
  const hasAnswer = selectedIds.length > 0;
  const advance = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  const goBack = () => {
    // Cancel a pending single-select auto-advance so it can't fire after going back.
    window.clearTimeout(autoAdvanceRef.current);
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const choose = (id: string) => {
    if (step.type === "multi") {
      setAnswers((prev) => {
        const current = prev[step.key] ?? [];
        return { ...prev, [step.key]: current.includes(id) ? current.filter((x) => x !== id) : [...current, id] };
      });
      return;
    }
    setAnswers((prev) => ({ ...prev, [step.key]: [id] }));
    window.clearTimeout(autoAdvanceRef.current);
    // Saved when the slide moves on, so changing your mind inside the pause saves once.
    const key = step.key;
    autoAdvanceRef.current = window.setTimeout(() => {
      saveAnswer(scanId, key, [id], false);
      advance();
    }, AUTO_ADVANCE_MS);
  };

  // Next saves the selection; Skip records an explicit skip.
  const nextOrSkip = () => {
    saveAnswer(scanId, step.key, selectedIds, !hasAnswer);
    advance();
  };

  return (
    <Page className="flex h-dvh flex-col bg-bg-app font-body" role="main" aria-label="Scanning in progress">
      <header className="mx-4 shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <ScanProgressCard phases={PHASES} activeIndex={activeIndex} status={status} className="w-full" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-6">
        {/* Back to the previous question; holds its space on the first one so the title doesn't jump. */}
        <button
          type="button"
          onClick={goBack}
          aria-label="Previous question"
          disabled={stepIndex === 0}
          className={cx(
            "mb-4 flex size-11 items-center justify-center rounded-full bg-bg-surface text-text-primary transition-colors duration-fast",
            "outline-none hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
            stepIndex === 0 && "invisible",
          )}
        >
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section
            key={step.key}
            custom={direction}
            variants={reduceMotion ? STEP_VARIANTS_REDUCED : STEP_VARIANTS}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: reduceMotion ? 0 : 0.3, ease: [0.2, 0, 0, 1] }}
            aria-labelledby="fyd-step-title"
          >
            <h1 id="fyd-step-title" className="m-0 font-display text-display-xs font-bold leading-tight tracking-tight text-text-primary">
              {step.title}
            </h1>
            {step.subtitle && <p className="m-0 mt-2 text-md text-text-secondary">{step.subtitle}</p>}

            <div
              role={step.type === "multi" ? "group" : "radiogroup"}
              aria-labelledby="fyd-step-title"
              className="mt-8 flex flex-col gap-3"
            >
              {step.options.map(({ id, label, icon: Icon }) => {
                const selected = selectedIds.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    role={step.type === "multi" ? "checkbox" : "radio"}
                    aria-checked={selected}
                    onClick={() => choose(id)}
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
          onClick={nextOrSkip}
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
