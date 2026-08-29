import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { DollarSign } from "lucide-react";
import {
  AlertTriangleFilled,
  ShieldFilled,
  MailFilled,
  Fingerprint,
  KeyFilled,
  Users,
  HomeFilled,
  UserSearch,
  X,
  type IconComponent,
} from "@appica/icons-react";
import { cx } from "@/utils/cx";
import { signupPath } from "@/lib/pending-scan";
import { buildRiskAreas, loadConsolidatedProfile, type ConsolidatedProfile, type RiskArea } from "./consolidated-profile";

const DRAWER_EASE = [0.2, 0, 0, 1] as const;
const LEVEL_BARS = 4;

const AREA_META: Record<
  string,
  { Icon: IconComponent; angleDeg?: number; onHex?: boolean }
> = {
  critical: { Icon: AlertTriangleFilled, angleDeg: -90, onHex: true },
  scam: { Icon: ShieldFilled, angleDeg: -30, onHex: true },
  family: { Icon: Users, angleDeg: 30, onHex: true },
  identity: { Icon: Fingerprint, angleDeg: 90, onHex: true },
  accounts: { Icon: KeyFilled, angleDeg: 150, onHex: true },
  spam: { Icon: MailFilled, angleDeg: 210, onHex: true },
  property: { Icon: HomeFilled },
  other: { Icon: UserSearch },
};

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

const VIEW = 320;
const CENTER = VIEW / 2;
const GRID_RADII = [0.35, 0.55, 0.75, 1];
const AXIS_RADIUS = 112;
const LABEL_RADIUS = 148;

type AreaView = {
  id: string;
  label: string;
  summary: string;
  detail: string;
  score: number;
  items: RiskArea["items"];
  breachCards?: RiskArea["breachCards"];
  Icon: IconComponent;
  angleDeg?: number;
};

function polar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function hexPoints(radius: number, hexAreas: AreaView[]) {
  return hexAreas
    .map((p) => {
      const { x, y } = polar(radius, p.angleDeg ?? 0);
      return `${x},${y}`;
    })
    .join(" ");
}

function scorePolygon(hexAreas: AreaView[]) {
  return hexAreas
    .map((p) => {
      const { x, y } = polar(AXIS_RADIUS * p.score, p.angleDeg ?? 0);
      return `${x},${y}`;
    })
    .join(" ");
}

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
            className={cx("w-1.5 rounded-sm", on ? "bg-[#14ABFE]" : "bg-[#1E3A52]")}
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

/**
 * Risk summary slide content — hex chart + area list, no page chrome. Used
 * standalone by PilotRiskSummaryPage's own header/background below, and as
 * one slide of the report carousel (report.tsx), which supplies its own
 * shared header instead.
 *
 * The area-detail drawer is rendered via a portal to document.body rather
 * than inline: inside the carousel it sits under a swipe track that gets
 * animated with a CSS transform, and a `position: fixed` descendant of a
 * transformed ancestor is positioned relative to that ancestor instead of
 * the viewport — the portal sidesteps that entirely.
 */
export function RiskSummaryBody({ profile }: { profile: ConsolidatedProfile }) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const areas = useMemo(() => buildRiskAreas(profile), [profile]);
  const [activeArea, setActiveArea] = useState<AreaView | null>(null);

  const byId = useMemo(() => {
    const map = new Map(areas.map((a) => [a.id, a]));
    return map;
  }, [areas]);

  const hexAreas: AreaView[] = HEX_ORDER.map((id) => {
    const built = byId.get(id);
    const meta = AREA_META[id];
    return {
      id,
      label: built?.label ?? id,
      summary: built?.summary ?? "",
      detail: built?.detail ?? "",
      score: built?.score ?? 0.1,
      items: built?.items ?? [],
      Icon: meta.Icon,
      angleDeg: meta.angleDeg,
    };
  });

  const listAreas: AreaView[] = LIST_ORDER.flatMap((id) => {
    const built = byId.get(id);
    if (!built) return [];
    if (id === "other" && built.items.length === 0) return [];
    return [
      {
        ...built,
        Icon: AREA_META[id].Icon,
        angleDeg: AREA_META[id].angleDeg,
      },
    ];
  });

  const ActiveIcon = activeArea?.Icon;

  const [footerVisible, setFooterVisible] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setFooterVisible(true), 2000);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="relative flex w-full flex-col items-center px-6 pb-[200px] font-ubuntu">
      <div>
        <div className="relative mt-8 flex w-full max-w-md items-center justify-center">
          <div className="relative aspect-square w-full max-w-[340px]">
            <svg
              viewBox={`0 0 ${VIEW} ${VIEW}`}
              className="h-full w-full"
              role="img"
              aria-label="Risk categories arranged on a hexagonal chart"
            >
              {GRID_RADII.map((t) => (
                <polygon
                  key={t}
                  points={hexPoints(AXIS_RADIUS * t, hexAreas)}
                  fill="none"
                  stroke="rgba(184, 196, 204, 0.18)"
                  strokeWidth={1}
                />
              ))}

              {hexAreas.map((p) => {
                const end = polar(AXIS_RADIUS, p.angleDeg ?? 0);
                return (
                  <line
                    key={`axis-${p.id}`}
                    x1={CENTER}
                    y1={CENTER}
                    x2={end.x}
                    y2={end.y}
                    stroke="rgba(184, 196, 204, 0.14)"
                    strokeWidth={1}
                  />
                );
              })}

              <polygon
                points={scorePolygon(hexAreas)}
                fill="rgba(20,171,254, 0.22)"
                stroke="#14ABFE"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />

              {hexAreas.map((p) => {
                const pt = polar(AXIS_RADIUS * p.score, p.angleDeg ?? 0);
                return (
                  <circle
                    key={`dot-${p.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill="#14ABFE"
                  />
                );
              })}

              <circle cx={CENTER} cy={CENTER} r={5} fill="#14ABFE" />
            </svg>

            {hexAreas.map((p) => {
              const pt = polar(LABEL_RADIUS, p.angleDeg ?? 0);
              const left = (pt.x / VIEW) * 100;
              const top = (pt.y / VIEW) * 100;
              const Icon = p.Icon;
              return (
                <div
                  key={`label-${p.id}`}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#0B1B2B]/80 text-white">
                    <Icon size={16} />
                  </span>
                  <span className="max-w-[88px] text-center text-[11px] font-medium leading-tight text-white sm:text-xs">
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <section className="mt-10 w-full max-w-sm" aria-label="Your areas">
          <div className="mb-3 px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A92A8]">
              Your areas
            </h2>
            <p className="mt-0.5 text-xs text-[#7A92A8]">(tap to see what we found)</p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {listAreas.map((area) => {
              const Icon = area.Icon;
              const level = levelFromScore(area.score);
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => setActiveArea(area)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[#1A2E42] px-4 py-3.5 text-left outline-none transition hover:bg-[#20364C] focus-visible:ring-2 focus-visible:ring-[#14ABFE]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white">
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-white">
                        {area.label}
                      </span>
                      <span className="mt-0.5 block text-xs text-[#7A92A8]">
                        {area.summary}
                      </span>
                    </span>
                    <LevelBars level={level} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 px-4">
        <motion.footer
          className="w-full rounded-t-[28px] bg-[#1A2E42] px-5 pb-6 pt-5 shadow-[0_0_40px_rgba(20,171,254,0.18)]"
          initial={prefersReducedMotion ? false : { y: "100%" }}
          animate={{ y: footerVisible ? 0 : "100%" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.5, ease: DRAWER_EASE }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#1E3A52] bg-[#0B1B2B] px-3 py-1 text-[11px] font-medium text-[#14ABFE]">
            <DollarSign className="h-3 w-3" />
            No Credit Card Required
          </span>
          <h2 className="mt-3 text-[26px] font-bold leading-[1.15] tracking-tight text-white">
            Time to Vanysh
          </h2>
          <p className="mt-1.5 text-sm leading-snug text-[#94A3B8]">
            Start removing your exposed data from every broker we found
          </p>
          <button
            type="button"
            onClick={() => navigate(signupPath())}
            className="mt-5 flex h-12 w-full items-center justify-center rounded-2xl bg-[#14ABFE] text-[17px] font-semibold text-white"
          >
            Start Vanyshing
          </button>
        </motion.footer>
      </div>

      {createPortal(
        <AnimatePresence>
        {activeArea && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: DRAWER_EASE }}
              onClick={() => setActiveArea(null)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={`${activeArea.label} details`}
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.38, ease: DRAWER_EASE }
              }
              drag={prefersReducedMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 120) setActiveArea(null);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            >
              <div className="relative max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-[28px] bg-[#1A2E42] px-6 pb-10 pt-3 shadow-[0_0_40px_rgba(20,171,254,0.2)]">
                <div className="flex justify-center pb-3">
                  <div className="h-1.5 w-12 rounded-full bg-[#1E3A52]" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setActiveArea(null)}
                  className="absolute right-4 top-3 rounded-full p-1.5 text-[#7A92A8] transition hover:text-white"
                >
                  <X size={20} />
                </button>

                <div className="mt-2 flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#14ABFE]/30 bg-[#14ABFE]/10 text-[#14ABFE]">
                    {ActiveIcon ? (
                      <ActiveIcon size={20} />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <h3 className="text-xl font-bold tracking-tight text-white">
                      {activeArea.label}
                    </h3>
                    <p className="mt-1 text-sm text-[#7A92A8]">{activeArea.summary}</p>
                  </div>
                  <LevelBars level={levelFromScore(activeArea.score)} />
                </div>

                <p className="mt-5 text-[15px] leading-relaxed text-[#94A3B8]">
                  {activeArea.detail}
                </p>

                {activeArea.breachCards ? (
                  activeArea.breachCards.length === 0 ? (
                    <p className="mt-5 text-sm text-[#7A92A8]">
                      No breaches found for any confirmed email.
                    </p>
                  ) : (
                    <ul className="mt-5 flex flex-col gap-2">
                      {activeArea.breachCards.map((b, i) => (
                        <li
                          key={`${b.email}-${b.name}-${i}`}
                          className="rounded-xl bg-[#0B1B2B]/55 px-3.5 py-3"
                        >
                          <p className="break-all text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A92A8]">
                            {b.email}
                          </p>
                          <p className="mt-1 text-sm leading-snug text-white">
                            {b.name}
                            {(b.date || b.year) ? ` · ${b.date || b.year}` : ""}
                          </p>
                          {b.fieldsExposed.length > 0 && (
                            <div className="mt-2.5 flex flex-wrap gap-1.5">
                              {b.fieldsExposed.map((field) => (
                                <span
                                  key={field}
                                  className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-[#94A3B8]"
                                >
                                  {field}
                                </span>
                              ))}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )
                ) : activeArea.items.length === 0 ? (
                  <p className="mt-5 text-sm text-[#7A92A8]">
                    Nothing in this category from the current scan.
                  </p>
                ) : (
                  <ul className="mt-5 flex flex-col gap-2">
                    {activeArea.items.map((item, i) => (
                      <li
                        key={`${item.label}-${item.value}-${i}`}
                        className="rounded-xl bg-[#0B1B2B]/55 px-3.5 py-3"
                      >
                        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#7A92A8]">
                          {item.label}
                          {item.source ? ` · ${item.source}` : ""}
                        </p>
                        {isHttpUrl(item.value) ? (
                          <a
                            href={item.value}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 block break-all text-sm text-[#14ABFE] underline-offset-2 hover:underline"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="mt-1 text-sm leading-snug text-white">{item.value}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </>
        )}
        </AnimatePresence>,
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
      <div
        className="flex min-h-screen w-full flex-col items-center justify-center bg-[#0B1B2B] p-4 font-ubuntu"
        role="main"
        aria-label="Error loading risk summary"
      >
        <div className="w-full max-w-md text-center">
          <h1 className="mb-2 text-xl font-bold text-white">No scan data found</h1>
          <p className="mb-6 text-sm text-[#94A3B8]">
            Nothing came through from this scan — run it again from the start.
          </p>
          <Link
            to="/pilot-scan"
            className="inline-flex h-[44px] items-center justify-center rounded-xl bg-[#14ABFE] px-6 font-semibold text-white transition-all hover:bg-[#1196E0]"
          >
            Start over
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#0B1B2B] pt-12" role="main" aria-label="Risk summary">
      <RiskSummaryBody profile={stored.profile} />
    </div>
  );
}
