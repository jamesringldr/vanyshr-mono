import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cx } from "@/utils/cx";
import { EASE_OUT, scanUi } from "./chrome";

export interface EducationalCardsProps {
  onCardClick?: (cardId: "brokers" | "risks") => void;
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
}

type Slide = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  action?: { label: string; cardId: "brokers" | "risks" };
};

const SLIDES: Slide[] = [
  {
    id: "brokers",
    kicker: "Data brokers",
    title: "How they get your data",
    body: "People-search sites buy, scrape, and resell public records — then keep selling the same file.",
    action: { label: "See how", cardId: "brokers" },
  },
  {
    id: "risks",
    kicker: "Exposure",
    title: "What that access enables",
    body: "Once a record is public, scammers and spammers can reach you without ever breaking in.",
    action: { label: "Learn more", cardId: "risks" },
  },
  {
    id: "where",
    kicker: "This scan",
    title: "Where we look",
    body: "People-search brokers, leaked credentials, and accounts tied to the name and zip you entered.",
  },
  {
    id: "privacy",
    kicker: "Your scan",
    title: "Nothing is stored to market to you",
    body: "A SelfScan does not create a profile. Results stay on this device until you choose to keep going.",
  },
  {
    id: "report",
    kicker: "Next",
    title: "What the report will show",
    body: "A scored picture of what is already public — sources, brokers, and the records that matched you.",
  },
];

export const EDUCATIONAL_SLIDE_COUNT = SLIDES.length;

export function EducationalCards({
  onCardClick,
  activeIndex,
  onActiveIndexChange,
}: EducationalCardsProps) {
  const prefersReducedMotion = useReducedMotion();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    programmaticRef.current = true;
    el.scrollTo({
      left: activeIndex * el.clientWidth,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
    const t = window.setTimeout(() => {
      programmaticRef.current = false;
    }, prefersReducedMotion ? 0 : 420);
    return () => window.clearTimeout(t);
  }, [activeIndex, prefersReducedMotion]);

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.12 }}
      className="flex w-full flex-col"
    >
      <div
        ref={scrollerRef}
        className="flex w-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          if (programmaticRef.current) return;
          const el = scrollerRef.current;
          if (!el) return;
          const next = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
          if (next !== activeIndex && next >= 0 && next < SLIDES.length) {
            onActiveIndexChange(next);
          }
        }}
      >
        {SLIDES.map((slide) => (
          <article
            key={slide.id}
            className="w-full shrink-0 snap-center px-1"
            aria-roledescription="slide"
            aria-label={slide.title}
          >
            <div className="flex min-h-[200px] flex-col justify-between rounded-xl border border-border-subtle bg-bg-surface px-5 py-5">
              <div>
                <p className={scanUi.kicker}>{slide.kicker}</p>
                <h2 className="mt-3 text-[22px] font-semibold leading-snug tracking-tight text-text-primary">
                  {slide.title}
                </h2>
                <p className="mt-3 max-w-[42ch] text-[15px] leading-relaxed text-text-secondary">
                  {slide.body}
                </p>
              </div>
              {slide.action ? (
                <button
                  type="button"
                  onClick={() => onCardClick?.(slide.action!.cardId)}
                  className="mt-6 self-start text-[14px] font-semibold text-accent-primary transition-colors duration-150 hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary"
                >
                  {slide.action.label}
                </button>
              ) : (
                <span className="mt-6 text-[13px] text-text-tertiary">While we search</span>
              )}
            </div>
          </article>
        ))}
      </div>
    </motion.div>
  );
}

export function SlideDots({
  count,
  activeIndex,
  onSelect,
}: {
  count: number;
  activeIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-1.5" role="tablist" aria-label="Scan explainer">
      {Array.from({ length: count }).map((_, i) => (
        <button
          key={i}
          type="button"
          role="tab"
          aria-selected={i === activeIndex}
          aria-label={`Slide ${i + 1} of ${count}`}
          onClick={() => onSelect(i)}
          className="flex h-11 w-11 items-center justify-center"
        >
          <span
            className={cx(
              "h-1.5 rounded-full transition-[width,background-color] duration-150",
              i === activeIndex ? "w-4 bg-accent-primary" : "w-1.5 bg-border-subtle",
            )}
          />
        </button>
      ))}
    </div>
  );
}
