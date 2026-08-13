import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  AlertTriangle,
  ShieldAlert,
  MailWarning,
  Fingerprint,
  KeyRound,
  Users,
  ArrowRight,
  X,
  type LucideIcon,
} from "lucide-react";
import { cx } from "@/utils/cx";

const DRAWER_EASE = [0.2, 0, 0, 1] as const;
const LEVEL_BARS = 4;

type RiskPoint = {
  id: string;
  label: string;
  Icon: LucideIcon;
  /** Angle in degrees; 0 = right, -90 = top */
  angleDeg: number;
  score: number;
  summary: string;
  detail: string;
};

/**
 * Clockwise from top — Mobbin Life Map hex layout.
 * Static placeholder copy/scores until real scan data is wired.
 */
const RISK_POINTS: RiskPoint[] = [
  {
    id: "critical",
    label: "Critical",
    Icon: AlertTriangle,
    angleDeg: -90,
    score: 0.82,
    summary: "4 high-severity finds",
    detail:
      "These are the most urgent exposures from your scan — records that typically include sensitive personal details and should be addressed first.",
  },
  {
    id: "scam",
    label: "Scam",
    Icon: ShieldAlert,
    angleDeg: -30,
    score: 0.55,
    summary: "2 scam-risk signals",
    detail:
      "Signals that scammers can use to target you — recycled breach data, phishing-friendly fields, and lookalike listing patterns.",
  },
  {
    id: "family",
    label: "Family",
    Icon: Users,
    angleDeg: 30,
    score: 0.38,
    summary: "1 related household hit",
    detail:
      "Exposures that may also affect people connected to you — relatives or household members appearing in the same public records.",
  },
  {
    id: "identity",
    label: "Identity Theft",
    Icon: Fingerprint,
    angleDeg: 90,
    score: 0.7,
    summary: "3 identity risk items",
    detail:
      "Data points that raise identity-theft risk — combinations of name, location, and other identifiers that make impersonation easier.",
  },
  {
    id: "accounts",
    label: "Accounts",
    Icon: KeyRound,
    angleDeg: 150,
    score: 0.48,
    summary: "2 account exposures",
    detail:
      "Places where your accounts or login-adjacent info may be exposed across people-search sites and broker listings.",
  },
  {
    id: "spam",
    label: "Spam",
    Icon: MailWarning,
    angleDeg: 210,
    score: 0.62,
    summary: "5 spam vectors",
    detail:
      "Contact channels and listings that commonly feed spam and unwanted outreach — phones, emails, and recycled marketing data.",
  },
];

/** List order for the “Your Areas” section (not chart order). */
const AREA_LIST = [
  RISK_POINTS[0], // Critical
  RISK_POINTS[1], // Scam
  RISK_POINTS[5], // Spam
  RISK_POINTS[3], // Identity Theft
  RISK_POINTS[4], // Accounts
  RISK_POINTS[2], // Family
] as RiskPoint[];

const VIEW = 320;
const CENTER = VIEW / 2;
const GRID_RADII = [0.35, 0.55, 0.75, 1];
const AXIS_RADIUS = 112;
const LABEL_RADIUS = 148;

function polar(radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: CENTER + radius * Math.cos(rad),
    y: CENTER + radius * Math.sin(rad),
  };
}

function hexPoints(radius: number) {
  return RISK_POINTS.map((p) => {
    const { x, y } = polar(radius, p.angleDeg);
    return `${x},${y}`;
  }).join(" ");
}

function scorePolygon() {
  return RISK_POINTS.map((p) => {
    const { x, y } = polar(AXIS_RADIUS * p.score, p.angleDeg);
    return `${x},${y}`;
  }).join(" ");
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
            className={cx(
              "w-1.5 rounded-sm",
              on ? "bg-[#00BFFF]" : "bg-[#2A4A68]",
            )}
            style={{ height }}
          />
        );
      })}
    </div>
  );
}

/**
 * Pilot Risk Summary — Mobbin Life Map structure (hex + area list).
 * Vanyshr branding; static shell. Area rows open a detail drawer.
 */
export function PilotRiskSummaryPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [activeArea, setActiveArea] = useState<RiskPoint | null>(null);
  const ActiveIcon = activeArea?.Icon;

  return (
    <>
      <div
        className="relative flex min-h-screen w-full flex-col items-center bg-[#022136] px-6 pb-12 pt-12 font-ubuntu"
        role="main"
        aria-label="Risk summary"
      >
        {/* Header */}
        <div className="flex w-full max-w-sm flex-col items-center text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#00BFFF]/35 bg-[#00BFFF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#00BFFF]">
            Your exposure
          </span>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Risk Summary
          </h1>
          <p className="mt-2 text-sm text-[#B8C4CC]">Based on your scan results</p>
        </div>

        {/* Hex radar */}
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
                  points={hexPoints(AXIS_RADIUS * t)}
                  fill="none"
                  stroke="rgba(184, 196, 204, 0.18)"
                  strokeWidth={1}
                />
              ))}

              {RISK_POINTS.map((p) => {
                const end = polar(AXIS_RADIUS, p.angleDeg);
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
                points={scorePolygon()}
                fill="rgba(0, 191, 255, 0.22)"
                stroke="#00BFFF"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />

              {RISK_POINTS.map((p) => {
                const pt = polar(AXIS_RADIUS * p.score, p.angleDeg);
                return (
                  <circle
                    key={`dot-${p.id}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={3.5}
                    fill="#00BFFF"
                  />
                );
              })}

              <circle cx={CENTER} cy={CENTER} r={5} fill="#00BFFF" />
            </svg>

            {RISK_POINTS.map((p) => {
              const pt = polar(LABEL_RADIUS, p.angleDeg);
              const left = (pt.x / VIEW) * 100;
              const top = (pt.y / VIEW) * 100;
              const Icon = p.Icon;
              return (
                <div
                  key={`label-${p.id}`}
                  className="pointer-events-none absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
                  style={{ left: `${left}%`, top: `${top}%` }}
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-[#022136]/80 text-white">
                    <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="max-w-[88px] text-center text-[11px] font-medium leading-tight text-white sm:text-xs">
                    {p.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Your Areas list */}
        <section className="mt-10 w-full max-w-sm" aria-label="Your areas">
          <div className="mb-3 px-0.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7A92A8]">
              Your areas
            </h2>
            <p className="mt-0.5 text-xs text-[#7A92A8]">(tap to learn more)</p>
          </div>

          <ul className="flex flex-col gap-2.5">
            {AREA_LIST.map((area) => {
              const Icon = area.Icon;
              const level = levelFromScore(area.score);
              return (
                <li key={area.id}>
                  <button
                    type="button"
                    onClick={() => setActiveArea(area)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[#1A2E42] px-4 py-3.5 text-left outline-none transition hover:bg-[#20364C] focus-visible:ring-2 focus-visible:ring-[#00BFFF]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center text-white">
                      <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
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

        {/* Continue */}
        <div className="mt-10 flex w-full max-w-sm justify-center">
          <button
            type="button"
            onClick={() => navigate("/pilot-scan/start")}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-[#022136] outline-none transition hover:bg-[#E8F7FF] focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#022136]"
            aria-label="Continue"
          >
            <ArrowRight className="h-6 w-6" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      {/* Area detail drawer */}
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
              <div className="relative w-full max-w-md overflow-hidden rounded-t-[28px] bg-[#1A2E42] px-6 pb-10 pt-3 shadow-[0_0_40px_rgba(0,191,255,0.2)]">
                <div className="flex justify-center pb-3">
                  <div className="h-1.5 w-12 rounded-full bg-[#2A4A68]" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setActiveArea(null)}
                  className="absolute right-4 top-3 rounded-full p-1.5 text-[#7A92A8] transition hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="mt-2 flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#00BFFF]/30 bg-[#00BFFF]/10 text-[#00BFFF]">
                    {ActiveIcon ? (
                      <ActiveIcon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
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

                <p className="mt-5 text-[15px] leading-relaxed text-[#B8C4CC]">
                  {activeArea.detail}
                </p>

                <p className="mt-4 text-xs leading-relaxed text-[#7A92A8]">
                  Placeholder detail for the pilot UI — real findings will land here once
                  scan data is wired.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
