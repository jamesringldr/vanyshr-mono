import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type MotionProps } from "framer-motion";
import { Page } from "konsta/react";
import { Radar, type LucideIcon } from "lucide-react";
import {
  ScanProgressCard,
  type ScanPhase,
} from "@vanyshr/ui/components/application/scan-progress-card/scan-progress-card";
import { cx } from "@/utils/cx";

export interface ScanSlide {
  /** Lucide glyph, shown in the cyan circle. Set this or `artSvg`. */
  icon?: LucideIcon;
  /** Styled-tier brand icon (raw SVG markup), rendered large and inlined with no circle. */
  artSvg?: string;
  headline: string;
  sub: string;
  /** Optional aside after the sub, rendered italic in the accent (orange) color. Include the parentheses. */
  note?: string;
}

export interface ScanLoadingViewProps {
  /** Education slides, in order. Empty → a single built-in intro slide, no dots. */
  slides: readonly ScanSlide[];
  /** Time each slide stays up before auto-advancing. */
  autoAdvanceMs?: number;
  phases: readonly ScanPhase[];
  activeIndex: number;
  status: "scanning" | "complete";
  /** Fired once, shortly after `status` becomes `complete`. The parent owns navigation. */
  onComplete?: () => void;
}

// Fallback shown only when `slides` is empty.
const INTRO_SLIDE: ScanSlide = {
  icon: Radar,
  headline: "Scan",
  sub: "We scan brokers and the dark web to find your data",
};

// Default pairing for styled-tier icons; scoped to the icon wrapper so it doesn't leak.
const ICON_VARS = {
  "--icon-ink": "#070F1C",
  "--icon-shadow": "#070F1C",
  "--icon-paper": "#FFFFFF",
} as React.CSSProperties;

const FAQ_QUESTIONS = [
  "How do you use my data from this scan if I don't sign up?",
  "How does all this personal data get exposed?",
] as const;

// After a manual swipe or dot tap, auto-advance stays paused this long before its normal countdown restarts.
const IDLE_RESUME_MS = 10000;
// Beat between the card settling and onComplete, so the settled state is seen.
const COMPLETE_BEAT_MS = 800;
const SWIPE_OFFSET = 50;
const SWIPE_VELOCITY = 500;
const EASE_STANDARD = [0.2, 0, 0, 1] as const;
// Slides enter from the left and exit to the right (fade + this horizontal drift).
const SLIDE_DRIFT = 32;

/**
 * The ~3-minute scan wait: live progress (ScanProgressCard, always mounted) plus
 * education (swappable slides). Never navigates itself.
 */
export function ScanLoadingView({
  slides,
  autoAdvanceMs = 22000,
  phases,
  activeIndex,
  status,
  onComplete,
}: ScanLoadingViewProps) {
  const reduceMotion = useReducedMotion();
  // Shared by the swipe surface and both animated layers so content follows the finger.
  const dragX = useMotionValue(0);
  const slideMotion: MotionProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : {
        initial: { opacity: 0, x: -SLIDE_DRIFT },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: SLIDE_DRIFT },
        transition: { duration: 0.3, ease: EASE_STANDARD },
      };
  const all = slides.length > 0 ? slides : [INTRO_SLIDE];
  const total = all.length;

  const [index, setIndex] = useState(0);
  // Bumped on every manual action so the auto-advance countdown restarts even when the index doesn't change.
  const [manualCount, setManualCount] = useState(0);
  const current = all[Math.min(index, total - 1)];

  const goTo = (next: number) => {
    setIndex(((next % total) + total) % total);
    setManualCount((n) => n + 1);
  };

  // Auto-advance. Paused while complete; a manual action adds IDLE_RESUME_MS to the next countdown only.
  useEffect(() => {
    if (total <= 1 || status === "complete") return;
    const id = window.setTimeout(
      () => setIndex((i) => (i + 1) % total),
      autoAdvanceMs + (manualCount > 0 ? IDLE_RESUME_MS : 0),
    );
    return () => window.clearTimeout(id);
  }, [index, manualCount, total, status, autoAdvanceMs]);

  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  });
  useEffect(() => {
    if (status !== "complete") return;
    const id = window.setTimeout(() => onCompleteRef.current?.(), COMPLETE_BEAT_MS);
    return () => window.clearTimeout(id);
  }, [status]);

  const Icon = current.icon;

  return (
    <Page className="relative flex h-dvh flex-col bg-bg-app font-body" role="main" aria-label="Scanning in progress">
      {/* Full-page swipe surface, behind everything. Slide layers below follow it via dragX. */}
      <motion.div
        aria-hidden
        drag={total > 1 ? "x" : false}
        dragSnapToOrigin
        dragElastic={0.2}
        dragConstraints={{ left: 0, right: 0 }}
        style={{ x: dragX }}
        onDragEnd={(_, info) => {
          if (info.offset.x < -SWIPE_OFFSET || info.velocity.x < -SWIPE_VELOCITY) goTo(index + 1);
          else if (info.offset.x > SWIPE_OFFSET || info.velocity.x > SWIPE_VELOCITY) goTo(index - 1);
        }}
        className="absolute inset-0 z-0 touch-pan-y"
      />

      <header className="relative z-10 mx-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
        <ScanProgressCard phases={phases} activeIndex={activeIndex} status={status} className="w-full" />
      </header>

      {/* Slide text, centered between the status card and the dots. Fixed-height areas above
          (icon + headline, pt-38) and below (subtitle, min-h-24) keep the divider bar in the
          same place on every slide. */}
      <div className="pointer-events-none relative z-0 flex min-h-0 flex-1 flex-col justify-center px-6">
        <motion.div style={{ x: dragX }}>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={index} {...slideMotion}>
              <div className="relative pt-38 short:pt-31">
                <div className="absolute bottom-4 left-0 flex flex-col items-start gap-3">
                  {current.artSvg ? (
                    <div
                      className="size-20 rounded-2xl bg-primary p-2 short:size-16 [&>svg]:size-full"
                      style={ICON_VARS}
                      aria-hidden
                      dangerouslySetInnerHTML={{ __html: current.artSvg }}
                    />
                  ) : (
                    Icon && (
                      <div className="flex size-18 items-center justify-center rounded-full bg-primary short:size-14" aria-hidden>
                        <Icon className="size-12 text-primary-on short:size-9" strokeWidth={2} />
                      </div>
                    )
                  )}
                  <h1 className="m-0 font-display text-[45px] font-semibold leading-tight tracking-tight text-text-primary short:text-display-xs">
                    {current.headline}
                  </h1>
                </div>
                <span className="block h-1 w-12 rounded-full bg-primary" aria-hidden />
              </div>
              <p className="m-0 mt-4 min-h-30 text-xl font-bold text-text-primary short:min-h-22 short:text-lg">
                {current.sub}
                {current.note && <span className="italic text-accent-text"> {current.note}</span>}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Bottom cluster: dots over the FAQs, fixed to the bottom on every slide. */}
      <footer className="relative z-10 flex flex-col">
        {total > 1 && (
          <div role="tablist" aria-label="Slides" className="mb-6 flex flex-wrap justify-center">
            {all.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={index === i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className="flex h-11 items-center justify-center rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <span
                  className={cx(
                    "h-2 rounded-full transition-all duration-fast",
                    index === i ? "w-6 bg-primary" : "w-2 bg-text-primary/25",
                  )}
                />
              </button>
            ))}
          </div>
        )}

        {/* Placeholder rows: interaction (expand vs. swap the slide content) is undecided. */}
        <section aria-labelledby="scan-faqs-title" className="mx-6 pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
          <h2 id="scan-faqs-title" className="m-0 text-lg font-semibold text-text-primary">
            FAQs
          </h2>
          <ul className="m-0 mt-2 list-none p-0">
            {FAQ_QUESTIONS.map((q) => (
              <li key={q} className="flex min-h-11 items-center border-b border-border-subtle text-md text-text-secondary">
                {q}
              </li>
            ))}
            <li className="flex min-h-11 items-center text-md text-primary-text">More FAQs…</li>
          </ul>
        </section>
      </footer>
    </Page>
  );
}
