import type { ReactNode } from "react";
import { Vinnie } from "@vanyshr/ui/components/foundations";
import { cx } from "@/utils/cx";

/**
 * Records orbit: Vinnie in the middle of the twelve kinds of personal data a broker holds,
 * tiered by size (inner = the big four, middle, outer = small satellites).
 *
 * Glyphs are Lucide shapes in the Soft Solid recipe: the body is filled in the glyph color and
 * interior detail is knocked out in the chip color. Open-line icons (Fingerprint, Route) have no
 * body to fill, so they get a heavier stroke instead. Colors come from tokens via fill-/stroke- classes.
 */

// Paint recipes, applied to a <g> so every child inherits.
const FILL = "fill-text-primary stroke-text-primary"; // filled body
const LINE = "fill-none stroke-text-primary"; // heavy open stroke
const KNOCK = "fill-none stroke-bg-surface"; // detail stroke in the chip color
const KNOCK_FILL = "fill-bg-surface stroke-bg-surface"; // detail shape in the chip color
const RIM = "fill-text-primary stroke-bg-surface"; // glyph shape rimmed in the chip color

type GlyphProps = { children: ReactNode };
function Glyph({ children }: GlyphProps) {
  return (
    <g strokeLinejoin="round" strokeLinecap="round">
      {children}
    </g>
  );
}

const GLYPHS = {
  phone: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384z" />
      </g>
    </Glyph>
  ),
  address: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      </g>
      <g className={KNOCK_FILL} strokeWidth={1}>
        <circle cx="12" cy="10" r="3" />
      </g>
    </Glyph>
  ),
  email: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <rect x="2" y="4" width="20" height="16" rx="2" />
      </g>
      <g className={KNOCK} strokeWidth={1.8}>
        <path d="m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      </g>
    </Glyph>
  ),
  ssn: (
    <Glyph>
      <g className={LINE} strokeWidth={2.4}>
        <path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4" />
        <path d="M14 13.12c0 2.38 0 6.38-1 8.88" />
        <path d="M17.29 21.02c.12-.6.43-2.3.5-3.02" />
        <path d="M2 12a10 10 0 0 1 18-6" />
        <path d="M2 16h.01" />
        <path d="M21.8 16c.2-2 .131-5.354 0-6" />
        <path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2" />
        <path d="M8.65 22c.21-.66.45-1.32.57-2" />
        <path d="M9 6.8a6 6 0 0 1 9 5.2v2" />
      </g>
    </Glyph>
  ),
  birthday: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" />
      </g>
      <g className={LINE} strokeWidth={2.2}>
        <path d="M8 2v4M16 2v4" />
      </g>
      <g className={KNOCK} strokeWidth={1.8}>
        <path d="M3 10h18" />
      </g>
      <g className={KNOCK} strokeWidth={2.4}>
        <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
      </g>
    </Glyph>
  ),
  location: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <circle cx="6" cy="19" r="3" />
        <circle cx="18" cy="5" r="3" />
      </g>
      <g className={LINE} strokeWidth={2.4}>
        <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
      </g>
    </Glyph>
  ),
  employer: (
    <Glyph>
      <g className={LINE} strokeWidth={2.2}>
        <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
      </g>
      <g className={FILL} strokeWidth={2}>
        <rect x="2" y="6" width="20" height="14" rx="2" />
      </g>
      <g className={KNOCK} strokeWidth={1.8}>
        <path d="M2 13h20" />
      </g>
    </Glyph>
  ),
  relatives: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <circle cx="4.5" cy="9" r="2.6" />
        <path d="M1 19.5v-1a3.5 3.5 0 0 1 3.5-3.5H9v4.5z" />
        <circle cx="19.5" cy="9" r="2.6" />
        <path d="M23 19.5v-1a3.5 3.5 0 0 0-3.5-3.5H15v4.5z" />
      </g>
      <g className={RIM} strokeWidth={2.2}>
        <circle cx="12" cy="8" r="3.6" />
        <path d="M5.5 21v-1.5a4.5 4.5 0 0 1 4.5-4.5h4a4.5 4.5 0 0 1 4.5 4.5V21z" />
      </g>
    </Glyph>
  ),
  property: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </g>
      <g className={KNOCK_FILL} strokeWidth={1.2}>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8z" />
      </g>
    </Glyph>
  ),
  vehicle: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2z" />
      </g>
      <g className={KNOCK_FILL} strokeWidth={1.2}>
        <path d="M7 11 8.4 8.6H12L14.2 11Z" />
        <circle cx="7" cy="17" r="3.4" />
        <circle cx="17" cy="17" r="3.4" />
      </g>
      <g className={FILL} strokeWidth={2}>
        <circle cx="7" cy="17" r="2" />
        <circle cx="17" cy="17" r="2" />
      </g>
    </Glyph>
  ),
  card: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <rect x="2" y="5" width="20" height="14" rx="2" />
      </g>
      <g className={KNOCK} strokeWidth={2.2}>
        <path d="M2 10h20" />
      </g>
      <g className={KNOCK} strokeWidth={1.8}>
        <path d="M6 15h4" />
      </g>
    </Glyph>
  ),
  browsing: (
    <Glyph>
      <g className={FILL} strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
      </g>
      <g className={KNOCK} strokeWidth={1.8}>
        <path d="M2 12h20" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      </g>
    </Glyph>
  ),
} satisfies Record<string, ReactNode>;

type Tier = "inner" | "middle" | "outer";

/** Orbit radius, chip radius, per tier (viewBox units). */
const TIERS: Record<Tier, { orbit: number; chip: number }> = {
  inner: { orbit: 104, chip: 30 },
  middle: { orbit: 146, chip: 23 },
  outer: { orbit: 174, chip: 15 },
};

/** Angle in degrees, clockwise from 3 o'clock. Staggered between tiers so no chip sits on another's spoke. */
const CHIPS: { id: keyof typeof GLYPHS; tier: Tier; angle: number; tilt: number }[] = [
  // Inner: the big four
  { id: "phone", tier: "inner", angle: 225, tilt: -10 },
  { id: "address", tier: "inner", angle: 315, tilt: 6 },
  { id: "email", tier: "inner", angle: 45, tilt: 8 },
  { id: "card", tier: "inner", angle: 135, tilt: -6 },
  // Middle
  { id: "birthday", tier: "middle", angle: 260, tilt: -8 },
  { id: "property", tier: "middle", angle: 350, tilt: 6 },
  { id: "employer", tier: "middle", angle: 80, tilt: -4 },
  { id: "relatives", tier: "middle", angle: 170, tilt: 5 },
  // Outer: small satellites
  { id: "location", tier: "outer", angle: 305, tilt: -6 },
  { id: "vehicle", tier: "outer", angle: 35, tilt: 5 },
  { id: "ssn", tier: "outer", angle: 125, tilt: -5 },
  { id: "browsing", tier: "outer", angle: 215, tilt: 6 },
];

const SIZE = 390;
const C = SIZE / 2;
/** Glyphs are drawn on a 24-unit grid and rendered at 1.1x the chip radius (about 55% of its diameter). */
const GLYPH_PER_CHIP_RADIUS = 1.1 / 24;

const RINGS: { r: number; className: string }[] = [
  { r: 68, className: "stroke-border-subtle opacity-60" },
  { r: 84, className: "stroke-border-subtle opacity-40" },
  { r: 104, className: "stroke-border-subtle" },
  { r: 146, className: "stroke-border-subtle opacity-80" },
  { r: 174, className: "stroke-border-subtle opacity-60" },
];

const VINNIE_HEIGHT = 70;
const VINNIE_WIDTH = (VINNIE_HEIGHT * 230.35) / 320;

export function RecordsOrbit({ className }: { className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      fill="none"
      role="img"
      aria-label="Vinnie surrounded by twelve kinds of personal data: phone number, home address, email, credit card, date of birth, property, employer, relatives, location history, vehicles, SSN and browsing activity"
      className={cx("overflow-visible", className)}
    >
      <g aria-hidden="true">
        {RINGS.map(({ r, className: ringClass }) => (
          <circle key={r} cx={C} cy={C} r={r} strokeWidth={1.5} className={ringClass} />
        ))}

        {CHIPS.map(({ id, tier, angle, tilt }, i) => {
          const { orbit, chip } = TIERS[tier];
          const rad = (angle * Math.PI) / 180;
          const x = C + orbit * Math.cos(rad);
          const y = C + orbit * Math.sin(rad);
          const scale = chip * GLYPH_PER_CHIP_RADIUS;
          return (
            <g key={id} transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}>
              <g className="animate-orbit-bob" style={{ animationDelay: `${-i * 0.7}s` }}>
                <circle r={chip} strokeWidth={1.4} className="fill-bg-surface stroke-border-subtle" />
                <g transform={`rotate(${tilt}) scale(${scale.toFixed(3)}) translate(-12 -12)`}>{GLYPHS[id]}</g>
              </g>
            </g>
          );
        })}

        <circle cx={C} cy={C} r={52} strokeWidth={1.4} className="fill-bg-surface stroke-border-subtle" />
      </g>
      <Vinnie
        x={C - VINNIE_WIDTH / 2}
        y={C - VINNIE_HEIGHT / 2 - 2}
        width={VINNIE_WIDTH}
        height={VINNIE_HEIGHT}
      />
    </svg>
  );
}
