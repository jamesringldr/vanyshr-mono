import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, useMotionValue, useReducedMotion, type PanInfo } from "framer-motion";
import { Page, Sheet } from "konsta/react";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import {
  TriangleAlert,
  Shield,
  Mail,
  Fingerprint,
  Key,
  Users,
  House,
  UserSearch,
  X,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@vanyshr/ui/components/ui/card/card";
import { Badge } from "@vanyshr/ui/components/ui/badge/badge";
import { Button } from "@vanyshr/ui/components/ui/buttons/button";
import { cx } from "@/utils/cx";
import { buildRiskAreas, loadConsolidatedProfile, type ConsolidatedProfile, type RiskArea } from "./consolidated-profile";

const LEVEL_BARS = 4;
// Radar axis labels sit this far (px) beyond Recharts' tick position.
const AXIS_LABEL_OFFSET = 16;

const AREA_ICONS: Record<string, LucideIcon> = {
  critical: TriangleAlert,
  scam: Shield,
  family: Users,
  identity: Fingerprint,
  accounts: Key,
  spam: Mail,
  property: House,
  other: UserSearch,
};

// Clockwise from the top — RadarChart's default start angle.
const HEX_ORDER = ["critical", "scam", "family", "identity", "accounts", "spam"] as const;
const LIST_ORDER = [
  "critical",
  "scam",
  "spam",
  "identity",
  "accounts",
  "family",
  "property",
  "other",
] as const;

type AreaView = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  score: number;
  items: RiskArea["items"];
  breachCards?: RiskArea["breachCards"];
  Icon: LucideIcon;
};

function levelFromScore(score: number) {
  return Math.min(LEVEL_BARS, Math.max(1, Math.round(score * LEVEL_BARS)));
}

function LevelBars({ level }: { level: number }) {
  return (
    <div className="flex h-8 items-end gap-1" aria-hidden>
      {Array.from({ length: LEVEL_BARS }, (_, i) => {
        const on = i < level;
        const height = 10 + i * 5;
        return (
          <span
            key={i}
            className={cx("w-1.5 rounded-xs", on ? "bg-primary" : "bg-bg-elevated")}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

function isHttpUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

/** Radar axis label: the area's icon in a ring, name underneath, pushed outward along the axis. */
function AxisLabel({
  x,
  y,
  payload,
  areas,
}: {
  x: number;
  y: number;
  payload: { index: number; coordinate: number };
  areas: AreaView[];
}) {
  const area = areas[payload.index];
  const angle = (-payload.coordinate * Math.PI) / 180;
  const px = x + Math.cos(angle) * AXIS_LABEL_OFFSET;
  const py = y + Math.sin(angle) * AXIS_LABEL_OFFSET;
  const Icon = area.Icon;
  return (
    <g transform={`translate(${px} ${py})`}>
      <circle r={16} className="fill-bg-app stroke-border-subtle" />
      <Icon x={-8} y={-8} width={16} height={16} className="text-text-primary" />
      <text y={30} textAnchor="middle" className="fill-text-primary text-xs font-medium">
        {area.label}
      </text>
    </g>
  );
}

/**
 * Risk summary slide content — radar chart + area list, no page chrome. Used
 * standalone by PilotRiskSummaryPage below, and as one slide of the report
 * carousel (report.tsx), which supplies its own shared header instead.
 *
 * The area-detail sheet is rendered via a portal to document.body rather
 * than inline: inside the carousel it sits under a scroll track, and a
 * `position: fixed` descendant of a transformed ancestor is positioned
 * relative to that ancestor instead of the viewport — the portal sidesteps
 * that entirely. The sheet is Konsta's; framer-motion stays only for its
 * drag-to-dismiss gesture, which CSS can't express.
 */
export function RiskSummaryBody({ profile }: { profile: ConsolidatedProfile }) {
  const prefersReducedMotion = useReducedMotion();
  const areas = useMemo(() => buildRiskAreas(profile), [profile]);
  // activeArea outlives `open` so the sheet keeps its content while sliding out.
  const [activeArea, setActiveArea] = useState<AreaView | null>(null);
  const [open, setOpen] = useState(false);
  const dragY = useMotionValue(0);

  const byId = useMemo(() => {
    const map = new Map(areas.map((a) => [a.id, a]));
    return map;
  }, [areas]);

  const hexAreas: AreaView[] = HEX_ORDER.map((id) => {
    const built = byId.get(id);
    return {
      id,
      label: built?.label ?? id,
      summary: built?.summary ?? "",
      detail: built?.detail ?? "",
      score: built?.score ?? 0.1,
      items: built?.items ?? [],
      Icon: AREA_ICONS[id],
    };
  });

  const listAreas: AreaView[] = LIST_ORDER.flatMap((id) => {
    const built = byId.get(id);
    if (!built) return [];
    if (id === "other" && built.items.length === 0) return [];
    return [{ ...built, Icon: AREA_ICONS[id] }];
  });

  function openArea(area: AreaView) {
    dragY.set(0);
    setActiveArea(area);
    setOpen(true);
  }

  // Konsta forwards unknown props to `component` (motion.div here), but types
  // them as plain div props — so the drag props go through one untyped spread.
  const sheetDragProps: Record<string, unknown> = {
    style: { y: dragY },
    drag: prefersReducedMotion ? false : "y",
    dragConstraints: { top: 0 },
    dragElastic: 0.2,
    onDragEnd: (_: unknown, info: PanInfo) => {
      if (info.offset.y > 120) setOpen(false);
    },
  };

  const ActiveIcon = activeArea?.Icon;

  return (
    <div className="relative flex w-full flex-col items-center px-6">
      <div className="w-full">
        <div
          role="img"
          aria-label="Risk categories arranged on a hexagonal chart"
          className="mx-auto mt-8 aspect-square w-full max-w-xs"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={hexAreas} outerRadius="62%">
              <PolarGrid gridType="polygon" stroke="var(--color-border-subtle)" />
              <PolarRadiusAxis domain={[0, 1]} tickCount={5} tick={false} axisLine={false} />
              <PolarAngleAxis
                dataKey="label"
                tickLine={false}
                tick={(props: { x: number; y: number; payload: { index: number; coordinate: number } }) => (
                  <AxisLabel {...props} areas={hexAreas} />
                )}
              />
              <Radar
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={1.5}
                fill="var(--color-primary-muted)"
                fillOpacity={1}
                dot={{ r: 3.5, fill: "var(--color-primary)", stroke: "none" }}
                isAnimationActive={false}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <section className="mt-8 w-full" aria-label="Your areas">
          <div className="mb-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
              Your areas
            </h2>
            <p className="text-sm text-text-secondary">(tap to see what we found)</p>
          </div>

          <ul className="flex flex-col gap-2">
            {listAreas.map((area) => {
              const Icon = area.Icon;
              const level = levelFromScore(area.score);
              return (
                <li key={area.id}>
                  <Card className="overflow-hidden">
                    <button
                      type="button"
                      onClick={() => openArea(area)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left outline-none transition-colors duration-fast hover:bg-state-hover focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-inset"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center text-text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-text-primary">
                          {area.label}
                        </span>
                        <span className="block text-sm text-text-secondary">
                          {area.summary}
                        </span>
                      </span>
                      <LevelBars level={level} />
                    </button>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      {createPortal(
        <Sheet
          component={motion.div}
          opened={open}
          onBackdropClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={activeArea ? `${activeArea.label} details` : undefined}
          aria-hidden={!open}
          inert={!open}
          className="flex max-h-9/10 flex-col rounded-t-lg! shadow-xl motion-reduce:transition-none"
          {...sheetDragProps}
        >
          {activeArea && (
            <div className="relative min-h-0 flex-1 overflow-y-auto px-6 pb-safe-8 pt-3">
              <div className="flex justify-center pb-3">
                <div className="h-1.5 w-12 rounded-full bg-border" />
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full text-text-secondary outline-none transition-colors duration-fast hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus"
              >
                <X className="size-5" />
              </button>

              <div className="mt-2 flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-primary-border bg-primary-muted text-primary-text">
                  {ActiveIcon ? <ActiveIcon className="size-5" /> : null}
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-xl font-semibold tracking-tight text-text-primary">
                    {activeArea.label}
                  </h3>
                  <p className="mt-1 text-md text-text-secondary">{activeArea.summary}</p>
                </div>
                <LevelBars level={levelFromScore(activeArea.score)} />
              </div>

              <p className="mt-4 text-lg leading-relaxed text-text-secondary">
                {activeArea.detail}
              </p>

              {activeArea.breachCards ? (
                activeArea.breachCards.length === 0 ? (
                  <p className="mt-4 text-md text-text-secondary">
                    No breaches found for any confirmed email.
                  </p>
                ) : (
                  <ul className="mt-4 flex flex-col gap-2">
                    {activeArea.breachCards.map((b, i) => (
                      <li key={`${b.email}-${b.name}-${i}`}>
                        <Card className="bg-bg-app px-3 py-3 shadow-none">
                          <p className="break-all text-xs font-semibold uppercase tracking-widest text-text-secondary">
                            {b.email}
                          </p>
                          <p className="mt-1 text-md leading-snug text-text-primary">
                            {b.name}
                            {(b.date || b.year) ? ` · ${b.date || b.year}` : ""}
                          </p>
                          {b.fieldsExposed.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {b.fieldsExposed.map((field) => (
                                <Badge key={field} color="gray" size="sm">
                                  {field}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </Card>
                      </li>
                    ))}
                  </ul>
                )
              ) : activeArea.items.length === 0 ? (
                <p className="mt-4 text-md text-text-secondary">
                  Nothing in this category from the current scan.
                </p>
              ) : (
                <ul className="mt-4 flex flex-col gap-2">
                  {activeArea.items.map((item, i) => (
                    <li key={`${item.label}-${item.value}-${i}`}>
                      <Card className="bg-bg-app px-3 py-3 shadow-none">
                        <p className="text-xs font-semibold uppercase tracking-widest text-text-secondary">
                          {item.label}
                          {item.source ? ` · ${item.source}` : ""}
                        </p>
                        {isHttpUrl(item.value) ? (
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-md text-primary-text underline-offset-2 hover:underline"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="mt-1 text-md leading-snug text-text-primary">{item.value}</p>
                        )}
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </Sheet>,
        document.body,
      )}
    </div>
  );
}

/**
 * Standalone risk-summary page — reads quickscan.consolidated_profile from
 * sessionStorage, same as pre-profile. Not part of the normal flow any more
 * (loading.tsx navigates to the report carousel instead — see report.tsx),
 * kept as a direct-link fallback.
 */
export function PilotRiskSummaryPage() {
  const [{ data: stored }] = useState(() => loadConsolidatedProfile());

  if (!stored) {
    return (
      <Page className="font-body" role="main" aria-label="Error loading risk summary">
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

  return (
    <Page className="pt-12 font-body" role="main" aria-label="Risk summary">
      <RiskSummaryBody profile={stored.profile} />
    </Page>
  );
}
