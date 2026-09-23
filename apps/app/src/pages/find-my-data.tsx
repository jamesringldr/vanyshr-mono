import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Navbar, Page, Sheet } from "konsta/react";
import { ChevronRight, Menu } from "lucide-react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryLogoLight from "@vanyshr/ui/assets/PrimaryLogo.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

/**
 * /find-my-data — approved spec: scratchpad/spec-review/entry.spec.md
 *
 * Two visual states on one page: closed (static hero + CTA) and open
 * (hero becomes a 3-slide carousel, a bottom drawer collects first/last/zip).
 * Zip validation and the intro-scan submit are ported from the same logic
 * self-scan/pilot-scan already use (quick-scan-form.tsx's Zippopotam debounce,
 * self-scan/entry.tsx's onPilotSubmit pattern) — this page does not import
 * QuickScanForm itself, which carries scan-orchestration machinery this
 * lightweight entry point doesn't need.
 */

const SCAN_ROLL_WORDS = ["Data Brokers", "People Search Sites", "Dark Web Directories"] as const;

/** One line of a static slide: plain segments and accented (colored) segments, in order. */
type LineSegment = { text: string; accent?: boolean };

type CarouselSlide =
  | { kind: "rolling"; prefix: string; words: readonly string[]; autoplayMs?: number }
  | { kind: "static"; lines: LineSegment[][]; autoplayMs?: number };

const DEFAULT_AUTOPLAY_MS = 4000;
// Each rolling word shows for ROLL_MS (2200ms) — a full 3-word cycle takes
// 6600ms, so the default 4000ms autoplay delay would advance the carousel
// mid-cycle, before "Dark Web Directories" ever appears. Give this slide a
// full cycle plus a beat to read the last word.
const SCAN_SLIDE_AUTOPLAY_MS = 7500;

// Line breaks are a first pass, not final — James said he'll give exact
// per-slide directions if these aren't right. Accent colors: rolling words
// are orange (text-accent-text); static accents stay cyan (text-primary-text).
const CAROUSEL_SLIDES: CarouselSlide[] = [
  { kind: "rolling", prefix: "Scan 1000s of", words: SCAN_ROLL_WORDS, autoplayMs: SCAN_SLIDE_AUTOPLAY_MS },
  {
    kind: "static",
    lines: [[{ text: "Find where" }], [{ text: "your data" }], [{ text: "is " }, { text: "exposed", accent: true }]],
  },
  {
    kind: "static",
    lines: [[{ text: "View your" }], [{ text: "Risk Profile", accent: true }]],
  },
  {
    kind: "static",
    lines: [
      [{ text: "Remove", accent: true }, { text: " your data" }],
      [{ text: "from each source" }],
      [{ text: "exposing it" }],
    ],
  },
];

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
      </defs>
      <rect width="100%" height="100%" fill="url(#fmd-halftone-dots)" mask="url(#fmd-halftone-mask)" />
    </svg>
  );
}

function BrandMark({ className }: { className?: string }) {
  return (
    <>
      <img src={PrimaryLogoDark} alt="Vanyshr" className={cx(className, "in-[.light]:hidden")} />
      <img src={PrimaryLogoLight} alt="Vanyshr" className={cx(className, "hidden in-[.light]:block")} />
    </>
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
 * over `words` so both the hero (Hackers/Scammers/Spammers) and the carousel
 * slide 1 (Data Brokers/People Search Sites/Dark Web Directories) reuse it.
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
  const [isOpen, setIsOpen] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  // ── Form state ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipStatus, setZipStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [zipLocation, setZipLocation] = useState<{ city: string; state: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Zip validation — ported from packages/ui/src/components/application/quick-scan-form.tsx
  // lines 249-292 (same debounced Zippopotam.us lookup, no Edge Function).
  useEffect(() => {
    if (zipCode.length !== 5) {
      setZipStatus("idle");
      setZipLocation(null);
      return;
    }
    setZipStatus("checking");
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          setZipStatus("invalid");
          setZipLocation(null);
        } else {
          const data = await res.json();
          const place = data.places?.[0];
          if (place) {
            setZipStatus("valid");
            setZipLocation({ city: place["place name"], state: place["state abbreviation"] });
          } else {
            setZipStatus("invalid");
            setZipLocation(null);
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== "AbortError") {
          setZipStatus("invalid");
          setZipLocation(null);
        }
      }
    }, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [zipCode]);

  const isFormValid =
    firstName.trim().length >= 2 && lastName.trim().length >= 2 && zipStatus === "valid" && zipLocation !== null;

  // Submit — ported from apps/app/src/pages/self-scan/entry.tsx lines 26-56
  // (same sessionStorage keys, same intro-scan edge function call).
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFormValid || !zipLocation || isSubmitting) return;

      setSubmitError(null);
      setIsSubmitting(true);

      sessionStorage.removeItem("pilotScanResult");
      sessionStorage.removeItem("pilotScanError");
      sessionStorage.removeItem("pilotPhase2Result");
      sessionStorage.removeItem("pilotConfirmedEmails");
      sessionStorage.removeItem("pendingScanId");

      try {
        const { data, error } = await supabase.functions.invoke("intro-scan", {
          body: {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            zipCode,
            city: zipLocation.city,
            state: zipLocation.state,
          },
        });
        if (error || data?.error || !data?.id) {
          throw new Error(error?.message || data?.error || "Could not start scan");
        }

        sessionStorage.setItem("pendingScanId", data.id);
        sessionStorage.setItem(
          "pilotScanFields",
          JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            zipCode,
            city: zipLocation.city,
            state: zipLocation.state,
          }),
        );

        // TODO: navigate to the new /find-my-data loading page once it exists
        // (James is building it next — do not point this at /self-scan/splash,
        // that belongs to the old flow).
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not start scan");
      } finally {
        setIsSubmitting(false);
      }
    },
    [firstName, lastName, zipCode, zipLocation, isFormValid, isSubmitting],
  );

  const handleCarouselScroll = useCallback(() => {
    const el = carouselRef.current;
    if (!el) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveSlide(Math.min(CAROUSEL_SLIDES.length - 1, Math.max(0, index)));
  }, []);

  // Autoplay — advances one slide after a pause, and reschedules from zero
  // whenever activeSlide changes for any reason (autoplay tick or a manual
  // swipe/drag), so it never fights an in-progress user interaction.
  useEffect(() => {
    if (!isOpen || prefersReducedMotion) return;
    const delay = CAROUSEL_SLIDES[activeSlide]?.autoplayMs ?? DEFAULT_AUTOPLAY_MS;
    const id = window.setTimeout(() => {
      const el = carouselRef.current;
      if (!el) return;
      const next = (activeSlide + 1) % CAROUSEL_SLIDES.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, delay);
    return () => window.clearTimeout(id);
  }, [isOpen, prefersReducedMotion, activeSlide]);

  // Touch already gets native momentum/snap scrolling from `overflow-x-auto`
  // + `snap-x` for free — this only adds click-and-drag for mouse (desktop
  // browser testing), left untouched for touch/pen pointers.
  const dragState = useRef<{ startX: number; startScroll: number } | null>(null);
  const handleCarouselPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = carouselRef.current;
    if (!el) return;
    dragState.current = { startX: e.clientX, startScroll: el.scrollLeft };
    el.setPointerCapture(e.pointerId);
  }, []);
  const handleCarouselPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = carouselRef.current;
    if (!el || !dragState.current) return;
    el.scrollLeft = dragState.current.startScroll - (e.clientX - dragState.current.startX);
  }, []);
  const handleCarouselPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    dragState.current = null;
  }, []);

  return (
    <Page className="flex flex-col font-body" role="main" aria-label="Find my data">
      {isOpen ? (
        <Navbar
          className="static! mb-0"
          centerTitle
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          title={<BrandMark className="h-9 w-auto object-contain" />}
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
          className="static! mb-0"
          leftClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandMark className="h-11 w-auto object-contain" />}
          right={
            <button
              type="button"
              // TODO: wire Sign In target — not specified in the approved spec.
              className="flex h-11 items-center gap-0.5 whitespace-nowrap px-2 text-lg font-bold text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-border-focus"
            >
              Sign In
              <ChevronRight className="size-4" />
            </button>
          }
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        {!isOpen && (
          <>
            <HalftoneBackdrop className="h-full" />
            <div className="relative z-10 flex flex-1 flex-col justify-center px-6">
              <h1
                className="m-0 font-display font-bold tracking-tight text-text-primary"
                style={{ fontSize: 80, lineHeight: 1.02 }}
              >
                Vanysh
                <br />
                from
                <br />
                <RollingWord
                  words={THREAT_WORDS}
                  reducedMotion={Boolean(prefersReducedMotion)}
                  className="text-accent-text"
                  // "Scammers"/"Spammers" overflow the 390px viewport at the 80px
                  // headline size (measured: 80px → 391px wide, budget is 342px
                  // after px-6 padding). 68px is the largest size all three
                  // words fit at — sized down independently of the two static
                  // lines above, which stay at the redlined 80px.
                  style={{ fontSize: 68 }}
                />
              </h1>
            </div>

            <div className="relative z-20 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-xl font-medium text-primary-on"
              >
                find your data
              </button>
            </div>
          </>
        )}

        {isOpen && (
          <div className="flex h-full flex-col">
            <HalftoneBackdrop className="h-[34%]" />

            <div className="relative z-10 flex h-[34%] flex-col justify-end overflow-hidden px-6 pt-6">
              <div
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                onPointerDown={handleCarouselPointerDown}
                onPointerMove={handleCarouselPointerMove}
                onPointerUp={handleCarouselPointerUp}
                onPointerLeave={handleCarouselPointerUp}
                className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden cursor-grab select-none active:cursor-grabbing"
              >
                {CAROUSEL_SLIDES.map((slide, i) => (
                  <div key={i} className="flex w-full shrink-0 snap-start flex-col justify-end">
                    <h1
                      className="m-0 font-display font-bold tracking-tight text-text-primary"
                      style={{ fontSize: 28, lineHeight: 1.1 }}
                    >
                      {slide.kind === "rolling" ? (
                        <>
                          {slide.prefix}{" "}
                          <RollingWord
                            words={slide.words}
                            reducedMotion={Boolean(prefersReducedMotion)}
                            className="text-accent-text"
                          />
                        </>
                      ) : (
                        slide.lines.map((line, li) => (
                          <span key={li}>
                            {li > 0 && <br />}
                            {line.map((seg, si) => (
                              <span key={si} className={seg.accent ? "text-primary-text" : undefined}>
                                {seg.text}
                              </span>
                            ))}
                          </span>
                        ))
                      )}
                    </h1>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-center gap-2 py-3" role="tablist" aria-label="Slide">
                {CAROUSEL_SLIDES.map((_, i) => (
                  <span
                    key={i}
                    role="tab"
                    aria-selected={activeSlide === i}
                    className={cx(
                      "h-2 rounded-full transition-all duration-fast",
                      activeSlide === i ? "w-5 bg-primary" : "w-2 bg-text-secondary",
                    )}
                  />
                ))}
              </div>
            </div>

            <Sheet
              opened={isOpen}
              backdrop={false}
              className="flex max-h-[66%] flex-col rounded-t-lg! shadow-xl!"
            >
              <form
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5"
              >
                <p className="m-0 px-2 text-center text-lg font-semibold text-text-primary">
                  Find your exposures and get a clear plan on how to start vanyshing
                </p>

                <div className="flex flex-col gap-3">
                  <div>
                    <label htmlFor="fmd-first-name" className="sr-only">
                      First Name
                    </label>
                    <input
                      id="fmd-first-name"
                      type="text"
                      placeholder="First Name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isSubmitting}
                      autoFocus
                      autoComplete="given-name"
                      className="h-11 w-full rounded-md border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast focus:border-border-focus disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="fmd-last-name" className="sr-only">
                      Last Name
                    </label>
                    <input
                      id="fmd-last-name"
                      type="text"
                      placeholder="Last Name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isSubmitting}
                      autoComplete="family-name"
                      className="h-11 w-full rounded-md border border-border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast focus:border-border-focus disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label htmlFor="fmd-zip" className="sr-only">
                      Zip Code
                    </label>
                    <input
                      id="fmd-zip"
                      type="text"
                      inputMode="numeric"
                      maxLength={5}
                      placeholder="Zip Code"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                      disabled={isSubmitting}
                      autoComplete="postal-code"
                      className={cx(
                        "h-11 w-full rounded-md border bg-bg-elevated px-4 text-sm text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast disabled:opacity-50",
                        zipStatus === "invalid" ? "border-status-danger" : "border-border focus:border-border-focus",
                      )}
                    />
                    {zipStatus === "valid" && zipLocation && (
                      <p className="mt-1 px-1 text-xs font-medium text-primary-text">
                        {zipLocation.city}, {zipLocation.state}
                      </p>
                    )}
                    {zipStatus === "invalid" && (
                      <p className="mt-1 px-1 text-xs font-medium text-status-danger">Enter a valid US zip code</p>
                    )}
                    {zipStatus === "checking" && (
                      <p className="mt-1 px-1 text-xs text-text-tertiary">Checking zip…</p>
                    )}
                  </div>
                </div>

                <p className="m-0 text-center text-xs text-text-secondary">No Credit Card or Sign Up Required</p>

                {submitError && (
                  <p className="m-0 text-center text-xs font-medium text-status-danger">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={!isFormValid || isSubmitting}
                  className={cx(
                    "flex min-h-11 w-full items-center justify-center rounded-lg px-4 text-sm font-medium transition-opacity duration-fast",
                    isFormValid && !isSubmitting
                      ? "bg-primary text-primary-on"
                      : "cursor-not-allowed bg-state-disabled-bg text-state-disabled-fg",
                  )}
                >
                  {isSubmitting ? "Starting scan…" : "scan now"}
                </button>

                <p className="m-0 text-center text-xs leading-snug text-text-tertiary">
                  By continuing, you agree to vanyshr&apos;s
                  <br />
                  <a href="/terms" className="text-primary-text no-underline">
                    Terms of use
                  </a>{" "}
                  and{" "}
                  <a href="/privacy" className="text-primary-text no-underline">
                    Privacy Policy
                  </a>
                </p>
              </form>
            </Sheet>
          </div>
        )}
      </div>
    </Page>
  );
}
