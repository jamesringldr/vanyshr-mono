import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";

/** Impeccable / design-daddy preferred curve — snappy, no bounce. */
const EASE_OUT = [0.2, 0, 0, 1] as const;

/** Brief beat with full logo before the slide. */
const FULL_HOLD_MS = 600;
/** Icon drifts to center; wordmark wipes L→R. Scale stays locked. */
const SLIDE_MS = 720;
/** Only after the icon is centered — grow the mark. */
const GROW_MS = 680;
const HOLD_MS = 1000;
const FADE_MS = 320;
const TOTAL_MS = FULL_HOLD_MS + SLIDE_MS + GROW_MS + HOLD_MS;

/** Enough for "vanyshr" at ~34px bold + padding. */
const WORDMARK_MAX_PX = 180;

/** Final mark size relative to the 72px / 80px base. */
const ICON_SCALE_END = 3;

type SplashPhase = "full" | "slide" | "grow" | "hold" | "exit";

/**
 * Pilot-scan splash — UI-only.
 * Full logo → icon slides to center while wordmark wipes L→R (same size) →
 * then the centered icon grows. Vanyshr branding.
 *
 * Tip: `/pilot-scan/splash?hold` plays through to the large icon and stays there.
 */
export function PilotSplashPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const holdMode = searchParams.has("hold");
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<SplashPhase>("full");

  useEffect(() => {
    let cancelled = false;

    if (prefersReducedMotion) {
      setPhase("hold");
      if (holdMode) {
        return () => {
          cancelled = true;
        };
      }
      const done = window.setTimeout(() => {
        if (!cancelled) navigate("/pilot-scan/loading", { replace: true });
      }, 700);
      return () => {
        cancelled = true;
        window.clearTimeout(done);
      };
    }

    setPhase("full");

    const tSlide = window.setTimeout(() => {
      if (!cancelled) setPhase("slide");
    }, FULL_HOLD_MS);
    const tGrow = window.setTimeout(() => {
      if (!cancelled) setPhase("grow");
    }, FULL_HOLD_MS + SLIDE_MS);
    const tHold = window.setTimeout(() => {
      if (!cancelled) setPhase("hold");
    }, FULL_HOLD_MS + SLIDE_MS + GROW_MS);

    if (holdMode) {
      return () => {
        cancelled = true;
        window.clearTimeout(tSlide);
        window.clearTimeout(tGrow);
        window.clearTimeout(tHold);
      };
    }

    const tExit = window.setTimeout(() => {
      if (!cancelled) setPhase("exit");
    }, TOTAL_MS);
    const tNav = window.setTimeout(() => {
      if (!cancelled) navigate("/pilot-scan/loading", { replace: true });
    }, TOTAL_MS + FADE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(tSlide);
      window.clearTimeout(tGrow);
      window.clearTimeout(tHold);
      window.clearTimeout(tExit);
      window.clearTimeout(tNav);
    };
  }, [navigate, prefersReducedMotion, holdMode]);

  // Open only during the full beat; slide animates width → 0 (L→R wipe).
  const wordmarkWidth =
    !prefersReducedMotion && phase === "full" ? WORDMARK_MAX_PX : 0;

  const iconGrown =
    prefersReducedMotion ||
    phase === "grow" ||
    phase === "hold" ||
    phase === "exit";

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#0B1B2B] font-ubuntu"
      role="main"
      aria-label="Vanyshr pilot scan splash"
    >
      <motion.div
        className="flex items-center justify-center px-6"
        initial={false}
        animate={
          phase === "exit" && !prefersReducedMotion
            ? { opacity: 0, transition: { duration: FADE_MS / 1000, ease: EASE_OUT } }
            : { opacity: 1 }
        }
      >
        {/*
          Flex row stays centered on the screen. As the wordmark width collapses,
          the icon drifts left → center. Scale stays at 1 until the grow phase.
        */}
        <motion.img
          src={PrimaryIcon}
          alt=""
          className="relative z-10 h-[72px] w-[72px] shrink-0 origin-center object-contain sm:h-20 sm:w-20"
          initial={false}
          animate={{
            scale: iconGrown ? ICON_SCALE_END : 1,
          }}
          transition={{
            scale: {
              duration: prefersReducedMotion ? 0 : GROW_MS / 1000,
              ease: EASE_OUT,
            },
          }}
        />

        {/*
          Inner span is pinned to the right of the clip box so shrinking width
          eats letters from the left (L→R wipe), matching the Mobbin clip.
        */}
        <motion.div
          className="relative h-10 overflow-hidden sm:h-11"
          initial={false}
          animate={{ width: wordmarkWidth }}
          transition={{
            width: {
              duration: prefersReducedMotion ? 0 : SLIDE_MS / 1000,
              ease: EASE_OUT,
            },
          }}
        >
          <span
            className="absolute right-0 top-1/2 block -translate-y-1/2 whitespace-nowrap pl-3 text-[30px] font-bold tracking-tight text-white sm:pl-3.5 sm:text-[34px]"
            style={{ width: WORDMARK_MAX_PX }}
          >
            vanyshr
          </span>
        </motion.div>
      </motion.div>

      <span className="sr-only">Vanyshr</span>
    </div>
  );
}
