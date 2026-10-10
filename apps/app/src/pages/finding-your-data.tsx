import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Page } from "konsta/react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Activity,
  ArrowLeft,
  BookOpen,
  Bot,
  Ghost,
  MapPinOff,
  UserX,
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
import binocularsSvg from "@/assets/icons/styled/binoculars-outline.svg?raw";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import {
  LiveScan,
  PHASES,
  REPORT_PATH,
  SCAN_SLIDES,
} from "./find-my-data-loading";

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

  if (preview === "questions")
    return <PickedView activeIndex={1} status="scanning" />;
  if (preview !== null) return <MatchingProfileView />;

  return (
    <LiveScan
      slides={SCAN_SLIDES}
      matchingView={<MatchingProfileView />}
      renderPickedView={(card) => <PickedView {...card} />}
      // Same route with the optional :scanId param, so this doesn't remount the running scan.
      onProfilePicked={(scanId) =>
        navigate(`/finding-your-data/${scanId}`, { replace: true })
      }
    />
  );
}

function MatchingProfileView() {
  const reduceMotion = useReducedMotion();

  return (
    <Page
      className="flex flex-col items-center justify-center bg-temp-blue-test! px-6 font-body"
      role="main"
      aria-label="Matching your profile"
    >
      {/* Same Vinnie as the scan status card (h-16), 3x larger. */}
      <ScanVinnie className="h-48 w-48" />
      <h1
        role="status"
        className="m-0 mt-6 text-center text-xl font-bold text-text-primary"
      >
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

/** A slide with no answer: ink-doodle art, title and copy. Nothing is stored for it. */
interface InfoStep {
  key: string;
  type: "info";
  title: string;
  subtitle?: string;
  artSvg?: string;
  /** Extra content under the copy. */
  body?: ReactNode;
  /** Pin `body` to the bottom of the sheet instead of right under the copy. */
  pinBody?: boolean;
  /** Move on by itself after INFO_ADVANCE_MS, with no Back/Next buttons. */
  autoAdvance?: boolean;
}

// Carousel steps, in order.
const STEPS: readonly (QuestionStep | InfoStep)[] = [
  {
    key: "finding_info",
    type: "info",
    title: "Finding your data",
    subtitle:
      "Scanning thousands of public broker databases to see exactly which ones are sharing your personal information.",
    artSvg: binocularsSvg,
    body: <PrivacyNote />,
    pinBody: true,
    autoAdvance: true,
  },
  {
    key: "more_than_delete_info",
    type: "info",
    title: "We do more than just delete your data",
    body: (
      <FeatureList
        features={[
          {
            icon: Activity,
            title: "Real-Time Removal Progress",
            description:
              'Other platforms hand you sparse "trust us" summaries or only monthly reports. Vanyshr shows the receipts with live detailed statuses for all scans and removals.',
            plan: "All Plans",
          },
          {
            icon: Ghost,
            title: "Data Camouflage",
            highlight: true,
            description:
              "Deletion isn't the whole game. We seed realistic synthetic data into broker profiles so whatever's left about you can't be trusted — by scammers or anyone buying it.",
            plan: "Premium Plans",
          },
          {
            icon: Bot,
            title: "Use your own agent",
            highlight: true,
            description:
              "Connect Vanyshr directly to your model of choice - access full features, create your own workflows, reports or dashboards without ever having opening the Vanyshr app.",
            plan: "Premium Plans",
          },
          {
            icon: UserX,
            title: "Account Janitor",
            description:
              "Connect your email and we'll surface every account you've ever made. You pick the stale ones — we find the privacy policy and file the deletion request for each.",
            plan: "Premium Plan",
          },
          {
            icon: BookOpen,
            title: "Advanced Privacy Playbooks",
            description:
              "Easy to follow step-by-step guides for pro-level anonymity tactics in plain English, not security jargon.",
            plan: "All Plans",
          },
          {
            icon: MapPinOff,
            title: "Street view residence blur",
            description:
              "We submit requests to google to blur your residence from being visible on Google Street View",
            plan: "Pro & Premium Plans",
          },
        ]}
      />
    ),
  },
  {
    key: "reasons_v1",
    title: "What's your reason for trying Vanyshr?",
    subtitle: "Select all that apply",
    type: "multi",
    options: [
      { id: "exposure", label: "See if my data is exposed", icon: ScanSearch },
      {
        id: "identity",
        label: "Protect against hackers/Identity Thieves",
        icon: ShieldAlert,
      },
      {
        id: "spam",
        label: "Stop the Spam calls, texts & emails",
        icon: MessageSquareOff,
      },
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

const EMPHASIS = "font-bold italic text-accent-text";

function PrivacyNote() {
  return (
    <div className="rounded-lg bg-bg-surface p-4">
      <p className="m-0 text-md font-bold text-text-primary">
        Your privacy is paramount
      </p>
      <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-md text-text-secondary">
        <li className="flex gap-2">
          <span
            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <span>
            We <strong className={EMPHASIS}>DO NOT</strong> store your scan
            results unless you create an account
          </span>
        </li>
        <li className="flex gap-2">
          <span
            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <span>
            Your data is <strong className={EMPHASIS}>NEVER</strong> sold or
            used for any marketing - <em>we hate spam too</em>
          </span>
        </li>
      </ul>
    </div>
  );
}

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
  /** Which plans include it. */
  plan: string;
  /** Azure border to call it out. */
  highlight?: boolean;
}

/** One card per feature: icon on the left, title, description and plan level on the right. */
function FeatureList({ features }: { features: readonly Feature[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {features.map(({ icon: Icon, title, description, plan, highlight }) => (
        <li
          key={title}
          className={cx(
            // Transparent border on the rest so every card is the same size.
            "flex gap-3 rounded-lg border bg-bg-surface p-4",
            highlight ? "border-primary" : "border-transparent",
          )}
        >
          <Icon
            className="mt-0.5 size-5 shrink-0 text-text-primary"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="m-0 text-lg font-semibold text-text-primary">
              {title}
            </p>
            <p className="m-0 mt-1 text-md text-text-secondary">
              {description}
            </p>
            <p className="m-0 mt-2 text-sm font-semibold text-primary-text">
              {plan}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// Variants (not inline objects) so the exiting slide reads the current direction via `custom`.
const STEP_VARIANTS = {
  enter: (d: 1 | -1) => ({ opacity: 0, x: 32 * d }),
  center: { opacity: 1, x: 0 },
  exit: (d: 1 | -1) => ({ opacity: 0, x: -32 * d }),
};
const STEP_VARIANTS_REDUCED = {
  enter: { opacity: 0 },
  center: { opacity: 1 },
  exit: { opacity: 0 },
};

// Pause after a single-select pick so the selected state registers before the slide moves on.
const AUTO_ADVANCE_MS = 350;
// How long an info slide stays up before moving to the next step.
const INFO_ADVANCE_MS = 10_000;

/**
 * Stores one answer in quick_scan_responses via the save-scan-response edge function.
 * Fire-and-forget: a failed save must never block the carousel. No-op without a scan id
 * (?preview=questions).
 */
function saveAnswer(
  quickscanId: string | undefined,
  questionKey: string,
  answer: string[],
  skipped: boolean,
) {
  if (!quickscanId) return;
  void supabase.functions
    .invoke("save-scan-response", {
      body: { quickscanId, questionKey, answer, skipped },
    })
    .then(({ error }) => {
      if (error) console.warn("save-scan-response failed:", error.message);
    });
}

function PickedView({
  activeIndex,
  status,
}: {
  activeIndex: number;
  status: "scanning" | "complete";
}) {
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
    const id = window.setTimeout(
      () => navigate(REPORT_PATH, { replace: true }),
      COMPLETE_BEAT_MS,
    );
    return () => window.clearTimeout(id);
  }, [status, navigate]);

  useEffect(() => () => window.clearTimeout(autoAdvanceRef.current), []);

  const step = STEPS[stepIndex];
  const selectedIds = answers[step.key] ?? [];
  const isInfo = step.type === "info";
  const autoAdvances = step.type === "info" && !!step.autoAdvance;
  // No going back to the first step, or into an auto-advancing info slide.
  const prevStep = STEPS[stepIndex - 1];
  const canGoBack =
    !!prevStep && !(prevStep.type === "info" && prevStep.autoAdvance);
  const hasAnswer = selectedIds.length > 0;
  const advance = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  };
  // Auto-advancing info slides move on by themselves. Restarts if the user comes back to one.
  useEffect(() => {
    if (!autoAdvances) return;
    const id = window.setTimeout(advance, INFO_ADVANCE_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoAdvances, stepIndex]);

  const goBack = () => {
    // Cancel a pending single-select auto-advance so it can't fire after going back.
    window.clearTimeout(autoAdvanceRef.current);
    setDirection(-1);
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const choose = (id: string) => {
    if (step.type === "info") return;
    if (step.type === "multi") {
      setAnswers((prev) => {
        const current = prev[step.key] ?? [];
        return {
          ...prev,
          [step.key]: current.includes(id)
            ? current.filter((x) => x !== id)
            : [...current, id],
        };
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

  // Next saves the selection; Skip records an explicit skip. Info slides just move on.
  const nextOrSkip = () => {
    if (!isInfo) saveAnswer(scanId, step.key, selectedIds, !hasAnswer);
    advance();
  };

  return (
    <Page
      className="flex h-dvh flex-col bg-temp-blue-test! font-body"
      role="main"
      aria-label="Scanning in progress"
    >
      <header className="mx-6 shrink-0 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <ScanProgressCard
          phases={PHASES}
          activeIndex={activeIndex}
          status={status}
          bare
          className="w-full"
        />
      </header>

      {/* Question sheet: rounded top corners, runs to the bottom edge under the status on the page blue. */}
      <div className="mt-6 flex min-h-0 flex-1 flex-col rounded-t-lg bg-bg-app">
        <div
          className={cx(
            "min-h-0 flex-1 overflow-y-auto px-6 pt-2.5",
            // Info slides fill the sheet so a pinned body can sit at the bottom; with no footer
            // that's 30px off the bottom edge.
            isInfo && "flex flex-col",
            autoAdvances && "pb-[calc(env(safe-area-inset-bottom,0px)+30px)]",
          )}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.section
              key={step.key}
              custom={direction}
              variants={reduceMotion ? STEP_VARIANTS_REDUCED : STEP_VARIANTS}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                duration: reduceMotion ? 0 : 0.3,
                ease: [0.2, 0, 0, 1],
              }}
              aria-labelledby="fyd-step-title"
              className={cx(isInfo && "flex flex-1 flex-col")}
            >
              {step.type === "info" && step.artSvg && (
                // No tile: white ink, page-colored paper (reads as clear), cyan shadow.
                <div
                  className="mx-auto mb-4 size-40 [--icon-ink:var(--color-text-primary)] [--icon-paper:var(--color-bg-app)] [--icon-shadow:var(--color-primary)] [&>svg]:size-full"
                  aria-hidden
                  dangerouslySetInnerHTML={{ __html: step.artSvg }}
                />
              )}
              <h1
                id="fyd-step-title"
                className="m-0 font-display text-display-xs font-bold leading-tight tracking-tight text-text-primary"
              >
                {step.title}
              </h1>
              {step.subtitle && (
                <p className="m-0 mt-2 text-md text-text-secondary">
                  {step.subtitle}
                </p>
              )}

              {/* Pinned bodies sit at the bottom of the sheet; pt-10 keeps a gap on short screens. */}
              {step.type === "info" && step.body && (
                <div className={step.pinBody ? "mt-auto pt-10" : "mt-6"}>
                  {step.body}
                </div>
              )}

              {step.type !== "info" && (
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
                          selected
                            ? "bg-primary text-primary-on"
                            : "bg-bg-surface text-text-primary active:bg-state-active",
                        )}
                      >
                        <span
                          className={cx(
                            "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-fast",
                            selected
                              ? "bg-primary-on text-primary"
                              : "bg-bg-elevated text-text-primary",
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
              )}
            </motion.section>
          </AnimatePresence>
        </div>
        {/* Auto-advancing info slides have no buttons; they move on by themselves. */}
        {!autoAdvances && (
          <footer className="flex shrink-0 items-center justify-between px-6 pt-4 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
            {/* Back to the previous step; hidden (but holding its space) when there's nowhere to go. */}
            <button
              type="button"
              onClick={goBack}
              aria-label="Previous question"
              disabled={!canGoBack}
              className={cx(
                "flex size-11 items-center justify-center rounded-full bg-bg-surface text-text-primary transition-colors duration-fast",
                "outline-none hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
                !canGoBack && "invisible",
              )}
            >
              <ArrowLeft className="size-5" aria-hidden />
            </button>
            {/* Secondary "Skip" until an answer is picked, then primary "Next" (DESIGN.md §11.1, md size).
                Info slides always show "Next". */}
            <button
              type="button"
              onClick={nextOrSkip}
              className={cx(
                "flex h-12 w-1/2 items-center justify-center gap-2 rounded-full px-5 text-md transition-colors duration-fast",
                "outline-none focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
                hasAnswer || isInfo
                  ? "bg-primary font-bold text-primary-on hover:bg-primary-hover active:bg-primary-active"
                  : "bg-bg-elevated font-semibold text-text-primary hover:bg-state-hover active:bg-state-active",
              )}
            >
              {hasAnswer || isInfo ? (
                "Next"
              ) : (
                <>
                  Skip
                  <ChevronRight className="size-4 shrink-0" aria-hidden />
                </>
              )}
            </button>
          </footer>
        )}
      </div>
    </Page>
  );
}
