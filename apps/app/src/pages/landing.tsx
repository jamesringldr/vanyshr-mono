import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page } from "konsta/react";
import { ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandLockup } from "@/components/BrandLockup";
import {
  FindMyDataDrawer,
  KeyboardStripFill,
  primaryButton,
  useDrawerPageEffects,
  useKeyboardInset,
} from "@/components/FindMyDataDrawer";
import heroScene from "@/assets/scenes/broker-orbit-hero-1x1.svg";

const THREAT_WORDS = ["Scammers", "Spammers", "Identity Thieves", "Telemarketers", "Hackers"] as const;
const WORD_MS = 3200;
const LETTER_STAGGER_S = 0.04;

/** One threat word at a time: letters blur/fade in left to right, an orange rule sweeps under it. */
function RotatingThreat({ words, reducedMotion }: { words: readonly string[]; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), WORD_MS);
    return () => window.clearInterval(id);
  }, [words]);

  const word = words[index];

  return (
    <span className="inline-flex h-10 items-center" aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="relative inline-block whitespace-nowrap pb-1 text-accent-text"
        >
          {word.split("").map((char, i) => (
            <motion.span
              key={i}
              initial={reducedMotion ? false : { opacity: 0, filter: "blur(8px)", y: 6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.35, delay: reducedMotion ? 0 : i * LETTER_STAGGER_S, ease: [0.2, 0, 0, 1] }}
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          ))}
          <span className="animate-underline-sweep absolute inset-x-0 bottom-0 h-[3px] rounded-full" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** /landing — dark-navy entry page. "Find my data" opens the same drawer and scan sequence as `/`. */
export function LandingPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;
  const reducedMotion = Boolean(useReducedMotion());
  const scrollerRef = useRef<HTMLDivElement>(null);

  useDrawerPageEffects(isOpen, fieldFocused, "var(--color-brand-navy)");

  return (
    <>
      {isOpen && <KeyboardStripFill keyboard={keyboard} />}
      <Page
        className={cx("flex flex-col bg-brand-navy!", isOpen && "overflow-hidden!")}
        // Same keyboard pinning as `/`: keep the Page on the visual viewport while the keyboard is up.
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
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="flex h-11 items-center gap-1 whitespace-nowrap text-md font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
            >
              Sign in
              <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
            </button>
          }
        />

        {/* Snap stack. The scroll container is exactly the space under the navbar (one "stage").
            Swipes snap section to section like a carousel: release past halfway and the next
            section completes; release short of it and it settles back. Sections 2-4 are sticky
            at the top, so each new section slides over the previous one instead of pushing it.
            Snap markers (not the sticky sections) carry snap-align, since sticky boxes move. */}
        <div
          ref={scrollerRef}
          className={cx(
            "cq-size min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain",
            isOpen && "overflow-hidden!",
          )}
        >
          <div className="relative">
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-2 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-3 h-px snap-start snap-always" />

            {/* Hero. The image is the only shrinkable child, so short screens scale it down instead of
                colliding with "Learn More"; tall screens leave the slack above it (mt-auto). */}
            <section className="cq-inline flex h-stage min-h-0 flex-col items-center overflow-hidden px-6 text-center">
              <span className="mb-5 mt-3 inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-text-primary/20 px-4 py-1.5 text-md font-bold text-text-primary">
                <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                AI Consumer Cyber Defense
              </span>
              <div className="flex min-h-40 w-full shrink items-center justify-center">
                <img src={heroScene} alt="" className="max-h-full w-4/5 object-contain" />
              </div>

              <h1
                className="m-0 mt-5 flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-display text-display-fluid font-bold leading-tight tracking-tight text-text-primary"
                aria-label={`Vanysh from ${THREAT_WORDS.join(", ")}`}
              >
                <span aria-hidden="true">
                  <span className="italic">Vanysh</span> from
                </span>
                <RotatingThreat words={THREAT_WORDS} reducedMotion={reducedMotion} />
              </h1>
              <p className="m-0 mt-3 shrink-0 text-lg text-text-secondary">
                Find where your private data is being exposed across the web then make it{" "}
                <span className="font-bold italic text-text-primary">vanysh!</span>
              </p>

              <div className="mt-6 flex w-full shrink-0 flex-col items-center gap-3">
                <div className="w-1/2">
                  <button type="button" onClick={() => setIsOpen(true)} className={cx(primaryButton, "text-lg!")}>
                    Find my data
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

              <div className="mt-auto flex shrink-0 justify-center pt-4 pb-[max(50px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                  const scroller = scrollerRef.current;
                  scroller?.scrollTo({ top: scroller.clientHeight, behavior: reducedMotion ? "auto" : "smooth" });
                }}
                  className="flex h-12 items-center gap-1 rounded-full px-4 text-lg font-semibold text-text-primary outline-none transition-colors duration-fast hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  Learn More
                  <ChevronDown className="animate-nudge-down size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </section>

            <section
              aria-label="Section two"
              className="sticky top-0 z-10 h-stage rounded-t-lg bg-bg-app"
            />
            <section
              aria-label="Section three"
              className="sticky top-0 z-20 h-stage rounded-t-lg bg-linear-[48deg] from-[color-mix(in_srgb,var(--color-secondary)_40%,var(--color-brand-navy))] to-brand-navy"
            />
            <section
              aria-label="Section four"
              className="sticky top-0 z-30 h-stage rounded-t-lg bg-brand-orange"
            />
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
