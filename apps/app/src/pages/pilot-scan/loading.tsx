import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import { cx } from "@/utils/cx";

const EASE_OUT = [0.2, 0, 0, 1] as const;
const STEP_MS = 2200;
const DONE_HOLD_MS = 900;

/**
 * generative-loaders@0.1.1 has no `vortex` yet — `orbit` is the closest
 * circular activity indicator from the published set.
 */
const ACTIVE_LOADER_VARIANT = "orbit" as const;

type StepStatus = "pending" | "active" | "complete";

type LoadingStep = {
  id: string;
  label: string;
  eyebrow: string;
  headline: string;
};

const STEPS: LoadingStep[] = [
  {
    id: "criteria",
    label: "Building search criteria",
    eyebrow: "Just a moment...",
    headline: "We're mapping how to find your data",
  },
  {
    id: "brokers",
    label: "Searching Data Brokers",
    eyebrow: "Digging in...",
    headline: "Scanning people-search sites for your info",
  },
  {
    id: "accounts",
    label: "Finding exposed accounts",
    eyebrow: "Still working...",
    headline: "Looking for accounts tied to your identity",
  },
  {
    id: "darkweb",
    label: "Scanning Dark Web",
    eyebrow: "Going deeper...",
    headline: "Checking forums and known credential leaks",
  },
  {
    id: "results",
    label: "Organizing your results",
    eyebrow: "Almost done...",
    headline: "Pulling everything together into your report",
  },
];

function stepStatus(index: number, current: number, allDone: boolean): StepStatus {
  if (allDone || index < current) return "complete";
  if (index === current) return "active";
  return "pending";
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
        <InlineLoader
          variant={ACTIVE_LOADER_VARIANT}
          size={24}
          color="#00BFFF"
        />
      </span>
    );
  }

  return (
    <span
      className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4A5568]"
      aria-hidden
    />
  );
}

/**
 * Pilot-scan loading — UI-only step narrative.
 * Structure from Mobbin study-plan loader; Vanyshr branding + copy.
 * Hero motion: soft floating logo.
 */
export function PilotLoadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const holdMode = searchParams.has("hold");
  const prefersReducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (holdMode) return;

    if (prefersReducedMotion) {
      setCurrent(STEPS.length - 1);
      setAllDone(true);
      const t = window.setTimeout(() => {
        navigate("/pilot-scan/start", { replace: true });
      }, 800);
      return () => window.clearTimeout(t);
    }

    if (allDone) {
      const t = window.setTimeout(() => {
        navigate("/pilot-scan/start", { replace: true });
      }, DONE_HOLD_MS);
      return () => window.clearTimeout(t);
    }

    const t = window.setTimeout(() => {
      setCurrent((prev) => {
        if (prev >= STEPS.length - 1) {
          setAllDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, STEP_MS);

    return () => window.clearTimeout(t);
  }, [current, allDone, navigate, prefersReducedMotion, holdMode]);

  const activeStep = STEPS[Math.min(current, STEPS.length - 1)]!;

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={!allDone}
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Logo — soft float */}
        <div className="relative mb-10 flex h-[168px] w-[168px] items-center justify-center">
          <motion.img
            src={PrimaryIcon}
            alt=""
            className="relative z-10 h-[88px] w-[88px] object-contain drop-shadow-[0_0_28px_rgba(0,191,255,0.45)]"
            animate={
              prefersReducedMotion
                ? undefined
                : { y: [0, -14, 0] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: [0.45, 0, 0.55, 1],
                  }
            }
          />
        </div>

        {/* Copy — updates per step */}
        <div className="mb-10 min-h-[88px] w-full text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id + (allDone ? "-done" : "")}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <p className="text-base text-[#B8C4CC]">
                {allDone ? "All set..." : activeStep.eyebrow}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                {allDone
                  ? "Your exposure report is ready to review"
                  : activeStep.headline}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Steps */}
        <ol className="flex w-full max-w-[280px] flex-col gap-4" aria-label="Scan progress">
          {STEPS.map((step, index) => {
            const status = stepStatus(index, current, allDone);
            return (
              <li key={step.id} className="flex items-center gap-3">
                <StepIndicator status={status} />
                <span
                  className={cx(
                    "text-[15px] leading-snug transition-colors duration-200",
                    status === "pending" && "text-[#7A92A8]",
                    status === "active" && "font-medium text-white",
                    status === "complete" && "text-[#B8C4CC]",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
