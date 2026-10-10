import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page, Sheet } from "konsta/react";
import { ChevronDown, ChevronRight, LoaderCircle, Menu, ShieldCheck, Zap } from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandMark } from "@/components/BrandMark";
import { supabase } from "@/lib/supabase";

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
  const [state, setState] = useState({ inset: 0, visibleHeight: 0, offsetTop: 0 });

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () =>
      setState({
        inset: Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop)),
        visibleHeight: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
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

  // The document behind the Page shows wherever iOS reserves space the Page can't cover
  // (status bar, the keyboard's accessory bar) and whenever the visual viewport is panned.
  // Which part of it is visible varies, so the whole thing is a solid color rather than a
  // gradient: navy normally, the drawer surface while the drawer is open (plus a navy status-bar
  // band so the top still matches the app bar). The document is locked so it can't be dragged.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const targets = [html, body];
    const props = ["backgroundColor", "backgroundImage", "backgroundSize", "backgroundRepeat", "backgroundPosition"] as const;
    const prevStyles = targets.map((el) => props.map((p) => el.style[p]));
    const prevLock = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyWidth: body.style.width,
    };
    for (const el of targets) {
      el.style.backgroundColor = isOpen ? "var(--color-bg-surface)" : "var(--color-brand-navy)";
      if (isOpen) {
        el.style.backgroundImage = "linear-gradient(var(--color-brand-navy), var(--color-brand-navy))";
        el.style.backgroundSize = "100% env(safe-area-inset-top)";
        el.style.backgroundRepeat = "no-repeat";
        el.style.backgroundPosition = "top";
      }
    }
    if (isOpen) {
      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "none";
      body.style.position = "fixed";
      body.style.inset = "0";
      body.style.width = "100%";
    }
    return () => {
      targets.forEach((el, t) => props.forEach((p, k) => (el.style[p] = prevStyles[t][k])));
      html.style.overflow = prevLock.htmlOverflow;
      html.style.overscrollBehavior = prevLock.htmlOverscroll;
      body.style.position = prevLock.bodyPosition;
      body.style.inset = prevLock.bodyInset;
      body.style.width = prevLock.bodyWidth;
    };
  }, [isOpen]);

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

        navigate("/loading");
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : "Could not start scan");
      } finally {
        setIsSubmitting(false);
      }
    },
    [firstName, lastName, zipCode, zipLocation, isFormValid, isSubmitting, navigate],
  );

  return (
    <Page
      className="flex flex-col bg-brand-navy! font-body"
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
          left={<BrandMark className="h-13.5 w-auto object-contain" />}
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
          left={<BrandMark className="h-16.5 w-auto object-contain" />}
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

        <div className="relative z-20 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
          <Sheet
            opened={isOpen}
            onBackdropClick={() => setIsOpen(false)}
            className="flex max-h-[66%] flex-col rounded-t-lg! shadow-xl!"
            style={keyboardOpen ? { maxHeight: `${keyboard.visibleHeight - 16}px` } : undefined}
          >
            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pt-5">
                <span className="inline-flex w-fit items-center gap-1.5 self-center rounded-full border border-primary-border bg-primary-muted px-3 py-1 text-xs font-medium text-primary-text">
                  <Zap className="size-3.5 shrink-0" aria-hidden="true" />
                  Get Real Results in ~3min
                </span>

                <p className="m-0 text-left text-lg font-semibold text-text-primary">
                  <span style={{ fontSize: 18.75 }}>Let&apos;s find your data!</span>
                  <br />
                  Get a tailored plan to start Vanyshing
                </p>

                <div className="flex flex-col gap-3">
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
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
                        className="h-11 w-full rounded-md border border-border bg-bg-elevated px-4 text-[16px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast focus:border-border-focus disabled:opacity-50"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
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
                        className="h-11 w-full rounded-md border border-border bg-bg-elevated px-4 text-[16px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast focus:border-border-focus disabled:opacity-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="fmd-zip" className="sr-only">
                      Zip Code
                    </label>
                    <div className="relative">
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
                        "h-11 w-full rounded-md border bg-bg-elevated px-4 text-[16px] text-text-primary placeholder:text-text-tertiary outline-none transition-colors duration-fast disabled:opacity-50",
                        zipStatus === "invalid" ? "border-status-danger" : "border-border focus:border-border-focus",
                      )}
                    />
                    {(zipStatus === "checking" || zipStatus === "invalid" || (zipStatus === "valid" && zipLocation)) && (
                      // Mirrors the typed zip invisibly so the city/state lands right after it, inside the field.
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 flex items-center whitespace-pre px-4 text-[16px]"
                      >
                        <span className="invisible">{zipCode}</span>
                        <span className="text-text-tertiary">{"  |  "}</span>
                        {zipStatus === "invalid" ? (
                          <span className="font-medium text-status-danger">Invalid zip</span>
                        ) : (
                          <span className="font-medium text-text-secondary">
                            {zipStatus === "checking" || !zipLocation ? "Checking zip…" : `${zipLocation.city}, ${zipLocation.state}`}
                          </span>
                        )}
                      </span>
                    )}
                    </div>
                  </div>
                </div>
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

                <ul className="m-0 flex list-none items-center justify-center gap-4 p-0 text-xs text-text-secondary">
                  {["No Credit Card", "No Sign Up"].map((label) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>

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
