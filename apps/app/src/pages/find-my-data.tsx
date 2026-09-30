import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page, Sheet } from "konsta/react";
import { LoaderCircle, Menu, UserRoundSearch } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/lib/supabase";

/**
 * /find-my-data — approved spec: scratchpad/spec-review/entry.spec.md
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

// Primary button, DESIGN.md §11.1 (md size).
const primaryButton = cx(
  "flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-md font-bold transition-colors duration-fast",
  "bg-primary text-primary-on enabled:hover:bg-primary-hover enabled:active:bg-primary-active",
  "focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
  "aria-disabled:pointer-events-none",
  "disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-state-disabled-bg disabled:text-text-disabled",
);

// Mobile keyboards overlay the layout viewport rather than resizing it; only visualViewport shrinks.
function useKeyboardInset() {
  const [state, setState] = useState({ inset: 0, visibleHeight: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setState({
        inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        visibleHeight: Math.round(vv.height),
      });
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}

export function FindMyDataPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;

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
      sessionStorage.removeItem("pilotConsolidatedProfile");

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

        navigate("/find-my-data/loading");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not start scan");
      } finally {
        setIsSubmitting(false);
      }
    },
    [firstName, lastName, zipCode, zipLocation, isFormValid, isSubmitting, navigate],
  );

  return (
    <Page className="flex flex-col font-body" role="main" aria-label="Find my data">
      {isOpen ? (
        <Navbar
          className="static! mb-0"
          centerTitle
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          title={<BrandMark className="h-13.5 w-auto object-contain" />}
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
          centerTitle
          title={<BrandMark className="h-16.5 w-auto object-contain" />}
        />
      )}

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <HalftoneBackdrop className="h-full" />
        <div className="relative z-10 flex flex-1 flex-col justify-center px-6">
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
              // lines that it had before the 25% title reduction.
              style={{ fontSize: 51 }}
            />
          </h1>
          <p className="m-0 mt-4 text-xl font-bold text-text-primary">
            We find where your personal data is exposed and make it <span className="text-primary-text italic">vanysh!</span>
          </p>
        </div>

        <div className="relative z-20 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            className={primaryButton}
          >
            Find my data
          </button>
          <p className="m-0 mt-3 flex items-center justify-center gap-4 text-base text-text-secondary">
            <span>
              <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full bg-primary-text align-middle" /> No Credit Card
            </span>
            <span>
              <span aria-hidden="true" className="mr-2 inline-block size-2.5 rounded-full bg-primary-text align-middle" /> No Sign Up
            </span>
          </p>
        </div>

        {isOpen && (
          <Sheet
            opened={isOpen}
            onBackdropClick={() => setIsOpen(false)}
            className="flex max-h-[66%] flex-col rounded-t-lg! shadow-xl!"
            style={
              keyboardOpen
                ? {
                    top: `calc(100% - ${keyboard.inset}px)`,
                    maxHeight: `${keyboard.visibleHeight - 16}px`,
                  }
                : undefined
            }
          >
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5">
                <div className="flex items-stretch gap-3">
                  <div className="relative w-1/5 shrink-0" aria-hidden="true">
                    <UserRoundSearch className="absolute inset-0 size-full text-text-primary" />
                  </div>
                  <p className="m-0 w-4/5 text-left text-lg font-semibold text-text-primary">
                    Find your exposures and get a clear plan on how to start vanyshing
                  </p>
                </div>

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
              </div>

              <div
                className={cx(
                  "flex shrink-0 flex-col gap-4 px-6 pt-4",
                  keyboardOpen ? "pb-4" : "pb-[max(1.5rem,env(safe-area-inset-bottom))]",
                )}
              >
                {submitError && (
                  <p className="m-0 text-center text-xs font-medium text-status-danger">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={!isFormValid && !isSubmitting}
                  aria-disabled={isSubmitting || undefined}
                  className={primaryButton}
                >
                  {isSubmitting && <LoaderCircle className="size-4 shrink-0 animate-spin" aria-hidden="true" />}
                  Find my data
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
              </div>
            </form>
          </Sheet>
        )}
      </div>
    </Page>
  );
}
