import { useRef, useState } from "react";
import { Link } from "react-router";
import { Menu } from "lucide-react";
import { motion } from "framer-motion";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { cx } from "@/utils/cx";
import { loadConsolidatedProfile } from "./consolidated-profile";
import { RiskSummaryBody } from "./risk-summary";
import { PreProfileBody } from "./pre-profile";
import { BreachesBody } from "./breaches";
import { BrokersBody } from "./brokers";

const SLIDES = ["Risk Summary", "Your Data", "Breaches", "Brokers"] as const;

function TabBar({ active, onSelect }: { active: number; onSelect: (index: number) => void }) {
  return (
    <div
      className="flex items-center gap-5 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Report sections"
    >
      {SLIDES.map((label, i) => {
        const isActive = active === i;
        return (
          <button
            key={label}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(i)}
            className={cx(
              "relative shrink-0 whitespace-nowrap pb-2 text-sm font-medium transition-colors",
              isActive ? "text-white" : "text-white/45 hover:text-white/70",
            )}
          >
            {label}
            {isActive && (
              <motion.span
                layoutId="report-tab-indicator"
                className="absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[#00BFFF]"
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
export function PilotReportPage() {
  const [{ data: stored }] = useState(() => loadConsolidatedProfile());
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

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
        className="flex min-h-screen w-full flex-col items-center justify-center bg-[#022136] p-4 font-ubuntu"
        role="main"
        aria-label="Error loading report"
      >
        <div className="w-full max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold text-white">No scan data found</h1>
          <p className="mb-6 text-sm text-[#B8C4CC]">
            Nothing came through from this scan — run it again from the start.
          </p>
          <Link
            to="/pilot-scan"
            className="inline-flex h-[44px] items-center justify-center rounded-xl bg-[#00BFFF] px-6 font-semibold text-white transition-all hover:bg-[#1196E0]"
          >
            Start over
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#022136] font-ubuntu" role="main" aria-label="Scan report">
      <div className="mx-auto max-w-3xl px-4 pt-4 sm:pt-6">
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
        className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="w-full shrink-0 snap-start snap-always" aria-hidden={slide !== 0}>
          <RiskSummaryBody profile={stored.profile} />
        </div>
        <div className="w-full shrink-0 snap-start snap-always" aria-hidden={slide !== 1}>
          <div className="mx-auto max-w-3xl px-4 pb-16">
            <PreProfileBody profile={stored.profile} />
          </div>
        </div>
        <div className="w-full shrink-0 snap-start snap-always" aria-hidden={slide !== 2}>
          <div className="mx-auto max-w-3xl px-4 pb-16">
            <BreachesBody profile={stored.profile} />
          </div>
        </div>
        <div className="w-full shrink-0 snap-start snap-always" aria-hidden={slide !== 3}>
          <div className="mx-auto max-w-3xl px-4 pb-16">
            <BrokersBody brokers={stored.brokers ?? []} brokerFields={stored.brokerFields ?? {}} />
          </div>
        </div>
      </div>
    </div>
  );
}
