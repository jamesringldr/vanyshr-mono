import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page } from "konsta/react";
import { ChevronDown, ChevronRight, Menu, ShieldCheck } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandMark } from "@/components/BrandMark";
import {
  FindMyDataDrawer,
  KeyboardStripFill,
  primaryButton,
  useDrawerPageEffects,
  useKeyboardInset,
} from "@/components/FindMyDataDrawer";

/**
 * / — approved spec: scratchpad/spec-review/entry.spec.md
 *
 * Two visual states on one page: closed (static hero + CTA) and open
 * (hero stays put under a dimmed backdrop, a bottom drawer collects first/last/zip).
 * Zip validation and the intro-scan submit are ported from the same logic
 * self-scan/pilot-scan already use (quick-scan-form.tsx's Zippopotam debounce,
 * self-scan/entry.tsx's onPilotSubmit pattern) — this page does not import
 * QuickScanForm itself, which carries scan-orchestration machinery this
 * lightweight entry point doesn't need.
 */

function HalftoneBackdrop({ className }: { className?: string }) {
  return (
    <svg
      // No viewBox/preserveAspectRatio — SVG user-space then equals real CSS
      // pixels 1:1, so the pattern's dots stay genuinely circular and just
      // tile to fill whatever height this ends up at, instead of a fixed
      // 420x420 square being non-uniformly stretched to fit (that was
      // rendering the dots as ellipses).
      className={cx("pointer-events-none absolute left-[-80px] top-0 w-[420px]", className)}
      aria-hidden="true"
      focusable="false"
      style={{ transform: "scaleX(-1)" }}
    >
      <defs>
        <pattern id="fmd-halftone-dots" x="0" y="0" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.8" fill="var(--color-border-strong)" />
        </pattern>
        <radialGradient id="fmd-halftone-fade" cx="70%" cy="30%" r="60%">
          <stop offset="0%" stopColor="white" stopOpacity="1" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </radialGradient>
        <mask id="fmd-halftone-mask">
          <rect width="100%" height="100%" fill="url(#fmd-halftone-fade)" />
        </mask>
        <linearGradient id="fmd-halftone-top-fade" x1="0" y1="0" x2="0" y2="96" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </linearGradient>
        <mask id="fmd-halftone-top-mask">
          <rect width="100%" height="100%" fill="url(#fmd-halftone-top-fade)" />
        </mask>
      </defs>
      <g mask="url(#fmd-halftone-top-mask)">
        <rect width="100%" height="100%" fill="url(#fmd-halftone-dots)" mask="url(#fmd-halftone-mask)" />
      </g>
    </svg>
  );
}

const THREAT_WORDS = ["Hackers", "Scammers", "Spammers"] as const;
const ROLL_MS = 2200;

/**
 * Same technique as self-scan/rolling-threat-word.tsx (invisible sizing grid
 * + framer-motion vertical roll) — reimplemented locally rather than
 * importing that component directly, since it hardcodes `text-warning` and
 * this page needs `--color-accent-text` instead; not worth fighting via
 * className override precedence for ~25 lines of animation logic. Generic
 * over `words`.
 */
function RollingWord({
  words,
  reducedMotion,
  className,
  style,
}: {
  words: readonly string[];
  reducedMotion: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), ROLL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion, words]);

  const word = words[index % words.length];

  if (reducedMotion) {
    return (
      <span className={className} style={style}>
        {words[0]}
      </span>
    );
  }

  return (
    <span
      className="relative inline-grid justify-items-start overflow-hidden text-left align-baseline"
      style={style}
      aria-live="polite"
    >
      {words.map((w) => (
        <span key={w} className={cx("invisible col-start-1 row-start-1", className)} aria-hidden>
          {w}
        </span>
      ))}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.34, ease: [0.2, 0, 0, 1] }}
          className={cx("col-start-1 row-start-1", className)}
        >
          {word}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function FindMyDataPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  // A drawer field has focus, i.e. the iOS keyboard is up. Tracked from focus events because they
  // fire immediately, unlike visualViewport which can lag until the user scrolls.
  const [fieldFocused, setFieldFocused] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;

  useDrawerPageEffects(isOpen, fieldFocused, "var(--color-bg-app)");

  // Viewport vertical center, in the hero container's own coordinates, so the
  // title's "from" row can be anchored to the true viewport center (the
  // container starts below the app bar, so 50% of it is not viewport center).
  const heroRef = useRef<HTMLDivElement>(null);
  const [viewportCenterY, setViewportCenterY] = useState<number | null>(null);
  useLayoutEffect(() => {
    const update = () => {
      const top = heroRef.current?.getBoundingClientRect().top ?? 0;
      setViewportCenterY(window.innerHeight / 2 - top);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);


  return (
    <>
    {isOpen && <KeyboardStripFill keyboard={keyboard} />}
    <Page
      className={cx("flex flex-col bg-bg-app! font-body", isOpen && "overflow-hidden!")}
      role="main"
      aria-label="Find my data"
      // iOS scrolls the layout viewport to reveal a focused input, which exposed the
      // (black) document behind this full-height Page. While the keyboard is up, pin the
      // Page to the visual viewport instead so there is nothing behind it to scroll to.
      style={
        keyboardOpen
          ? { height: keyboard.visibleHeight, transform: `translateY(${keyboard.offsetTop}px)` }
          : undefined
      }
    >
      {isOpen ? (
        <Navbar
          className="static! mb-0 bg-transparent! [&>div:empty]:hidden!"
          bgClassName="bg-transparent! backdrop-blur-none! border-transparent!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandMark className="ml-2.5 h-11.5 w-auto object-contain" />}
          innerClassName="pl-2.5!"
          leftClassName="ml-0! bg-transparent! shadow-none! backdrop-blur-none!"
          right={
            <button
              type="button"
              aria-label="Open menu"
              // TODO: wire hamburger target — not specified in the approved spec.
              className="flex size-11 items-center justify-center rounded-md text-text-primary outline-none hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              <Menu className="size-5" />
            </button>
          }
        />
      ) : (
        <Navbar
          className="static! mb-0 bg-transparent! [&>div:empty]:hidden!"
          bgClassName="bg-transparent! backdrop-blur-none! border-transparent!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandMark className="ml-2.5 h-14 w-auto object-contain" />}
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
      )}

      <div ref={heroRef} className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <HalftoneBackdrop className="h-full" />
        <div className="relative z-10 flex flex-1 flex-col justify-start px-6 pt-10">
          <span className="inline-flex w-fit items-center gap-1.5 self-center rounded-full border border-primary bg-primary-muted px-3 py-1 text-sm font-medium text-primary-text">
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            Agentic Consumer Cyber Defense
          </span>
          {/* Anchored so the middle of the "from" row (1.5 lines down the h1) sits at viewport center. */}
          <div
            className="absolute inset-x-6"
            style={{
              top: viewportCenterY ?? "50%",
              transform: "translateY(calc(-1.5 * 1.02 * 60px))",
            }}
          >
          <h1
            className="m-0 font-display font-bold tracking-tight text-text-primary"
            style={{ fontSize: 60, lineHeight: 1.02 }}
          >
            Vanysh
            <br />
            from
            <br />
            <RollingWord
              words={THREAT_WORDS}
              reducedMotion={Boolean(prefersReducedMotion)}
              className="text-accent-text"
              // Rolling word stays at the same 68:80 ratio to the static
              // lines (title 60/51).
              style={{ fontSize: 51 }}
            />
          </h1>
          <p className="m-0 mt-4 text-xl font-bold text-text-primary">
            We find where your personal data is exposed and make it <span className="font-extrabold italic">vanysh!</span>
          </p>
          </div>
        </div>

        {/* Fixed to the bottom edge with the page navy: Safari 26 tints its toolbar from fixed elements
            touching that edge, so this is what it re-samples once the drawer closes. */}
        <div className="fixed inset-x-0 bottom-0 z-20 bg-bg-app px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => navigate("/learn-more")}
              className="flex h-12 items-center gap-1 rounded-full px-2 text-lg font-semibold text-text-primary outline-none transition-colors duration-fast hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
            >
              Learn more
              <ChevronDown className="size-4 shrink-0" aria-hidden="true" />
            </button>
            <div className="w-1/2">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className={cx(primaryButton, "text-lg!")}
              >
                Get started
              </button>
            </div>
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
      </div>
    </Page>
    </>
  );
}
