import { useEffect, useRef, useState } from "react";
import { Menu, DollarSign } from "lucide-react";
import { Navbar, Page, Toolbar } from "konsta/react";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryLogoLight from "@vanyshr/ui/assets/PrimaryLogo.png";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@vanyshr/ui/components/ui/tabs/tabs";
import { BadgeWithIcon } from "@vanyshr/ui/components/ui/badge/badge";
import { Button } from "@vanyshr/ui/components/ui/buttons/button";
import { cx } from "@/utils/cx";
import { loadConsolidatedProfile } from "./consolidated-profile";
import { RiskSummaryBody } from "./risk-summary";
import { PreProfileBody } from "./pre-profile";
import { BreachesBody } from "./breaches";
import { BrokersBody } from "./brokers";

const SLIDES = ["Exposed Data", "Risk Summary", "Breaches", "Brokers"] as const;
// Room for the fixed CTA footer below, so its last slide's content can
// scroll clear of it -- the footer is one persistent element shared by all
// four slides (see below), not scoped to whichever tab is active.
const FOOTER_CLEARANCE = "pb-52";

/** Brand logo, swapped by theme: dark artwork by default, light artwork under `.light`. */
function Logo() {
  return (
    <>
      <img src={PrimaryLogoDark} alt="Vanyshr" className="h-9 w-auto in-[.light]:hidden" />
      <img src={PrimaryLogoLight} alt="Vanyshr" className="hidden h-9 w-auto in-[.light]:block" />
    </>
  );
}

function ReportNavbar() {
  return (
    <Navbar
      // Scrolls away with the page, as before (Konsta's default is sticky).
      className="static!"
      centerTitle
      // Konsta's iOS glass bubble behind the slot isn't token-bridged (literal white); keep the plain button.
      rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
      title={<Logo />}
      right={
        <button
          type="button"
          aria-label="Open menu"
          className="flex size-11 items-center justify-center rounded-md text-text-primary outline-none hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-border-focus"
        >
          <Menu className="size-6" />
        </button>
      }
    />
  );
}

/**
 * Post-scan report — risk-summary, pre-profile, breaches, and brokers as four
 * swipeable slides on one page, sharing a single header/tab bar rather than
 * each carrying its own. Native CSS scroll-snap rather than a drag track: no
 * constraint-measuring or drag/animate-conflict tuning needed, and it keeps
 * the whole page free of CSS transforms — relevant because the risk-summary
 * slide's area-detail sheet is `position: fixed` (portaled to document.body
 * regardless, but a transform-free page is one less thing to reason about).
 * Tabs are Radix (shadcn catalog), controlled by the scroll position so
 * swiping and tab selection stay in sync.
 */
export function PilotReportPage() {
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
      <Page className="font-body" role="main" aria-label="Error loading report">
        <div className="flex min-h-full flex-col items-center justify-center p-4 text-center">
          <h1 className="mb-2 font-display text-xl font-semibold text-text-primary">No scan data found</h1>
          <p className="mb-6 text-md text-text-secondary">
            Nothing came through from this scan — run it again from the start.
          </p>
          <Button href="/pilot-scan" size="xl">
            Start over
          </Button>
        </div>
      </Page>
    );
  }

  const panelClass = cx("mt-0 w-full shrink-0 snap-start snap-always", FOOTER_CLEARANCE);

  return (
    <Page className="font-body" role="main" aria-label="Scan report">
      <ReportNavbar />

      <Tabs value={String(slide)} onValueChange={(value) => goToSlide(Number(value))}>
        <div className="px-4">
          <TabsList
            aria-label="Report sections"
            className="scrollbar-hide w-full justify-start gap-4 overflow-x-auto rounded-none bg-transparent p-0"
          >
            {SLIDES.map((label, i) => (
              <TabsTrigger
                key={label}
                value={String(i)}
                className="group relative shrink-0 rounded-none px-0 py-0 text-md font-medium text-text-secondary ring-offset-bg-app hover:text-text-primary data-[state=active]:bg-transparent data-[state=active]:text-text-primary data-[state=active]:shadow-none"
              >
                {label}
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-1 h-0.5 scale-x-0 rounded-full bg-primary transition-transform duration-base ease-standard group-data-[state=active]:scale-x-100 motion-reduce:transition-none"
                />
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div
          ref={trackRef}
          onScroll={handleScroll}
          className="scrollbar-hide flex snap-x snap-mandatory overflow-x-auto scroll-smooth"
        >
          <TabsContent forceMount value="0" className={panelClass} aria-hidden={slide !== 0}>
            <div className="px-4">
              <PreProfileBody profile={stored.profile} />
            </div>
          </TabsContent>
          <TabsContent forceMount value="1" className={panelClass} aria-hidden={slide !== 1}>
            <RiskSummaryBody profile={stored.profile} />
          </TabsContent>
          <TabsContent forceMount value="2" className={panelClass} aria-hidden={slide !== 2}>
            <div className="px-4">
              <BreachesBody profile={stored.profile} />
            </div>
          </TabsContent>
          <TabsContent forceMount value="3" className={panelClass} aria-hidden={slide !== 3}>
            <div className="px-4">
              <BrokersBody brokers={stored.brokers ?? []} brokerFields={stored.brokerFields ?? {}} />
            </div>
          </TabsContent>
        </div>
      </Tabs>

      {/* Persistent CTA -- position: fixed, so (unlike the slides above) it
          isn't scoped to whichever tab is active. Every slide's own bottom
          padding (FOOTER_CLEARANCE) exists so its content can scroll clear
          of this regardless of which tab is showing. Revealed after 2s by a
          CSS transition (instant under prefers-reduced-motion). */}
      <div
        className={cx(
          "fixed inset-x-0 bottom-0 z-30 transition-transform duration-slower ease-standard motion-reduce:transition-none",
          footerVisible ? "translate-y-0" : "translate-y-full",
        )}
      >
        <Toolbar className="pb-0!" innerClassName="h-auto! w-full!">
          <footer className="w-full rounded-t-lg bg-bg-surface px-4 pb-safe-6 pt-4 shadow-xl">
            <BadgeWithIcon type="pill-color" color="brand" size="sm" iconLeading={DollarSign}>
              No Credit Card Required
            </BadgeWithIcon>
            <h2 className="mt-3 font-display text-xl font-semibold leading-tight tracking-tight text-text-primary">
              Time to Vanysh
            </h2>
            <p className="mt-1 text-md leading-snug text-text-secondary">
              Start removing your exposed data from every broker we found
            </p>
            <Button href="/pilot-scan/start" size="xl" className="mt-4 w-full">
              Start Vanyshing
            </Button>
          </footer>
        </Toolbar>
      </div>
    </Page>
  );
}
