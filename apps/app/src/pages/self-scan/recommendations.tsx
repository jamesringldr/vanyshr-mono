import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Card } from "@vanyshr/ui/components/ui/card/card";
import { cx } from "@/utils/cx";
import type { StoredConsolidatedProfile } from "../pilot-scan/consolidated-profile";
import { buildRecommendations, TOP_COUNT, type Recommendation } from "./recommendation-engine";

const ICON_STROKE = 2.5;

function RecommendationCard({ rec }: { rec: Recommendation }) {
  const { Icon } = rec;
  return (
    <Card className="px-4 py-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-muted text-primary-text">
          <Icon className="size-5" strokeWidth={ICON_STROKE} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-lg font-semibold text-text-primary">{rec.title}</h3>
          <p className="mt-1 text-md leading-snug text-text-secondary">{rec.explainer}</p>
        </div>
      </div>
    </Card>
  );
}

/**
 * Recommendations slide of the self-scan report: what to do next, ordered by
 * what the scan actually found. Top few shown; the rest sit behind a toggle.
 */
export function RecommendationsBody({ stored }: { stored: StoredConsolidatedProfile }) {
  const recs = useMemo(() => buildRecommendations(stored), [stored]);
  const [showMore, setShowMore] = useState(false);
  const top = recs.slice(0, TOP_COUNT);
  const rest = recs.slice(TOP_COUNT);

  return (
    <div className="mx-auto w-full max-w-md px-6 pt-6">
      <h2 className="m-0 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        Recommended for you
      </h2>
      <p className="mt-1 text-sm text-text-secondary">Ordered by what we found in your scan.</p>

      <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
        {top.map((rec) => (
          <li key={rec.id}>
            <RecommendationCard rec={rec} />
          </li>
        ))}
      </ul>

      {rest.length > 0 && (
        <section className="mt-4" aria-label="More ways to protect yourself">
          <button
            type="button"
            aria-expanded={showMore}
            aria-controls="more-recommendations"
            onClick={() => setShowMore((v) => !v)}
            className="flex min-h-11 w-full items-center justify-between rounded-lg px-1 text-left text-md font-semibold text-text-primary outline-none transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-border-focus"
          >
            More ways to protect yourself
            <ChevronDown
              className={cx("size-5 shrink-0 transition-transform duration-base motion-reduce:transition-none", showMore && "rotate-180")}
              strokeWidth={ICON_STROKE}
              aria-hidden
            />
          </button>
          {showMore && (
            <ul id="more-recommendations" className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
              {rest.map((rec) => (
                <li key={rec.id}>
                  <RecommendationCard rec={rec} />
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
