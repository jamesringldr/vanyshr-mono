import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Menu, DollarSign } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { loadConsolidatedProfile } from "../pilot-scan/consolidated-profile";
import { RiskSummaryBody } from "../pilot-scan/risk-summary";
import { PreProfileBody } from "../pilot-scan/pre-profile";
import { BreachesBody } from "../pilot-scan/breaches";
import { BrokersBody } from "../pilot-scan/brokers";

const SLIDES = ["Exposed Data", "Risk Summary", "Breaches", "Brokers"] as const;
const DRAWER_EASE = [0.2, 0, 0, 1] as const;
// Room for the fixed CTA footer below, so its last slide's content can
// scroll clear of it -- the footer is one persistent element shared by all
// four slides (see below), not scoped to whichever tab is active. Measured
// footer height is ~225px; 240px leaves a small safety margin.
const FOOTER_CLEARANCE = "pb-[240px]";

function TabBar({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return (
    <div
      className="flex items-center gap-5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
            onClick={() => onSelect(i)}
            className={cx(
              "relative shrink-0 whitespace-nowrap py-3 text-sm font-medium transition-colors",
              isActive ? "text-white" : "text-white/60 hover:text-white/80",
            )}
          >
            {label}
            {isActive && (
              <motion.span
                layoutId="report-tab-indicator"
                className="absolute inset-x-0 bottom-1.5 h-[2px] rounded-full bg-accent-primary"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
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
        className="flex min-h-screen w-full flex-col items-center justify-center bg-bg-page p-4 font-ubuntu"
        role="main"
        aria-label="Error loading report"
      >
        <div className="w-full max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold text-white">No scan data found</h1>
          <p className="mb-6 text-sm text-text-secondary">
            Nothing came through from this scan — run it again from the start.
          </p>
          <Link
            to="/self-scan"
            className="inline-flex h-[44px] items-center justify-center rounded-xl bg-accent-primary px-6 font-semibold text-white transition-all hover:bg-accent-hover"
          >
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
      className="flex h-screen w-full flex-col overflow-hidden bg-bg-page font-ubuntu"
      role="main"
      aria-label="Scan report"
    >
      <div className="mx-auto w-full max-w-3xl shrink-0 px-4 pt-4 sm:pt-6">
        <header className="flex h-14 items-center justify-between gap-4">
          <div className="w-10 shrink-0" aria-hidden />
          <div className="flex min-w-0 flex-1 justify-center">
            <img src={PrimaryLogoDark} alt="Vanyshr" className="h-[2.1875rem] w-auto sm:h-[2.5rem]" />
          </div>
          <button
            type="button"
            aria-label="Open menu"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white outline-none transition hover:bg-white/10"
          >
            <Menu className="h-6 w-6" />
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
          <div className="mx-auto max-w-3xl px-4">
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
          <div className="mx-auto max-w-3xl px-4">
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
          <div className="mx-auto max-w-3xl px-4">
            <BrokersBody brokers={stored.brokers ?? []} brokerFields={stored.brokerFields ?? {}} />
          </div>
        </div>
      </div>

      {/* Persistent CTA -- position: fixed, so (unlike the slides above) it
          isn't scoped to whichever tab is active. Every slide's own bottom
          padding (FOOTER_CLEARANCE) exists so its content can scroll clear
          of this regardless of which tab is showing. */}
      <div className="fixed inset-x-0 bottom-0 z-30 px-4">
        <motion.footer
          className="w-full rounded-t-[28px] bg-bg-surface-secondary px-5 pb-6 pt-5 shadow-[0_0_40px_rgba(20,171,254,0.18)]"
          initial={prefersReducedMotion ? false : { y: "100%" }}
          animate={{ y: footerVisible ? 0 : "100%" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: DRAWER_EASE }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border-subtle bg-bg-page px-3 py-1 text-[11px] font-medium text-accent-primary">
            <DollarSign className="h-3 w-3" />
            No Credit Card Required
          </span>
          <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-white">
            Time to Vanysh
          </h2>
          <p className="mt-1.5 text-sm leading-snug text-text-secondary">
            Start removing your exposed data from every broker we found
          </p>
          <button
            type="button"
            // No self-scan equivalent of the signup/start flow yet -- still
            // hands off into pilot-scan's, same as the loading page's report
            // destination fallback.
            onClick={() => navigate("/pilot-scan/start")}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-accent-primary text-[17px] font-semibold text-white"
          >
            Start Vanyshing
          </button>
        </motion.footer>
      </div>
    </div>
  );
}
