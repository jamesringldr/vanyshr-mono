import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Page } from "konsta/react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import {
  Activity,
  BookOpen,
  Bot,
  Eye,
  Fingerprint,
  Megaphone,
  Terminal,
  Ghost,
  MapPinOff,
  UserX,
  EyeOff,
  FileCheck,
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
import binocularsSvg from "@/assets/icons/soft-solid/binoculars.svg?raw";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";
import { EASE_OUT, scanUi } from "./self-scan/chrome";
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
 * ?preview shows the matching view alone; ?preview=questions shows the picked view; ?preview=complete
 * shows it finished, with the See My Data drawer. None of them scan.
 */
export function FindingYourDataPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preview = searchParams.get("preview");

  if (preview === "questions")
    return <PickedView activeIndex={1} status="scanning" />;
  if (preview === "complete")
    return <PickedView activeIndex={PHASES.length - 1} status="complete" />;
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

// Who finds the data brokers publish (matching view).
const DATA_SEEKERS: readonly { label: string; icon: LucideIcon }[] = [
  { label: "Identity Thieves", icon: Fingerprint },
  { label: "Spammers", icon: Megaphone },
  { label: "Hackers", icon: Terminal },
  { label: "Stalkers", icon: Eye },
];

function DataBrokersNote() {
  return (
    <div className="rounded-lg bg-bg-surface p-4 short:p-3">
      <h2 className="m-0 text-left text-(length:--fluid-12) font-bold text-text-primary">
        They put you at risk of:
      </h2>
      <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-x-6 gap-y-3 p-0 short:mt-3 short:gap-y-2">
        {DATA_SEEKERS.map(({ label, icon: Icon }) => (
          <li
            key={label}
            className="flex items-center gap-3 text-(length:--fluid-14) font-semibold text-text-primary"
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function MatchingProfileView() {
  const reduceMotion = useReducedMotion();

  return (
    <Page
      // Top-aligned with Vinnie inside the top ~40% of the screen (18dvh + his 192px).
      className="flex flex-col items-center bg-bg-app! px-6 pt-[18dvh] font-body"
      role="main"
      aria-label="Matching your profile"
    >
      {/* Same Vinnie as the scan status card (h-16), ~2.4x larger. */}
      <ScanVinnie className="h-38.5 w-38.5" />
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

      <div className="mt-10 w-full">
        <PrivacyNote />
      </div>
    </Page>
  );
}

// The shared scan phases plus a final "ready" row that only this page shows, once the scan is done.
const CARD_PHASES = [
  ...PHASES,
  {
    label: "Exposure Scan Complete",
    detail: "Your data is ready!",
    icon: FileCheck,
  },
] as const;

// Beat between the card settling (the check animation) and the drawer sliding in.
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

/** A slide with no answer: title and copy, optionally an icon before the title. Nothing is stored for it. */
interface InfoStep {
  key: string;
  type: "info";
  title: string;
  subtitle?: string;
  /** Soft-solid SVG (currentColor), shown in cyan before the title. */
  iconSvg?: string;
  /** Extra content under the copy. */
  body?: ReactNode;
}

// Carousel steps, in order.
const STEPS: readonly (QuestionStep | InfoStep)[] = [
  {
    key: "finding_info",
    type: "info",
    title: "Hunting for your data",
    subtitle:
      "We are scanning millions of data broker records to show you exactly which ones are exposing your personal info.",
    iconSvg: binocularsSvg,
    body: <FindingInfoBody />,
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

const EMPHASIS = "font-bold italic text-text-primary";

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
        <li className="flex gap-2">
          <span
            className="mt-2 size-1.5 shrink-0 rounded-full bg-primary"
            aria-hidden
          />
          <span>
            Your results are completely{" "}
            <strong className={EMPHASIS}>WIPED</strong> from our servers after 5
            minutes
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
  /** Free = on every plan; Premium = paid plans only. Drives the pill color. */
  plan: "Free" | "Premium";
  /** Azure border to call it out. */
  highlight?: boolean;
}

// Plan pill colors: green for Free, azure for Premium.
const PLAN_PILL: Record<Feature["plan"], string> = {
  Free: "border-status-success-border bg-status-success-muted text-status-success",
  Premium: "border-primary-border bg-primary-muted text-primary-text",
};

/** Distance between the starts of two neighboring slides (card width plus gap). */
function slideStep(track: HTMLElement) {
  const first = track.children[0] as HTMLElement | undefined;
  const second = track.children[1] as HTMLElement | undefined;
  return first && second
    ? second.offsetLeft - first.offsetLeft
    : track.clientWidth;
}

/**
 * Swipeable feature cards (native scroll-snap, the next card peeks in) with pagination dots below.
 * The track runs to the screen edges so cards slide off the screen, not off the page margin, and
 * has 4px of padding above and below: an overflow-x scroller also clips vertically, which was
 * shaving the cards' 1px bottom borders (most visible on the cyan-outlined ones).
 */
function FeatureCarousel({ features }: { features: readonly Feature[] }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const reduceMotion = useReducedMotion();
  const [page, setPage] = useState(0);

  function handleScroll(e: React.UIEvent<HTMLUListElement>) {
    const el = e.currentTarget;
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2;
    setPage(
      atEnd ? features.length - 1 : Math.round(el.scrollLeft / slideStep(el)),
    );
  }

  function goTo(index: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({
      left: index * slideStep(el),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }

  return (
    <>
      <ul
        ref={trackRef}
        onScroll={handleScroll}
        className="-mx-6 mt-2 flex list-none snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto px-6 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {features.map(({ icon: Icon, title, description, plan, highlight }) => (
          <li key={title} className="w-11/12 shrink-0 snap-start">
            <div
              className={cx(
                // Transparent border on the rest so every card is the same size.
                "flex h-full gap-3 rounded-lg border bg-bg-surface p-4 short:p-3",
                highlight ? "border-primary" : "border-transparent",
              )}
            >
              <Icon
                className="mt-0.5 size-4 shrink-0 text-text-primary"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="m-0 text-(length:--fluid-12) font-semibold text-text-primary">
                    {title}
                  </p>
                  <span
                    className={cx(
                      "shrink-0 rounded-full border px-2 py-0.5 text-(length:--fluid-11) font-semibold leading-none",
                      PLAN_PILL[plan],
                    )}
                  >
                    {plan}
                  </span>
                </div>
                <p className="m-0 mt-1 text-(length:--fluid-12) text-text-secondary">
                  {description}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {/* Pagination, right under the cards: 6px dots, the active one a 20px pill, on a tight pitch. */}
      <div
        className="flex justify-center"
        role="group"
        aria-label="Feature pages"
      >
        {features.map(({ title }, i) => (
          <button
            key={title}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Show ${title}`}
            aria-current={i === page}
            className="flex h-10 items-center justify-center px-[3px] outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
          >
            <span
              className={cx(
                "h-1.5 rounded-full transition-all duration-fast",
                i === page ? "w-5 bg-primary" : "w-1.5 bg-border-strong",
              )}
            />
          </button>
        ))}
      </div>
    </>
  );
}

const FEATURES: readonly Feature[] = [
  {
    icon: Activity,
    title: "Real-Time Removal Progress",
    description:
      'Other platforms hand you sparse "trust us" summaries or only monthly reports. Vanyshr shows the receipts with live detailed statuses for all scans and removals.',
    plan: "Free",
  },
  {
    icon: Ghost,
    title: "Data Camouflage",
    highlight: true,
    description:
      "Deletion isn't the whole game. We seed realistic synthetic data into broker profiles so whatever's left about you can't be trusted — by scammers or anyone buying it.",
    plan: "Premium",
  },
  {
    icon: Bot,
    title: "Use Your Own Agent",
    highlight: true,
    description:
      "Connect Vanyshr directly to your model of choice - access full features, create your own workflows, reports or dashboards without ever opening the Vanyshr app.",
    plan: "Premium",
  },
  {
    icon: UserX,
    title: "Account Janitor",
    description:
      "Connect your email and we'll surface every account you've ever made. You pick the stale ones — we find the privacy policy and file the deletion request for each.",
    plan: "Premium",
  },
  {
    icon: BookOpen,
    title: "Advanced Privacy Playbooks",
    description:
      "Easy to follow step-by-step guides for pro-level anonymity tactics in plain English, not security jargon.",
    plan: "Free",
  },
  {
    icon: MapPinOff,
    title: "Street View Residence Blur",
    description:
      "We submit requests to Google to blur your residence from being visible on Google Street View.",
    plan: "Premium",
  },
];

/**
 * First info slide's body: the data-brokers card, then the "more than delete" pitch with the
 * feature cards as a carousel.
 */
function FindingInfoBody() {
  return (
    <>
      <DataBrokersNote />
      <h2 className="m-0 mt-8 text-(length:--fluid-14) short:mt-6 font-bold leading-tight text-text-primary">
        We do more than just delete your data
      </h2>
      <FeatureCarousel features={FEATURES} />
    </>
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

  // The finished scan waits for a tap (See My Data) rather than jumping to the report.
  const [drawerOpen, setDrawerOpen] = useState(false);
  useEffect(() => {
    if (status !== "complete") return;
    const id = window.setTimeout(() => setDrawerOpen(true), COMPLETE_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  useEffect(() => () => window.clearTimeout(autoAdvanceRef.current), []);

  const step = STEPS[stepIndex];
  const selectedIds = answers[step.key] ?? [];
  const isInfo = step.type === "info";
  const advance = () => {
    setDirection(1);
    setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
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

  return (
    <Page
      className="flex h-dvh flex-col bg-bg-app! font-body"
      role="main"
      aria-label="Scanning in progress"
    >
      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={cx(
            "flex min-h-0 flex-1 flex-col overflow-y-auto",
            "pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] short:pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]",
            "pb-6",
          )}
        >
          <div
            className={cx(
              "px-6",
              // Info slides fill the space so the body's own scroll box gets the remaining height.
              isInfo && "flex min-h-0 flex-1 flex-col",
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
                className={cx(
                  "fluid-type",
                  isInfo && "flex min-h-0 flex-1 flex-col",
                )}
              >
                <div className="flex items-center gap-3">
                  {step.type === "info" && step.iconSvg && (
                    // Bare cyan glyph, no tile.
                    <div
                      className="size-6.5 shrink-0 text-primary [&>svg]:size-full"
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: step.iconSvg }}
                    />
                  )}
                  <h1
                    id="fyd-step-title"
                    className={cx(
                      "m-0 font-display font-bold leading-tight tracking-tight text-text-primary",
                      "text-(length:--fluid-24)",
                    )}
                  >
                    {step.title}
                  </h1>
                </div>
                {step.subtitle && (
                  <p className="m-0 mt-2 text-(length:--fluid-14) text-text-secondary">
                    {step.subtitle}
                  </p>
                )}

                {step.type === "info" && step.body && (
                  <div className="mt-4 flex min-h-0 flex-1 flex-col">
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
        </div>
      </div>

      {/* Status card at the bottom of the page layout (not floating over it), so the scrolling area
          above ends where the card begins and nothing is hidden behind it. Once the scan is done
          the See My Data drawer grows in beneath it and the card rides up. */}
      <div className="relative z-30 flex shrink-0 flex-col">
        {/* Blur that fades in from the top (HIG bar material): content softens as it nears the
            card with no hard edge. Sits over the bottom 40px of the scroller, pointer-events-none
            so it never eats scrolls. The gradient alone is the fallback where backdrop-filter is off. */}
        <div
          className={cx(
            "pointer-events-none absolute inset-x-0 bottom-full h-10 backdrop-blur-xl",
            "bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--color-bg-page)_55%,transparent)_45%,color-mix(in_srgb,var(--color-bg-page)_92%,transparent))]",
            "[-webkit-mask-image:linear-gradient(to_bottom,transparent,black_45%)] [mask-image:linear-gradient(to_bottom,transparent,black_45%)]",
          )}
          aria-hidden
        />
        <div className="fluid-type relative px-4 pt-2 pb-3">
          <ScanProgressCard
            phases={CARD_PHASES}
            // Done: land on the last row ("Your Exposure Report is Ready").
            activeIndex={
              status === "complete" ? CARD_PHASES.length - 1 : activeIndex
            }
            status={status}
            largeActive
            dense
            title="Exposure Scan in progress"
            successOnComplete
            fluid
            // Card on bg-app at 80% opacity; the tracer stays.
            className="w-full bg-bg-app/80!"
          />
        </div>
        {/* Same drawer as the report page's CTA (no title): just the button. */}
        <motion.div
          initial={false}
          animate={{ height: drawerOpen ? "auto" : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.44, ease: EASE_OUT }}
          inert={!drawerOpen}
          className="relative overflow-hidden px-4"
        >
          <div className="mx-auto w-full max-w-md rounded-t-2xl border-t border-border-subtle bg-bg-surface px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 short:pb-[max(0.75rem,env(safe-area-inset-bottom))] short:pt-3">
            <button
              type="button"
              onClick={() => navigate(REPORT_PATH, { replace: true })}
              className={cx(scanUi.primaryBtn, "w-full text-white")}
            >
              See My Data
            </button>
          </div>
        </motion.div>
        {/* Safe-area gap under the card while the drawer (which has its own) is closed. */}
        {!drawerOpen && (
          <div
            aria-hidden
            className="relative h-[max(0.25rem,env(safe-area-inset-bottom))]"
          />
        )}
      </div>
    </Page>
  );
}
