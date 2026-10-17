import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Sheet } from "konsta/react";
import { Zap } from "lucide-react";
import { cx } from "@/utils/cx";

/**
 * Shared "Find my data" entry drawer (name + zip → /finding-your-data) used by `/` and `/landing`.
 * Extracted verbatim from pages/find-my-data.tsx so both entry points run the same scan sequence.
 */

// Primary button, DESIGN.md §11.1 (md size).
export const primaryButton = cx(
  "flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-md font-bold transition-colors duration-fast",
  "bg-primary text-primary-on enabled:hover:bg-primary-hover enabled:active:bg-primary-active",
  "focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus",
  "aria-disabled:pointer-events-none",
  "disabled:cursor-not-allowed disabled:border disabled:border-border disabled:bg-state-disabled-bg disabled:text-text-disabled",
);

// Mobile keyboards overlay the layout viewport rather than resizing it; only visualViewport shrinks.
export function useKeyboardInset() {
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
    // iOS can report mid-animation values on focus and not fire again until the user scrolls,
    // so re-measure a few times while the keyboard settles.
    let timers: number[] = [];
    const settle = () => {
      timers.forEach(clearTimeout);
      timers = [100, 300, 600].map((ms) => window.setTimeout(update, ms));
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    document.addEventListener("focusin", settle);
    document.addEventListener("focusout", settle);
    return () => {
      timers.forEach(clearTimeout);
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      document.removeEventListener("focusin", settle);
      document.removeEventListener("focusout", settle);
    };
  }, []);

  return state;
}

type Keyboard = ReturnType<typeof useKeyboardInset>;

/**
 * Page-level side effects while the drawer is open: document background (keyboard strip) and scroll lock.
 * `restColor` is the page's own canvas color when no drawer field has focus.
 */
export function useDrawerPageEffects(isOpen: boolean, fieldFocused: boolean, restColor: string) {
  // The document behind the Page shows in the strip iOS keeps between the drawer and the keyboard
  // (accessory bar, URL pill), which nothing inside the page wrapper can reliably cover. While a
  // drawer field has focus it's the drawer surface so that strip matches the drawer; otherwise it's
  // navy. Safari's bottom toolbar is hidden while the keyboard is up, and the fixed navy CTA row
  // gives it navy to re-sample once the drawer closes.
  const drawerKeyboardUp = isOpen && fieldFocused;
  useEffect(() => {
    const targets = [document.documentElement, document.body];
    const prev = targets.map((el) => el.style.backgroundColor);
    return () => targets.forEach((el, i) => (el.style.backgroundColor = prev[i]));
  }, []);
  useEffect(() => {
    const color = drawerKeyboardUp ? "var(--color-bg-surface)" : restColor;
    for (const el of [document.documentElement, document.body]) el.style.backgroundColor = color;
  }, [drawerKeyboardUp]);

  // While the drawer is open, nothing behind it may scroll. With the keyboard up iOS pans the
  // visual viewport on any drag, and overflow: hidden doesn't stop that — only cancelling
  // touchmove does. Drags inside an element that genuinely has content to scroll still work.
  useEffect(() => {
    if (!isOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyPosition: body.style.position,
      bodyInset: body.style.inset,
      bodyWidth: body.style.width,
    };
    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    body.style.position = "fixed";
    body.style.inset = "0";
    body.style.width = "100%";

    const onTouchMove = (e: TouchEvent) => {
      for (let el = e.target as HTMLElement | null; el && el !== body; el = el.parentElement) {
        const { overflowY } = getComputedStyle(el);
        if ((overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight) return;
      }
      e.preventDefault();
    };
    document.addEventListener("touchmove", onTouchMove, { passive: false });

    return () => {
      document.removeEventListener("touchmove", onTouchMove);
      html.style.overflow = prev.htmlOverflow;
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.position = prev.bodyPosition;
      body.style.inset = prev.bodyInset;
      body.style.width = prev.bodyWidth;
    };
  }, [isOpen]);
}

/** Fills the strip iOS keeps between the visual viewport and the keyboard with the drawer surface.
 *  Render outside the (transformed) Page. */
export function KeyboardStripFill({ keyboard }: { keyboard: Keyboard }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 z-40 bg-bg-surface"
      style={{ top: keyboard.offsetTop + keyboard.visibleHeight, height: window.innerHeight }}
    />
  );
}

/** Render inside the Page (Konsta Sheet positions against it). */
export function FindMyDataDrawer({
  keyboard,
  onClose,
  onFieldFocusChange,
}: {
  keyboard: Keyboard;
  onClose: () => void;
  onFieldFocusChange: (focused: boolean) => void;
}) {
  const navigate = useNavigate();
  const keyboardOpen = keyboard.inset > 0;

  // ── Form state ──
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [zipStatus, setZipStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [zipLocation, setZipLocation] = useState<{ city: string; state: string } | null>(null);

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

  // Submit — same sessionStorage keys as apps/app/src/pages/self-scan/entry.tsx, but goes straight
  // to /finding-your-data, which starts the scan (intro-scan) itself.
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!isFormValid || !zipLocation) return;

      sessionStorage.removeItem("pilotScanResult");
      sessionStorage.removeItem("pilotScanError");
      sessionStorage.removeItem("pilotPhase2Result");
      sessionStorage.removeItem("pilotConfirmedEmails");
      sessionStorage.removeItem("pendingScanId");
      sessionStorage.removeItem("pilotConsolidatedProfile");

      sessionStorage.setItem("pendingScanRequest", crypto.randomUUID());
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

      navigate("/finding-your-data");
    },
    [firstName, lastName, zipCode, zipLocation, isFormValid, navigate],
  );

  return (
    <Sheet
      opened
      onBackdropClick={onClose}
      className="flex max-h-[66%] flex-col rounded-t-lg! shadow-xl!"
      style={keyboardOpen ? { maxHeight: `${keyboard.visibleHeight - 16}px` } : undefined}
    >
      <form
        onSubmit={handleSubmit}
        onFocus={() => onFieldFocusChange(true)}
        // Ignore blur when focus is just moving to another field in the form.
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onFieldFocusChange(false);
        }}
        className="flex min-h-0 flex-1 flex-col"
      >
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
                  name="given-name"
                  type="text"
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
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
                  name="family-name"
                  type="text"
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
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
                name="postal-code"
                type="text"
                inputMode="numeric"
                maxLength={5}
                placeholder="Zip Code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
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
            disabled={!isFormValid}
            className={primaryButton}
          >
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
  );
}
