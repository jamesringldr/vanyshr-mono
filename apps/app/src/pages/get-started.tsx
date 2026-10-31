import { useId, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page } from "konsta/react";
import { ChevronDown, ChevronRight, Mail, MessageCircle, Phone } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandLockup } from "@/components/BrandLockup";
import {
  FindMyDataDrawer,
  KeyboardStripFill,
  primaryButton,
  useDrawerPageEffects,
  useKeyboardInset,
} from "@/components/FindMyDataDrawer";
import { RecordsOrbit } from "@/components/RecordsOrbit";
import { RotatingThreat, THREAT_WORDS } from "@/components/get-started/RotatingThreat";
import { PhaseLayer, PhoneFrame, SCAM_PHASES, SCREEN_LAYER } from "@/components/get-started/ScamPhases";

const LONGEST_THREAT = THREAT_WORDS.reduce((a, b) => (b.length > a.length ? b : a));

/** The iOS app badge shown beside each phase title; tints match the notification banners. */
const PHASE_BADGES = [
  { icon: Phone, tint: "bg-status-success", fill: true },
  { icon: MessageCircle, tint: "bg-status-success", fill: true },
  { icon: Mail, tint: "bg-primary", fill: false },
] as const;

/** Snap stops: the hero, then one stage per scam phase. Literal classes so Tailwind can see them. */
const SNAP_STOPS = ["top-0", "top-stage", "top-stage-2", "top-stage-3"] as const;

/** Short diagonal dashes tiled across the panel, faded out toward the middle so the phone sits on a calm field. */
function GeometricBackdrop() {
  const id = useId();
  return (
    <>
      <svg aria-hidden="true" className="absolute inset-0 size-full">
        <defs>
          <pattern id={id} width="64" height="64" patternUnits="userSpaceOnUse">
            <g strokeWidth="1.5" strokeLinecap="round" className="stroke-text-tertiary">
              <path d="M6 22l12-8" />
              <path d="M30 54l8-5" />
              <path d="M44 16l16-10" />
              <path d="M8 60l6-4" />
              <path d="M34 28l5-3" />
            </g>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id})`} opacity="0.55" />
      </svg>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-brand-navy)_20%,transparent_75%)]" />
    </>
  );
}

/** /get-started — alternate landing flow. Same navy background, top bar, hero and CTA as `/`; illustration is a placeholder. */
export function GetStartedPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;
  const reducedMotion = Boolean(useReducedMotion());
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Which scam phase is on screen (-1 until the section starts sliding in); drives the notification banners.
  const [phaseActive, setPhaseActive] = useState(-1);
  // Navbar action: "Sign in" on the hero, "Get Started" once the stack is scrolled past halfway to section two.
  const [pastHero, setPastHero] = useState(false);
  const { scrollY } = useScroll({ container: scrollerRef });
  useMotionValueEvent(scrollY, "change", (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    if (stage <= 0) return;
    setPastHero(y / stage >= 0.5);
    const raw = y / stage - 1;
    setPhaseActive(raw < -0.5 ? -1 : Math.min(Math.max(Math.round(raw), 0), SCAM_PHASES.length - 1));
  });
  // 0 at the first phase, SCAM_PHASES.length - 1 at the last; the hero is stage 0.
  const phaseProgress = useTransform(scrollY, (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    return stage > 0 ? Math.min(Math.max(y / stage - 1, 0), SCAM_PHASES.length - 1) : 0;
  });

  useDrawerPageEffects(isOpen, fieldFocused, "var(--color-brand-navy)");

  return (
    <>
      {isOpen && <KeyboardStripFill keyboard={keyboard} />}
      <Page
        className={cx("flex flex-col bg-brand-navy!", isOpen && "overflow-hidden!")}
        style={
          keyboardOpen
            ? { height: keyboard.visibleHeight, transform: `translateY(${keyboard.offsetTop}px)` }
            : undefined
        }
      >
        <Navbar
          className="static! mb-0 bg-transparent! [&>div:empty]:hidden!"
          bgClassName="bg-transparent! backdrop-blur-none! border-transparent!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandLockup className="ml-2.5 h-7" />}
          innerClassName="pl-2.5!"
          leftClassName="ml-0! bg-transparent! shadow-none! backdrop-blur-none!"
          right={
            <AnimatePresence mode="wait" initial={false}>
              {pastHero ? (
                <motion.button
                  key="get-started"
                  type="button"
                  onClick={() => setIsOpen(true)}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                  className="relative flex h-9 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 text-md font-bold text-primary-on before:absolute before:inset-x-0 before:-inset-y-1 outline-none transition-colors duration-fast hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  Get Started
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </motion.button>
              ) : (
                <motion.button
                  key="signin"
                  type="button"
                  onClick={() => navigate("/login")}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                  className="flex h-11 items-center gap-1 whitespace-nowrap text-md font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
                >
                  Sign in
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
          }
        />

        {/* Snap stack, as on `/`: the scroll container is exactly the space under the navbar (one "stage"). */}
        <div
          ref={scrollerRef}
          className={cx(
            "cq-size min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain",
            isOpen && "overflow-hidden!",
          )}
        >
          <div className="relative">
            {SNAP_STOPS.map((top) => (
              <span
                key={top}
                aria-hidden="true"
                className={cx("pointer-events-none absolute inset-x-0 h-px snap-start snap-always", top)}
              />
            ))}

            <section className="cq-inline flex h-stage min-h-0 flex-col items-center overflow-hidden px-6 text-center">
              {/* Illustration slot — takes the slack above the title and shrinks on short screens, like the hero image on `/`. */}
              <div className="flex min-h-40 w-full min-w-0 grow items-center justify-center">
                <RecordsOrbit className="size-full" />
              </div>

              <h1
                className="m-0 mt-5 flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-display text-[length:min(31px,calc(100cqw/13.5))] font-bold leading-tight tracking-tight text-text-primary"
                aria-label={`Vanysh from ${THREAT_WORDS.join(", ")}`}
              >
                <span aria-hidden="true">
                  <span className="italic">Vanysh</span> from
                </span>
                {/* Reserve the longest word's width so "Vanysh from" stays put and every word starts at the same x. */}
                <span className="inline-grid">
                  <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-nowrap pb-1">
                    {LONGEST_THREAT}
                  </span>
                  <span className="col-start-1 row-start-1 justify-self-start">
                    <RotatingThreat words={THREAT_WORDS} reducedMotion={reducedMotion} />
                  </span>
                </span>
              </h1>
              <p className="m-0 mt-3 shrink-0 text-balance text-[19px] text-text-secondary">
                Agentic privacy for the whole family.
                <br />
                Detect, delete, &amp; defend in one place.
              </p>

              <div className="mt-6 flex w-full shrink-0 flex-col items-center gap-3 pb-[15px]">
                <div className="w-full">
                  <button type="button" onClick={() => setIsOpen(true)} className={cx(primaryButton, "h-11! text-[21px]! font-medium!")}>
                    Find your data exposures
                  </button>
                </div>
                <ul className="m-0 flex list-none items-center justify-center gap-4 p-0 text-md italic text-text-secondary">
                  {["No Credit Card", "No Sign Up"].map((label) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex shrink-0 justify-center pb-[max(15px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                    const scroller = scrollerRef.current;
                    scroller?.scrollTo({ top: scroller.clientHeight, behavior: reducedMotion ? "auto" : "smooth" });
                  }}
                  className="flex h-12 items-center gap-1 rounded-full px-4 text-[16px] font-bold text-text-primary outline-none transition-colors duration-fast hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  Learn More
                  <ChevronDown className="animate-nudge-down size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* Section two. Pinned for one stage per phase: the spacers below supply the scroll distance, and the
                phase progress cross-fades the phone screen and the title while the banners spring in. */}
            <section
              aria-label="Privacy, hands-free"
              className="sticky top-0 z-10 flex h-stage flex-col gap-6 overflow-hidden rounded-t-lg bg-brand-navy px-6 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
            >
              <h2 className="m-0 shrink-0 font-display text-display-md font-bold leading-tight tracking-tight text-text-secondary">
                <span className="text-text-primary">Privacy, hands-free.</span>
                {/* Grey lines are 20% smaller than the white title, with a forced break after "listing.". */}
                <span className="block whitespace-nowrap text-[length:calc(var(--size-display)*0.8)]">
                  Every broker. Every listing.
                  <br />
                  Handled for you.
                </span>
              </h2>

              <div className="relative mb-10 min-h-0 flex-1 overflow-hidden rounded-lg border border-border-subtle bg-brand-navy">
                <GeometricBackdrop />
                {/* The panel ends 40px higher (mb-10); this layer runs 40px past its bottom edge (-bottom-10) so the phone
                    and banners keep their size and position and are simply cropped. */}
                <div className="absolute inset-x-0 top-0 -bottom-10">
                <div className="absolute inset-x-0 bottom-0 top-10 flex justify-center">
                  <div className="h-full w-2/3">
                    <PhoneFrame>
                      {SCAM_PHASES.map((phase, i) => (
                        <PhaseLayer
                          key={phase.title}
                          index={i}
                          progress={phaseProgress}
                          reducedMotion={reducedMotion}
                          className={SCREEN_LAYER}
                        >
                          {phase.screen}
                        </PhaseLayer>
                      ))}
                    </PhoneFrame>
                  </div>
                </div>
                {/* Banners sit outside the clipped phone and are wider than it, so they pop out of it. The banner
                    components are shared with `/`, so the "taller, text 15% larger" tweak is scoped to this wrapper. */}
                <div className="pointer-events-none absolute inset-x-0 top-2/5 z-20 [&_.border.rounded-lg]:py-4 [&_.text-md]:text-[length:calc(var(--size-body)*1.15)] [&_.text-sm]:text-[length:calc(var(--size-caption)*1.15)] [&_.text-xs]:text-[length:calc(var(--size-label)*1.15)]">
                  {SCAM_PHASES.map(
                    (phase, i) =>
                      phase.notification && (
                        <phase.notification key={phase.title} shown={phaseActive === i} reducedMotion={reducedMotion} />
                      ),
                  )}
                </div>
                </div>
              </div>

              <div className="grid shrink-0">
                {SCAM_PHASES.map((phase, i) => {
                  const { icon: Icon, tint, fill } = PHASE_BADGES[i];
                  return (
                    <PhaseLayer
                      key={phase.title}
                      index={i}
                      progress={phaseProgress}
                      reducedMotion={reducedMotion}
                      className="col-start-1 row-start-1 flex items-center justify-center gap-3"
                    >
                      <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-lg", tint)}>
                        <Icon className={cx("size-6 text-text-primary", fill && "fill-current")} aria-hidden="true" />
                      </span>
                      <h3 className="m-0 font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                        {phase.title}
                      </h3>
                    </PhaseLayer>
                  );
                })}
              </div>
            </section>
            {SCAM_PHASES.slice(1).map((phase) => (
              <div key={phase.title} aria-hidden="true" className="h-stage" />
            ))}
          </div>
        </div>

        {isOpen && (
          <FindMyDataDrawer
            keyboard={keyboard}
            onClose={() => {
              setIsOpen(false);
              setFieldFocused(false);
            }}
            onFieldFocusChange={setFieldFocused}
          />
        )}
      </Page>
    </>
  );
}
