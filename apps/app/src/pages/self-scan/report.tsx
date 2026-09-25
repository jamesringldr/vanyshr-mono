import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Menu } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { loadConsolidatedProfile } from "../pilot-scan/consolidated-profile";
import { RiskSummaryBody } from "../pilot-scan/risk-summary";
import { PreProfileBody } from "../pilot-scan/pre-profile";
import { BreachesBody } from "../pilot-scan/breaches";
import { BrokersBody } from "../pilot-scan/brokers";
import { EASE_OUT, scanUi } from "./chrome";

const SLIDES = ["Exposed Data", "Risk Summary", "Breaches", "Brokers"] as const;
const FOOTER_CLEARANCE = "pb-[260px]";

function TabBar({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  useEffect(() => {
    document.getElementById(`report-tab-${active}`)?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
    });
  }, [active]);

  return (
    <div
      className="flex items-center gap-4 overflow-x-auto scroll-px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Report sections"
    >
      {SLIDES.map((label, i) => {
        const isActive = active === i;
        return (
          <button
            key={label}
            id={`report-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`report-panel-${i}`}
            onClick={(e) => {
              onSelect(i);
              e.currentTarget.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
            }}
            className={cx(
              "relative shrink-0 whitespace-nowrap py-3 text-[13px] font-medium transition-colors duration-150",
              isActive ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary",
            )}
          >
            {label}
            {isActive && (
              <motion.span
                layoutId="report-tab-indicator"
                className="absolute inset-x-0 bottom-1.5 h-px rounded-full bg-accent-primary"
                transition={{ duration: 0.28, ease: EASE_OUT }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Post-scan report — risk-summary, pre-profile, breaches, and brokers as four
 * swipeable slides on one page, sharing a single header/tab bar rather than
 * each carrying its own. Native CSS scroll-snap rather than a framer-motion
 * drag track: no constraint-measuring or drag/animate-conflict tuning needed,
 * and it keeps the whole page free of CSS transforms — relevant because the
 * risk-summary slide's area-detail drawer is `position: fixed` (portaled to
 * document.body regardless, but a transform-free page is one less thing to
 * reason about).
 */
export function SelfScanReportPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [{ data: stored }] = useState(() => loadConsolidatedProfile());
  const [slide, setSlide] = useState(0);
  const [footerVisible, setFooterVisible] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setFooterVisible(true), 2000);
    return () => window.clearTimeout(t);
  }, []);

  function handleScroll() {
    const el = trackRef.current;
    if (!el) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  }

  function goToSlide(index: number) {
    const el = trackRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }

  if (!stored) {
    return (
      <div
        className="flex min-h-dvh w-full flex-col items-center justify-center bg-bg-page p-4"
        role="main"
        aria-label="Error loading report"
      >
        <div className="w-full max-w-md text-center">
          <h1 className="mb-2 text-[18px] font-semibold text-text-primary">No scan data found</h1>
          <p className="mb-6 text-[15px] text-text-secondary">
            Nothing came through from this scan — run it again from the start.
          </p>
          <Link to="/self-scan" className={cx(scanUi.primaryBtn, "text-white")}>
            Start over
          </Link>
        </div>
      </div>
    );
  }

  return (
    // Column of fixed-viewport height, not the page's own scroll -- each
    // tab panel below scrolls itself, independently, rather than sharing
    // one document scroll bound by whichever tab happens to be tallest.
    <div
      className={cx(scanUi.page, "h-dvh overflow-hidden")}
      role="main"
      aria-label="Scan report"
    >
      <div className={cx(scanUi.column, "shrink-0 px-6 pt-5")}>
        <header className="flex items-center justify-between">
          <img src={PrimaryLogoDark} alt="Vanyshr" className="h-7 w-auto object-contain" />
          <button type="button" aria-label="Open menu" className={scanUi.ghostBtn}>
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <TabBar active={slide} onSelect={goToSlide} />
      </div>

      <div
        ref={trackRef}
        onScroll={handleScroll}
        // flex-1 + min-h-0: the track takes exactly the remaining viewport
        // height, and (default stretch) every panel matches it -- so each
        // panel's own overflow-y-auto below scrolls independently, clearing
        // just its own content instead of the tallest tab's.
        className="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div
          id="report-panel-0"
          role="tabpanel"
          aria-labelledby="report-tab-0"
          className={cx("h-full w-full shrink-0 snap-start snap-always overflow-y-auto", FOOTER_CLEARANCE)}
          aria-hidden={slide !== 0}
        >
          <div className="mx-auto w-full max-w-md px-6">
            <PreProfileBody profile={stored.profile} selfScan />
          </div>
        </div>
        <div
          id="report-panel-1"
          role="tabpanel"
          aria-labelledby="report-tab-1"
          className={cx("h-full w-full shrink-0 snap-start snap-always overflow-y-auto", FOOTER_CLEARANCE)}
          aria-hidden={slide !== 1}
        >
          <RiskSummaryBody profile={stored.profile} />
        </div>
        <div
          id="report-panel-2"
          role="tabpanel"
          aria-labelledby="report-tab-2"
          className={cx("h-full w-full shrink-0 snap-start snap-always overflow-y-auto", FOOTER_CLEARANCE)}
          aria-hidden={slide !== 2}
        >
          <div className="mx-auto w-full max-w-md px-6">
            <BreachesBody profile={stored.profile} />
          </div>
        </div>
        <div
          id="report-panel-3"
          role="tabpanel"
          aria-labelledby="report-tab-3"
          className={cx("h-full w-full shrink-0 snap-start snap-always overflow-y-auto", FOOTER_CLEARANCE)}
          aria-hidden={slide !== 3}
        >
          <div className="mx-auto w-full max-w-md px-6">
            <BrokersBody
              brokers={stored.brokers ?? []}
              brokerFields={stored.brokerFields ?? {}}
              gated
            />
          </div>
        </div>
      </div>

      {/* Persistent CTA -- position: fixed, so (unlike the slides above) it
          isn't scoped to whichever tab is active. Every slide's own bottom
          padding (FOOTER_CLEARANCE) exists so its content can scroll clear
          of this regardless of which tab is showing. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4 pb-[env(safe-area-inset-bottom)]">
        <motion.footer
          className="mx-auto w-full max-w-md rounded-t-2xl border-t border-border-subtle bg-bg-surface px-5 pb-6 pt-5"
          initial={prefersReducedMotion ? false : { y: "100%" }}
          animate={{ y: footerVisible ? 0 : "100%" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.44, ease: EASE_OUT }}
        >
          <span className={scanUi.chip}>No credit card required</span>
          <h2 className="mt-3 text-[20px] font-semibold leading-tight tracking-tight text-text-primary">
            Time to Vanysh
          </h2>
          <p className="mt-1.5 text-[14px] leading-snug text-text-secondary">
            Start removing your exposed data from every broker we found
          </p>
          <button
            type="button"
            onClick={() => navigate("/signup")}
            className={cx(scanUi.primaryBtn, "mt-4 w-full text-white")}
          >
            Start Vanyshing
          </button>
        </motion.footer>
      </div>
    </div>
  );
}
