import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useNavigate } from "react-router";
import { Navbar, Page } from "konsta/react";
import {
  Ban,
  BookOpen,
  Briefcase,
  Cake,
  Car,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  Download,
  GraduationCap,
  House,
  IdCard,
  Image,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";
import { cx } from "@/utils/cx";
import { BrandLockup } from "@/components/BrandLockup";
import {
  FindMyDataDrawer,
  KeyboardStripFill,
  primaryButton,
  useDrawerPageEffects,
  useKeyboardInset,
} from "@/components/FindMyDataDrawer";
import heroScene from "@/assets/scenes/broker-orbit-hero-1x1.svg";
import creedAvatar from "@/assets/avatars/creed-bratton.png";

const THREAT_WORDS = ["Scammers", "Spammers", "Identity Thieves", "Telemarketers", "Hackers"] as const;
const WORD_MS = 3200;
const LETTER_STAGGER_S = 0.04;

/** The twelve record types from the hero scene, labelled for the data-broker phase. */
const BROKER_RECORDS = [
  { icon: Phone, label: "Phone numbers" },
  { icon: Mail, label: "Emails" },
  { icon: House, label: "Home address" },
  { icon: MapPin, label: "Past addresses" },
  { icon: Users, label: "Relatives" },
  { icon: IdCard, label: "Aliases" },
  { icon: Cake, label: "Date of birth" },
  { icon: Briefcase, label: "Employer" },
  { icon: GraduationCap, label: "Education" },
  { icon: Car, label: "Vehicles" },
  { icon: CreditCard, label: "Payment cards" },
  { icon: Image, label: "Photos" },
] as const;

/** Cluster layout: records per row, plus each row's own inset/shift so columns never line up. */
const BROKER_ROWS = [
  { count: 3, className: "px-6 translate-x-3" },
  { count: 4, className: "px-0" },
  { count: 3, className: "px-8 -translate-x-2" },
  { count: 2, className: "px-12 translate-x-4" },
] as const;

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

type Vec = { x: number; y: number };

/** Measured cluster geometry, shared by every chip. `rank` is each chip's place in the spiral order. */
type ClusterGeo = { toFunnel: Vec[]; toCenter: Vec[]; rank: number[] };

const SPIRAL_STAGGER_S = 0.1;
/** Extra distance (px) added per full turn when ranking chips, which is what bends inside-out order into a spiral. */
const SPIRAL_ARM_PX = 220;
/** Turns (radians) a chip sweeps along its spiral on entrance and on collect. */
const ENTER_SWIRL = Math.PI;
const COLLECT_SWIRL = 2 * Math.PI;

/** One record chip, two layered motions on a fixed li (the li is what geometry is measured from):
    - entrance (timed): once `entered`, chips appear one after another in spiral order, inside out, sweeping
      from near the cluster centre out to their spot along a spiral;
    - collect (scroll-driven): as progress runs 0 -> 1 each chip swirls around the funnel point and shrinks
      into it, inner chips first. */
function SpiralChip({
  icon: Icon,
  label,
  index,
  progress,
  geo,
  entered,
  reducedMotion,
  liRef,
}: {
  icon: (typeof BROKER_RECORDS)[number]["icon"];
  label: string;
  index: number;
  progress: MotionValue<number>;
  geo: { current: ClusterGeo };
  entered: boolean;
  reducedMotion: boolean;
  liRef: (el: HTMLLIElement | null) => void;
}) {
  const last = BROKER_RECORDS.length - 1;
  const rank = geo.current.rank[index] ?? index;

  // Entrance: 0 -> 1 on a timer, delayed by spiral rank. The chip starts 80% of the way to the cluster centre
  // and sweeps back out along a spiral (radius grows while the angle unwinds).
  const enter = useMotionValue(0);
  useEffect(() => {
    const controls = animate(
      enter,
      entered ? 1 : 0,
      entered && !reducedMotion
        ? { duration: 0.8, delay: rank * SPIRAL_STAGGER_S, ease: [0.2, 0, 0, 1] }
        : { duration: 0 },
    );
    return () => controls.stop();
  }, [enter, entered, rank, reducedMotion]);
  const enterX = useTransform(enter, (e) => {
    const c = geo.current.toCenter[index];
    if (reducedMotion || !c) return 0;
    const [vx, vy, a] = [c.x * 0.8, c.y * 0.8, -ENTER_SWIRL * (1 - e)];
    return (vx * Math.cos(a) - vy * Math.sin(a)) * (1 - e);
  });
  const enterY = useTransform(enter, (e) => {
    const c = geo.current.toCenter[index];
    if (reducedMotion || !c) return 0;
    const [vx, vy, a] = [c.x * 0.8, c.y * 0.8, -ENTER_SWIRL * (1 - e)];
    return (vx * Math.sin(a) + vy * Math.cos(a)) * (1 - e);
  });
  const enterScale = useTransform(enter, (e) => (reducedMotion ? 1 : 0.4 + 0.6 * e));

  const t = useTransform(progress, (p) => {
    const r = geo.current.rank[index] ?? index;
    return clamp01((p - (0.02 + (r / last) * 0.25)) / 0.5);
  });
  const eased = useTransform(t, (v) => v * v * (3 - 2 * v));
  // Offset from the chip's resting spot: position on a circle around the funnel point whose angle grows and
  // radius shrinks with progress, minus where the chip started.
  const x = useTransform(eased, (e) => {
    const g = geo.current.toFunnel[index];
    if (reducedMotion || !g) return 0;
    const [vx, vy, a] = [-g.x, -g.y, COLLECT_SWIRL * e];
    return (vx * Math.cos(a) - vy * Math.sin(a)) * (1 - e) - vx;
  });
  const y = useTransform(eased, (e) => {
    const g = geo.current.toFunnel[index];
    if (reducedMotion || !g) return 0;
    const [vx, vy, a] = [-g.x, -g.y, COLLECT_SWIRL * e];
    return (vx * Math.sin(a) + vy * Math.cos(a)) * (1 - e) - vy;
  });
  const scale = useTransform(eased, (e) => (reducedMotion ? 1 : 1 - 0.7 * e));
  const opacity = useTransform(t, (v) => 1 - clamp01((v - (reducedMotion ? 0 : 0.7)) / (reducedMotion ? 1 : 0.3)));

  return (
    <li ref={liRef} className="w-20">
      <motion.div style={{ x: enterX, y: enterY, scale: enterScale, opacity: enter }}>
        <motion.div style={{ x, y, scale, opacity }} className="flex flex-col items-center gap-1.5">
          <span className="flex size-14 items-center justify-center rounded-full border border-border-subtle bg-bg-surface">
            <Icon className="size-6 text-text-primary" aria-hidden="true" />
          </span>
          <span className="text-xs leading-tight text-text-secondary">{label}</span>
        </motion.div>
      </motion.div>
    </li>
  );
}

const PROFILE_ROWS = [
  { icon: IdCard, label: "Alias", value: "William Charles Schneider" },
  { icon: Phone, label: "Phone", value: "(512) 555-0142" },
  { icon: Mail, label: "Email", value: "c.bratton@dundermifflin.com" },
  { icon: House, label: "Address", value: "1314 Quarry Rd Scranton, PA" },
  { icon: Briefcase, label: "Job", value: "Quality Assurance - Dunder Mifflin" },
] as const;

const smooth = (v: number) => v * v * (3 - 2 * v);
const easeOutBack = (v: number) => 1 + 2.70158 * (v - 1) ** 3 + 1.70158 * (v - 1) ** 2;

/** Progress marks inside section two's illustration: the card appears over 0.4-0.8, then (phase 2 -> 3) the card
    leaves and the avatar moves to centre over 1-1.5, and the connection chips pop over 1.5-1.9. */
const CARD_LEAVE_START = 1;
const CARD_LEAVE_SPAN = 0.5;
const CONNECTIONS_START = 1.5;

/** Phase 2 illustration: a minimalist mock of a data broker's people-search profile page. The avatar is a separate
    layer from the card, so in phase 3 it can grow and travel to the centre while the card shrinks away. */
function BrokerProfile({
  progress,
  avatarSlotRef,
  avatarDelta,
  reducedMotion,
}: {
  progress: MotionValue<number>;
  avatarSlotRef: { current: HTMLSpanElement | null };
  avatarDelta: { current: Vec };
  reducedMotion: boolean;
}) {
  const appear = useTransform(progress, (p) => clamp01((p - 0.4) / 0.4));
  const leave = useTransform(progress, (p) => smooth(clamp01((p - CARD_LEAVE_START) / CARD_LEAVE_SPAN)));
  const shellOpacity = useTransform([appear, leave], ([a, l]: number[]) => a * (1 - l));
  const shellScale = useTransform(leave, (l) => (reducedMotion ? 1 : 1 - 0.15 * l));
  const shellY = useTransform(appear, (a) => (reducedMotion ? 0 : (1 - a) * 16));
  const avatarX = useTransform(leave, (l) => (reducedMotion ? 0 : avatarDelta.current.x * l));
  const avatarY = useTransform([appear, leave], ([a, l]: number[]) =>
    reducedMotion ? 0 : (1 - a) * 16 + avatarDelta.current.y * l,
  );
  const avatarScale = useTransform(leave, (l) => (reducedMotion ? 1 : 1 + 0.7 * l));

  return (
    <div aria-hidden="true" className="relative w-full text-left">
      <motion.div
        style={{ opacity: shellOpacity, scale: shellScale, y: shellY }}
        className="w-full rounded-lg border border-border-subtle bg-bg-surface p-4"
      >
        <div className="flex min-h-12 min-w-0 flex-col justify-center pl-15">
          <p className="m-0 text-lg font-semibold text-text-primary">Creed Bratton</p>
          <p className="m-0 text-sm text-text-secondary">Age 30 · Scranton, PA</p>
        </div>
        <dl className="m-0 mt-4 flex flex-col gap-3 border-t border-border-subtle pt-4">
          {PROFILE_ROWS.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-start gap-3">
              <Icon className="mt-0.5 size-4 shrink-0 text-text-tertiary" />
              <div className="min-w-0">
                <dt className="text-xs text-text-tertiary">{label}</dt>
                <dd className="m-0 text-md text-text-primary">{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </motion.div>
      {/* The slot never moves (it is what the travel distance is measured from); the image inside does. */}
      <span ref={avatarSlotRef} className="absolute left-4 top-4 z-10 size-12">
        <motion.img
          src={creedAvatar}
          alt=""
          style={{ opacity: appear, x: avatarX, y: avatarY, scale: avatarScale }}
          className="size-full rounded-full object-cover object-top"
        />
      </span>
    </div>
  );
}

const CONNECTIONS = ["Wife", "Mother", "Father", "Colleague", "Friend", "Grandma"] as const;

/** Phase 3: the people around the avatar, popping in one after another (with a small overshoot) on a ring. */
function ConnectionChips({
  progress,
  ring,
  reducedMotion,
}: {
  progress: MotionValue<number>;
  ring: { current: Vec[] };
  reducedMotion: boolean;
}) {
  return (
    <div className="absolute left-1/2 top-1/2 size-0">
      {CONNECTIONS.map((label, i) => (
        <ConnectionChip key={label} label={label} index={i} progress={progress} ring={ring} reducedMotion={reducedMotion} />
      ))}
    </div>
  );
}

function ConnectionChip({
  label,
  index,
  progress,
  ring,
  reducedMotion,
}: {
  label: string;
  index: number;
  progress: MotionValue<number>;
  ring: { current: Vec[] };
  reducedMotion: boolean;
}) {
  const pop = useTransform(progress, (p) => clamp01((p - (CONNECTIONS_START + index * 0.06)) / 0.22));
  const x = useTransform(pop, () => ring.current[index]?.x ?? 0);
  const y = useTransform(pop, () => ring.current[index]?.y ?? 0);
  const scale = useTransform(pop, (v) => (reducedMotion ? 1 : easeOutBack(v)));
  const opacity = useTransform(pop, (v) => clamp01(v * 3));
  return (
    <div className="absolute w-20 -translate-x-1/2 -translate-y-1/2">
      <motion.div style={{ x, y, scale, opacity }} className="flex flex-col items-center gap-1.5">
        <span className="flex size-14 items-center justify-center rounded-full border border-border-subtle bg-bg-surface">
          <UserRound className="size-6 text-text-primary" aria-hidden="true" />
        </span>
        <span className="text-xs leading-tight text-text-secondary">{label}</span>
      </motion.div>
    </div>
  );
}

/** Section two copy, one entry per phase. */
const PHASES: readonly { title: string; body: string }[] = [
  {
    title: "1,000+ Data Brokers profit from exposing your data",
    body: "They harvest your personal information like phone numbers, emails, addresses, bank accounts, court records, and more...",
  },
  {
    title: "They organize & package your data to share with anyone",
    body: "These highly-detailed profiles are extremely valuable to those wanting to target you",
  },
  {
    title: "They also map your friends and family",
    body: "This is particularly useful for identity thieves and scammers - allowing them to use your information to scam your connections.",
  },
];

/** The shared illustration for every phase: chips pop in as a spiral when the section is reached, then swirl
    into the profile card as progress goes 0 -> 1. The funnel point is a static marker on the card's top edge.
    Chip geometry is measured (not hardcoded) so the cluster layout and card size can change freely; the spiral
    order ranks chips by distance from the cluster centre plus a per-turn angle offset. */
function PhaseIllustration({
  progress,
  entered,
  reducedMotion,
}: {
  progress: MotionValue<number>;
  entered: boolean;
  reducedMotion: boolean;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const funnelRef = useRef<HTMLDivElement>(null);
  const chipRefs = useRef<(HTMLLIElement | null)[]>([]);
  const geo = useRef<ClusterGeo>({ toFunnel: [], toCenter: [], rank: [] });
  const avatarSlotRef = useRef<HTMLSpanElement | null>(null);
  const avatarDelta = useRef<Vec>({ x: 0, y: 0 });
  const ring = useRef<Vec[]>([]);
  const [, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const funnel = funnelRef.current?.getBoundingClientRect();
      const centres = BROKER_RECORDS.map((_, i) => {
        const r = chipRefs.current[i]?.getBoundingClientRect();
        return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
      });
      if (!funnel || centres.some((c) => !c)) return;
      const pts = centres as Vec[];
      const mid = { x: pts.reduce((n, c) => n + c.x, 0) / pts.length, y: pts.reduce((n, c) => n + c.y, 0) / pts.length };
      const turn = pts.map((c) => {
        const dx = c.x - mid.x;
        const dy = c.y - mid.y;
        return Math.hypot(dx, dy) + ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * SPIRAL_ARM_PX;
      });
      const order = turn.map((_, i) => i).sort((a, b) => turn[a] - turn[b]);
      const rank: number[] = [];
      order.forEach((chipIndex, place) => {
        rank[chipIndex] = place;
      });
      geo.current = {
        toFunnel: pts.map((c) => ({ x: funnel.left - c.x, y: funnel.top - c.y })),
        toCenter: pts.map((c) => ({ x: mid.x - c.x, y: mid.y - c.y })),
        rank,
      };
      // Phase 3: the avatar travels from its slot to the stage centre; connections sit on an ellipse around it.
      const stage = stageRef.current?.getBoundingClientRect();
      const slot = avatarSlotRef.current?.getBoundingClientRect();
      if (stage && slot) {
        avatarDelta.current = {
          x: stage.left + stage.width / 2 - (slot.left + slot.width / 2),
          y: stage.top + stage.height / 2 - (slot.top + slot.height / 2),
        };
        ring.current = CONNECTIONS.map((_, i) => {
          const angle = ((-90 + i * 60) * Math.PI) / 180;
          return { x: Math.cos(angle) * stage.width * 0.36, y: Math.sin(angle) * stage.height * 0.3 };
        });
      }
      setMeasured(true);
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={stageRef} className="relative size-full">
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2">
        <div ref={funnelRef} aria-hidden="true" className="absolute left-1/2 top-0 size-px" />
        <BrokerProfile
          progress={progress}
          avatarSlotRef={avatarSlotRef}
          avatarDelta={avatarDelta}
          reducedMotion={reducedMotion}
        />
      </div>
      <ConnectionChips progress={progress} ring={ring} reducedMotion={reducedMotion} />
      <div className="absolute inset-x-0 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-y-2">
        {BROKER_ROWS.map((row, rowIndex) => {
          const start = BROKER_ROWS.slice(0, rowIndex).reduce((n, r) => n + r.count, 0);
          return (
            <ul key={rowIndex} className={cx("m-0 flex list-none items-start justify-around p-0", row.className)}>
              {BROKER_RECORDS.slice(start, start + row.count).map(({ icon, label }, k) => (
                <SpiralChip
                  key={label}
                  icon={icon}
                  label={label}
                  index={start + k}
                  progress={progress}
                  geo={geo}
                  entered={entered}
                  reducedMotion={reducedMotion}
                  liRef={(el) => {
                    chipRefs.current[start + k] = el;
                  }}
                />
              ))}
            </ul>
          );
        })}
      </div>
    </div>
  );
}

/** One phase's copy: fully visible when scroll progress sits on its index, fading and drifting out either side. */
function PhaseLayer({
  index,
  progress,
  reducedMotion,
  className,
  children,
}: {
  index: number;
  progress: MotionValue<number>;
  reducedMotion: boolean;
  className?: string;
  children: ReactNode;
}) {
  const opacity = useTransform(progress, (p) => clamp01((0.5 - Math.abs(p - index)) / 0.3));
  const y = useTransform(progress, (p) => (reducedMotion ? 0 : (index - p) * 24));
  return (
    <motion.div style={{ opacity, y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Phone mock for section three: the top of an iPhone (bezel, island), cropped and faded into the page. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="relative size-full overflow-hidden rounded-t-4xl border border-b-0 border-border-subtle bg-bg-surface"
    >
      <span className="absolute left-1/2 top-2 z-10 h-4 w-14 -translate-x-1/2 rounded-full bg-black" />
      {children}
      <span className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-3/5 bg-linear-to-t from-brand-navy to-transparent" />
    </div>
  );
}

const SCREEN_LAYER = "absolute inset-0 flex flex-col gap-4 px-4 pt-12";

/** Skeleton line used by every phone screen. */
function Bar({ className }: { className?: string }) {
  return <span className={cx("block h-2 rounded-full bg-bg-elevated", className)} />;
}

/** Avatar circle + two lines, the repeating row of the call and email screens. `flag` marks the scam entry. */
function SkeletonRow({ icon: Icon, flag }: { icon: (typeof BROKER_RECORDS)[number]["icon"]; flag?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cx(
          "flex size-9 shrink-0 items-center justify-center rounded-full",
          flag ? "bg-status-danger-muted text-status-danger" : "bg-bg-elevated text-text-tertiary",
        )}
      >
        <Icon className="size-4" />
      </span>
      <div className="flex flex-1 flex-col gap-2">
        <Bar className={cx("w-3/4", flag && "bg-status-danger-muted")} />
        <Bar className="w-1/2" />
      </div>
    </div>
  );
}

/** Spam-call phase: a call log whose top entry is flagged. */
function CallScreen() {
  return (
    <>
      <SkeletonRow icon={PhoneOff} flag />
      {[0, 1, 2, 3].map((i) => (
        <SkeletonRow key={i} icon={Phone} />
      ))}
    </>
  );
}

/** Scam-text phase: a thread of unsolicited incoming bubbles. */
function TextScreen() {
  return (
    <>
      {["w-5/6", "w-2/3", "w-5/6", "w-1/2"].map((width, i) => (
        <div key={i} className={cx("flex flex-col gap-2 rounded-lg bg-bg-elevated p-3", width)}>
          <Bar className="w-full bg-text-tertiary/40" />
          <Bar className="w-2/3 bg-text-tertiary/40" />
        </div>
      ))}
    </>
  );
}

/** Phishing-email phase: an inbox whose top entry is flagged. */
function EmailScreen() {
  return (
    <>
      <SkeletonRow icon={ShieldAlert} flag />
      {[0, 1, 2, 3].map((i) => (
        <SkeletonRow key={i} icon={Mail} />
      ))}
    </>
  );
}

type NotificationProps = { shown: boolean; reducedMotion: boolean };

/** iOS-style banner. `stack` puts the app header on top (the call notifications); `row` puts the app icon at the
    left of the text (messages and mail). Dark glass with a hairline border so it separates from the phone. */
function NotificationCard({
  layout,
  icon: Icon,
  tint,
  app,
  title,
  subtitle,
  body,
  time = "now",
}: {
  layout: "stack" | "row";
  icon: (typeof BROKER_RECORDS)[number]["icon"];
  tint: string;
  app?: string;
  title: string;
  subtitle?: string;
  body: ReactNode;
  time?: string;
}) {
  const card =
    "rounded-lg border border-border-subtle bg-bg-elevated/90 p-3 text-left text-text-primary shadow-lg backdrop-blur-md";
  if (layout === "stack") {
    return (
      <div className={cx(card, "flex flex-col gap-1")}>
        <div className="flex items-center gap-2">
          <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-sm", tint)}>
            <Icon className="size-4 fill-current text-text-primary" />
          </span>
          <span className="flex-1 text-sm text-text-secondary">{app}</span>
          <span className="text-xs text-text-secondary">{time}</span>
        </div>
        <p className="m-0 text-md font-semibold">{title}</p>
        <p className="m-0 text-sm text-text-secondary">{body}</p>
      </div>
    );
  }
  return (
    <div className={cx(card, "flex gap-3")}>
      <span className={cx("flex size-10 shrink-0 items-center justify-center rounded-sm", tint)}>
        <Icon className="size-6 text-text-primary" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="m-0 text-md font-semibold">{title}</p>
          <span className="text-xs text-text-secondary">{time}</span>
        </div>
        {subtitle && <p className="m-0 text-sm font-medium">{subtitle}</p>}
        <p className="m-0 text-sm text-text-secondary">{body}</p>
      </div>
    </div>
  );
}

/** Banners are laid out 20% wider than the phone area, then scaled down, so they end up smaller but still wider than the phone. */
const BANNER_SCALE = 0.7;

/** Positions one banner at the notification anchor and pops it in (spring, rising out of the phone) or out.
    `depth` > 0 tucks it behind the front banner of a stack: lower, narrower, dimmer, so only its edge shows. */
function PopIn({
  shown,
  reducedMotion,
  delay = 0,
  depth = 0,
  children,
}: NotificationProps & { delay?: number; depth?: number; children: ReactNode }) {
  return (
    <motion.div
      initial={false}
      animate={
        shown
          ? { opacity: 1 - depth * 0.3, y: depth * 10, scale: BANNER_SCALE * (1 - depth * 0.06) }
          : { opacity: 0, y: reducedMotion ? 0 : 24, scale: BANNER_SCALE * (reducedMotion ? 1 : 0.94) }
      }
      transition={
        shown
          ? reducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 260, damping: 22, delay }
          : { duration: 0.15 }
      }
      style={{ zIndex: 3 - depth }}
      className="absolute left-1/2 top-0 w-6/5 origin-top -translate-x-1/2"
    >
      {children}
    </motion.div>
  );
}

const SPAM_CALLERS = ["(800) 555-0199", "(844) 555-0172", "(877) 555-0136"] as const;
/** Milliseconds after the phase becomes active at which each stacked call notification arrives. */
const CALL_ARRIVALS_MS = [250, 800, 1350] as const;

/** Spam-call phase: three call notifications arrive one after another, each pushing the last one back. */
function CallNotifications({ shown, reducedMotion }: NotificationProps) {
  const [arrived, setArrived] = useState(0);
  useEffect(() => {
    if (!shown) {
      setArrived(0);
      return;
    }
    if (reducedMotion) {
      setArrived(SPAM_CALLERS.length);
      return;
    }
    const ids = CALL_ARRIVALS_MS.map((ms, i) => window.setTimeout(() => setArrived(i + 1), ms));
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [shown, reducedMotion]);

  return (
    <>
      {SPAM_CALLERS.map((number, k) => (
        <PopIn key={number} shown={shown && arrived > k} depth={Math.max(arrived - 1 - k, 0)} reducedMotion={reducedMotion}>
          <NotificationCard layout="stack" icon={Phone} tint="bg-status-success" app="Phone" title="Scam Likely" body={number} />
        </PopIn>
      ))}
    </>
  );
}

/** Scam-text phase: one unsolicited text from a number, with a shortened link. */
function TextNotification({ shown, reducedMotion }: NotificationProps) {
  return (
    <PopIn shown={shown} delay={0.25} reducedMotion={reducedMotion}>
      <NotificationCard
        layout="row"
        icon={MessageCircle}
        tint="bg-status-success"
        title="(218)330-8004"
        body={
          <>
            Resolve your tax debt
            <br />
            bit.ly/3Tx8rQ
          </>
        }
      />
    </PopIn>
  );
}

/** Phishing-email phase: a fake bank alert. */
function EmailNotification({ shown, reducedMotion }: NotificationProps) {
  return (
    <PopIn shown={shown} delay={0.25} reducedMotion={reducedMotion}>
      <NotificationCard
        layout="row"
        icon={Mail}
        tint="bg-primary"
        title="Chase Bank"
        subtitle="ALERT!-Suspicious Login Activity"
        body="Login now to prevent your account from being suspended"
      />
    </PopIn>
  );
}

/** First phase of section three: a tilted phone whose screen shows a shield with a padlock. It fades in while the
    phase is active, then gives way to the real phone for the scam phases. */
function PrivacyIllustration({ shown, reducedMotion }: { shown: boolean; reducedMotion: boolean }) {
  return (
    <motion.svg
      aria-hidden="true"
      viewBox="40 16 160 240"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
      initial={false}
      animate={shown ? { opacity: 1, scale: 1 } : { opacity: 0, scale: reducedMotion ? 1 : 0.9 }}
      transition={shown && !reducedMotion ? { duration: 0.5, ease: [0.2, 0, 0, 1] } : { duration: shown ? 0 : 0.15 }}
      className="aspect-2/3 h-4/5 max-h-80"
    >
      <g transform="rotate(-10 120 160)" strokeWidth="3" className="stroke-text-primary">
        <rect x="72" y="40" width="96" height="188" rx="16" className="fill-brand-navy" />
        <rect x="108" y="48" width="24" height="5" rx="2.5" stroke="none" className="fill-text-primary" />
        <g strokeWidth="2" transform="translate(98 72) scale(1.9)" className="stroke-accent">
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <g transform="translate(12 12.5) scale(.42) translate(-12 -12)">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </g>
        </g>
        <path d="M92 150H148M92 166H136M92 182H144" strokeWidth="2.5" className="stroke-text-tertiary" />
      </g>
    </motion.svg>
  );
}

/** Section three phases: the privacy pitch first, then one phone screen + notification per scam type. */
const SPAM_PHASES: readonly {
  title: string;
  body: string;
  screen?: ReactNode;
  notification?: ComponentType<NotificationProps>;
}[] = [
  {
    title: "Privacy built for everyone",
    body: "We believe that everyone deserves privacy. Vanyshr provides a comprehensive suite of tools to fight against these brokers. Allowing you to keep your data safe from spammers and criminals.",
  },
  {
    title: "Fight Spam Calls",
    body: "They publish your name and number for anyone to find. That's the robocall pipeline — no leak required, it's just listed.",
    screen: <CallScreen />,
    notification: CallNotifications,
  },
  {
    title: "Stop Scam Texts",
    body: "A lot of these brokers list your info for free, where scammers can easily access millions of cell phone numbers at a time and send millions of scam texts at once - they only need a few to fall for it.",
    screen: <TextScreen />,
    notification: TextNotification,
  },
  {
    title: "Block Phishing Emails",
    body: "Knowing your email and accounts like banking or social media, they can send sophisticated realistic alerts prompting you to enter your credentials giving them your username and password so they can login and take over your account.",
    screen: <EmailScreen />,
    notification: EmailNotification,
  },
];

/** Privacy promises shown under section four's steps. `lead` is the bold opening phrase, when a row has one. */
const PRIVACY_PROMISES: readonly { icon: (typeof BROKER_RECORDS)[number]["icon"]; lead?: string; text: string }[] = [
  { icon: Ban, text: "We never share, sell or use your information to market you junk." },
  {
    icon: Download,
    lead: "Take it back anytime.",
    text: "Export your report whenever you want. Delete your account and your data goes with it.",
  },
];

/** Section five ("Removal is just the start."): the containers in its list. `label` is the optional small tag above the headline. */
const COVER_CARDS: readonly { label?: string; headline: string; body: string }[] = [
  {
    label: "Account Tracker",
    headline: "Active accounts monitored, Old accounts closed",
    body: "Connect your email and we find the accounts you use and even ones you've forgotten. Our bot reads each one's privacy policy and files the closure for you. Accounts you keep get monitored for breach alerts so you're notified immediately.",
  },
  {
    headline: "Blur your house on the map.",
    body: "We file requests to blur your home on street-view maps, so strangers can't study your house, cars, and routines from their couch.",
  },
  {
    headline: "Cover the people you love.",
    body: "Add your partner, parents, or kids. We scan and remove their info too — and flag it when it comes back, same as yours.",
  },
];

/** Sample broker guides for the "do it yourself" preview: the first is the front card, the rest peek out behind it. */
const GUIDE_PREVIEWS = [
  { broker: "FindPeopleFast", steps: 6 },
  { broker: "DataLookup", steps: 4 },
  { broker: "PeopleScan", steps: 8 },
] as const;

/** Portal preview: one broker opt-out guide card with two more stacked behind it. The stack pops in (back cards
    first) once the section is reached, and the cards behind are tucked lower, narrower and dimmer. */
function GuideStack({ shown, reducedMotion }: { shown: boolean; reducedMotion: boolean }) {
  return (
    <div aria-hidden="true" className="relative pb-6">
      {GUIDE_PREVIEWS.map(({ broker, steps }, depth) => (
        <motion.div
          key={broker}
          initial={false}
          animate={
            shown
              ? { opacity: 1 - depth * 0.3, y: depth * 10, scale: 1 - depth * 0.06 }
              : { opacity: 0, y: reducedMotion ? depth * 10 : 24 + depth * 10, scale: reducedMotion ? 1 - depth * 0.06 : 0.9 }
          }
          transition={
            shown && !reducedMotion
              ? { type: "spring", stiffness: 240, damping: 22, delay: (GUIDE_PREVIEWS.length - 1 - depth) * 0.12 }
              : { duration: shown ? 0 : 0.15 }
          }
          style={{ zIndex: GUIDE_PREVIEWS.length - depth }}
          className={cx(
            "flex items-center gap-3 rounded-lg border border-border-subtle bg-bg-surface p-4 text-left",
            depth === 0 ? "relative" : "absolute inset-x-0 top-0",
          )}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-primary-muted text-primary-text">
            <BookOpen className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="m-0 text-md font-semibold text-text-primary">
              {broker}: opt out in {steps} steps
            </p>
            <p className="m-0 text-sm text-text-secondary">Free guide · no signup</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const FAQS: readonly { question: string; answer: string }[] = [
  {
    question: "Why should I trust you with my data?",
    answer: "Fair question. We ask for the minimum, we never sell it, and you can export or delete everything anytime.",
  },
  {
    question: "How do you make money?",
    answer: "Subscriptions. No ads, no data sales, no broker kickbacks.",
  },
  {
    question: "Can't I do this myself?",
    answer:
      "Yes — the guides are free, right above. It takes hours and the data comes back. We do the filing and the re-filing.",
  },
  {
    question: "Is removal permanent?",
    answer:
      'No — and anyone promising "permanent" is selling something. Brokers take you down; we keep you down by re-filing when you reappear.',
  },
  {
    question: "What happens when my data comes back?",
    answer: "It will. We detect it and re-file automatically. That's the subscription working.",
  },
  {
    question: "What is synthetic cover?",
    answer: "We plant fake versions of your info so the real stuff gets lost in the noise.",
  },
  {
    question: "What happens when I cancel?",
    answer:
      "Completed removals stay completed. Monitoring and re-filing stop. Export or delete your data on the way out — no games.",
  },
];

/** Expand/collapse list: one answer open at a time, each question a full-width 48px button. */
function FaqList({ reducedMotion }: { reducedMotion: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <ul className="m-0 mt-6 flex min-h-0 flex-1 list-none flex-col overflow-y-auto p-0 pb-6">
      {FAQS.map(({ question, answer }, i) => {
        const expanded = open === i;
        return (
          <li key={question} className="border-b border-border-subtle">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={`faq-${i}`}
              onClick={() => setOpen(expanded ? null : i)}
              className="flex min-h-12 w-full items-center justify-between gap-3 py-3 text-left text-md font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
            >
              {question}
              <ChevronDown
                className={cx("size-4 shrink-0 text-text-secondary transition-transform duration-base", expanded && "rotate-180")}
                aria-hidden="true"
              />
            </button>
            <motion.div
              id={`faq-${i}`}
              initial={false}
              animate={expanded ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
              transition={{ duration: reducedMotion ? 0 : 0.32, ease: [0.2, 0, 0, 1] }}
              className="overflow-hidden"
            >
              <p className="m-0 pb-4 text-left text-md text-text-secondary">{answer}</p>
            </motion.div>
          </li>
        );
      })}
    </ul>
  );
}

/** Headline + body shown inside an expanded step. */
function StepCopy({ headline, body }: { headline: string; body: string }) {
  return (
    <>
      <h3 className="m-0 text-lg font-semibold text-text-primary">{headline}</h3>
      <p className="m-0 mt-2 text-md text-text-secondary">{body}</p>
    </>
  );
}

/** Section four's steps. `content` is what the expanded step shows. */
const STEPS: readonly { title: string; content?: ReactNode }[] = [
  {
    title: "Start with a scan",
    content: (
      <StepCopy
        headline="You give a name and ZIP."
        body="That's the whole signup for a scan. You decide what else we look for — nothing extra is ever required."
      />
    ),
  },
  {
    title: "Sweep away your data",
    content: (
      <StepCopy
        headline="We file the removals."
        body="Our agents file opt-outs with every broker that has you and track each one. You watch progress; you never chase a broker."
      />
    ),
  },
  {
    title: "Scout for new listings",
    content: (
      <StepCopy
        headline="It comes back. We re-file."
        body="Brokers re-list. New ones appear. We catch it and file again — automatically. You get an alert, not a chore."
      />
    ),
  },
  {
    title: "Stuff decoy data",
    content: (
      <StepCopy
        headline="We plant decoys."
        body="We plant fake versions of your info, so the real stuff gets lost in the noise. Brokers end up holding data that points nowhere."
      />
    ),
  },
];

/** Every snap stop in the stack, one stage apart: hero, section two's phases, section three's phases, then
    section four's steps. Literal class names so Tailwind can see them; extend with the stack. */
const SNAP_STOPS = [
  "top-0",
  "top-stage",
  "top-stage-2",
  "top-stage-3",
  "top-stage-4",
  "top-stage-5",
  "top-stage-6",
  "top-stage-7",
  "top-stage-8",
  "top-stage-9",
  "top-stage-10",
  "top-stage-11",
  "top-stage-12",
  "top-stage-13",
  "top-stage-14",
] as const;

/** One step of the vertical progress indicator. Done steps collapse to a green check, the active step is a filled
    number that expands to show its content, upcoming steps are a muted number. The connector below turns green
    once the step is done. */
function ProgressStep({
  number,
  title,
  status,
  last,
  reducedMotion,
  children,
}: {
  number: number;
  title: string;
  status: "done" | "active" | "upcoming";
  last: boolean;
  reducedMotion: boolean;
  children?: ReactNode;
}) {
  const duration = reducedMotion ? 0 : 0.32;
  return (
    <li aria-current={status === "active" ? "step" : undefined} className="flex gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cx(
            "flex size-8 shrink-0 items-center justify-center rounded-full border text-md font-bold transition-colors duration-base",
            status === "done" && "border-status-success bg-status-success text-text-primary",
            status === "active" && "border-primary bg-primary text-primary-on",
            status === "upcoming" && "border-border bg-bg-surface text-text-secondary",
          )}
        >
          {status === "done" ? (
            <motion.span
              key="check"
              initial={reducedMotion ? false : { scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 18 }}
              className="flex"
            >
              <Check className="size-4" strokeWidth={3} aria-label="Done" />
            </motion.span>
          ) : (
            number
          )}
        </span>
        {!last && (
          <span
            className={cx(
              "my-1 w-0.5 flex-1 rounded-full transition-colors duration-base",
              status === "done" ? "bg-status-success" : "bg-border-subtle",
            )}
          />
        )}
      </div>
      <div className="min-w-0 flex-1 pb-3 text-left">
        <p
          className={cx(
            "m-0 flex h-8 items-center text-lg font-semibold transition-colors duration-base",
            status === "active" ? "text-text-primary" : "text-text-secondary",
          )}
        >
          {title}
        </p>
        <motion.div
          initial={false}
          animate={status === "active" ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
          transition={{ duration, ease: [0.2, 0, 0, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-2 rounded-lg border border-border-subtle bg-bg-surface p-4">{children}</div>
        </motion.div>
      </div>
    </li>
  );
}

/** One threat word at a time: letters blur/fade in left to right, an orange rule sweeps under it. */
function RotatingThreat({ words, reducedMotion }: { words: readonly string[]; reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), WORD_MS);
    return () => window.clearInterval(id);
  }, [words]);

  const word = words[index];

  return (
    <span className="inline-flex h-10 items-center" aria-hidden="true">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={word}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          className="relative inline-block whitespace-nowrap pb-1 text-accent-text"
        >
          {word.split("").map((char, i) => (
            <motion.span
              key={i}
              initial={reducedMotion ? false : { opacity: 0, filter: "blur(8px)", y: 6 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.35, delay: reducedMotion ? 0 : i * LETTER_STAGGER_S, ease: [0.2, 0, 0, 1] }}
              className="inline-block whitespace-pre"
            >
              {char}
            </motion.span>
          ))}
          <span className="animate-underline-sweep absolute inset-x-0 bottom-0 h-[3px] rounded-full" />
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** /landing — dark-navy entry page. "Find my data" opens the same drawer and scan sequence as `/`. */
export function LandingPage() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [fieldFocused, setFieldFocused] = useState(false);
  const keyboard = useKeyboardInset();
  const keyboardOpen = keyboard.inset > 0;
  const reducedMotion = Boolean(useReducedMotion());
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Navbar action: "Sign in" on the hero, "Get Started" once the snap stack is scrolled past halfway to section 2.
  const [pastHero, setPastHero] = useState(false);
  // Section two's chip entrance plays once it is mostly in view and resets when the hero is back on screen.
  const [sectionTwoEntered, setSectionTwoEntered] = useState(false);
  // Which section-three phase is on screen (-1 until the section starts sliding in); drives the notifications.
  const [spamActive, setSpamActive] = useState(-1);
  // Which section-four step is expanded (the first until the section is reached).
  const [stepActive, setStepActive] = useState(0);
  // Whether the do-it-yourself section is (nearly) on screen; plays its guide stack in.
  const [diyShown, setDiyShown] = useState(false);
  const { scrollY } = useScroll({ container: scrollerRef });
  useMotionValueEvent(scrollY, "change", (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    if (stage > 0) {
      setPastHero(y / stage >= 0.5);
      setSectionTwoEntered((on) => (on ? y / stage > 0.25 : y / stage >= 0.6));
      const spamRaw = y / stage - (1 + PHASES.length);
      setSpamActive(spamRaw < -0.5 ? -1 : Math.min(Math.max(Math.round(spamRaw), 0), SPAM_PHASES.length - 1));
      const stepRaw = spamRaw - SPAM_PHASES.length;
      setStepActive(Math.min(Math.max(Math.round(stepRaw), 0), STEPS.length - 1));
      // Sections four and five are one stage per step / one stage respectively, so the DIY section starts after both.
      setDiyShown(stepRaw - STEPS.length - 1 >= -0.4);
    }
  });
  // 0 at the first phase, PHASES.length - 1 at the last; the hero is stage 0, phase 1 starts at one stage.
  const phaseProgress = useTransform(scrollY, (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    return stage > 0 ? Math.min(Math.max(y / stage - 1, 0), PHASES.length - 1) : 0;
  });

  // Section three starts right after section two's phases (hero = stage 0, then one stage per phase).
  const spamProgress = useTransform(scrollY, (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    return stage > 0 ? Math.min(Math.max(y / stage - (1 + PHASES.length), 0), SPAM_PHASES.length - 1) : 0;
  });

  // The phone is absent during the first phase (the privacy tiles) and fades in as phase two arrives.
  const phoneOpacity = useTransform(spamProgress, (p) => clamp01((p - 0.3) / 0.4));

  useDrawerPageEffects(isOpen, fieldFocused, "var(--color-brand-navy)");

  return (
    <>
      {isOpen && <KeyboardStripFill keyboard={keyboard} />}
      <Page
        className={cx("flex flex-col bg-brand-navy!", isOpen && "overflow-hidden!")}
        // Same keyboard pinning as `/`: keep the Page on the visual viewport while the keyboard is up.
        style={
          keyboardOpen
            ? { height: keyboard.visibleHeight, transform: `translateY(${keyboard.offsetTop}px)` }
            : undefined
        }
      >
        <Navbar
          className="static! mb-0 bg-transparent! [&>div:empty]:hidden!"
          bgClassName="bg-transparent! backdrop-blur-none! border-transparent!"
          rightClassName="bg-transparent! shadow-none! backdrop-blur-none!"
          left={<BrandLockup className="ml-2.5 h-7" />}
          innerClassName="pl-2.5!"
          leftClassName="ml-0! bg-transparent! shadow-none! backdrop-blur-none!"
          right={
            <AnimatePresence mode="wait" initial={false}>
              {pastHero ? (
                <motion.button
                  key="get-started"
                  type="button"
                  onClick={() => setIsOpen(true)}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                  className="relative flex h-9 items-center gap-1 whitespace-nowrap rounded-full bg-primary px-4 text-md font-bold text-primary-on before:absolute before:inset-x-0 before:-inset-y-1 outline-none transition-colors duration-fast hover:bg-primary-hover active:bg-primary-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  Get Started
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </motion.button>
              ) : (
                <motion.button
                  key="signin"
                  type="button"
                  onClick={() => navigate("/login")}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                  className="flex h-11 items-center gap-1 whitespace-nowrap text-md font-semibold text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
                >
                  Sign in
                  <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
          }
        />

        {/* Snap stack. The scroll container is exactly the space under the navbar (one "stage").
            Swipes snap section to section like a carousel: release past halfway and the next
            section completes; release short of it and it settles back. Sections 2-4 are sticky
            at the top, so each new section slides over the previous one instead of pushing it.
            Snap markers (not the sticky sections) carry snap-align, since sticky boxes move. */}
        <div
          ref={scrollerRef}
          className={cx(
            "cq-size min-h-0 flex-1 snap-y snap-mandatory overflow-y-auto overscroll-contain",
            isOpen && "overflow-hidden!",
          )}
        >
          <div className="relative">
            {SNAP_STOPS.map((top) => (
              <span
                key={top}
                aria-hidden="true"
                className={cx("pointer-events-none absolute inset-x-0 h-px snap-start snap-always", top)}
              />
            ))}

            {/* Hero. The image is the only shrinkable child, so short screens scale it down instead of
                colliding with "Learn More"; tall screens leave the slack above it (mt-auto). */}
            <section className="cq-inline flex h-stage min-h-0 flex-col items-center overflow-hidden px-6 text-center">
              <span className="mb-5 mt-3 inline-flex w-fit shrink-0 items-center gap-2 rounded-full border border-text-primary/20 px-4 py-1.5 text-md font-bold text-text-primary">
                <ShieldCheck className="size-5 shrink-0 text-primary" aria-hidden="true" />
                AI Consumer Cyber Defense
              </span>
              <div className="flex min-h-40 w-full shrink items-center justify-center">
                <img src={heroScene} alt="" className="max-h-full w-4/5 object-contain" />
              </div>

              <h1
                className="m-0 mt-5 flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-display text-display-fluid font-bold leading-tight tracking-tight text-text-primary"
                aria-label={`Vanysh from ${THREAT_WORDS.join(", ")}`}
              >
                <span aria-hidden="true">
                  <span className="italic">Vanysh</span> from
                </span>
                <RotatingThreat words={THREAT_WORDS} reducedMotion={reducedMotion} />
              </h1>
              <p className="m-0 mt-3 shrink-0 text-lg text-text-secondary">
                Find where your private data is being exposed across the web then make it{" "}
                <span className="font-bold italic text-text-primary">vanysh!</span>
              </p>

              <div className="mt-6 flex w-full shrink-0 flex-col items-center gap-3">
                <div className="w-1/2">
                  <button type="button" onClick={() => setIsOpen(true)} className={cx(primaryButton, "text-lg!")}>
                    Find my data
                  </button>
                </div>
                <ul className="m-0 flex list-none items-center justify-center gap-4 p-0 text-md italic text-text-secondary">
                  {["No Credit Card", "No Sign Up"].map((label) => (
                    <li key={label} className="flex items-center gap-1.5">
                      <span className="size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                      {label}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-auto flex shrink-0 justify-center pt-4 pb-[max(50px,env(safe-area-inset-bottom))]">
                <button
                  type="button"
                  onClick={() => {
                  const scroller = scrollerRef.current;
                  scroller?.scrollTo({ top: scroller.clientHeight, behavior: reducedMotion ? "auto" : "smooth" });
                }}
                  className="flex h-12 items-center gap-1 rounded-full px-4 text-lg font-semibold text-text-primary outline-none transition-colors duration-fast hover:bg-state-hover active:bg-state-active focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  Learn More
                  <ChevronDown className="animate-nudge-down size-4 shrink-0" strokeWidth={3} aria-hidden="true" />
                </button>
              </div>
            </section>

            {/* Section two. Pinned for one stage per phase: the spacers below give the scroll distance
                while this stays stuck, and scroll progress crossfades the phase layers (top 70% illustration,
                copy beneath; the chips funnel into the card). Snap markers sit at each phase, so one swipe advances one phase. */}
            <section aria-label="Data brokers" className="sticky top-0 z-10 h-stage overflow-hidden rounded-t-lg bg-bg-app">
              <div className="absolute inset-x-0 top-0 h-7/10 px-6 py-4">
                <PhaseIllustration progress={phaseProgress} entered={sectionTwoEntered} reducedMotion={reducedMotion} />
              </div>
              {PHASES.map((phase, i) => (
                <PhaseLayer
                  key={phase.title}
                  index={i}
                  progress={phaseProgress}
                  reducedMotion={reducedMotion}
                  className="absolute inset-x-0 bottom-0 top-7/10 flex flex-col px-6 text-center"
                >
                  <h2 className="m-0 font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                    {phase.title}
                  </h2>
                  <p className="m-0 mt-3 text-lg text-text-secondary">{phase.body}</p>
                </PhaseLayer>
              ))}
            </section>
            {PHASES.slice(1).map((phase) => (
              <div key={phase.title} aria-hidden="true" className="h-stage" />
            ))}
            {/* Section three. Same pinning as section two: spacers supply one stage of scroll per extra phase.
                Column: title, phone (up to 70%, shrinks if the copy needs the room), then the stacked copy
                layers (one grid cell, so the block is as tall as the longest phase). */}
            <section
              aria-label="Privacy"
              className="sticky top-0 z-20 flex h-stage flex-col overflow-hidden rounded-t-lg bg-brand-navy px-6 text-center"
            >
              <div className="relative flex max-h-7/10 min-h-0 flex-1 items-start justify-center pt-6">
                <div className="absolute inset-0 flex items-center justify-center pt-6">
                  <PrivacyIllustration shown={spamActive === 0} reducedMotion={reducedMotion} />
                </div>
                <motion.div style={{ opacity: phoneOpacity }} className="h-full w-2/3">
                  <PhoneFrame>
                    {SPAM_PHASES.map(
                      (phase, i) =>
                        phase.screen && (
                          <PhaseLayer
                            key={phase.title}
                            index={i}
                            progress={spamProgress}
                            reducedMotion={reducedMotion}
                            className={SCREEN_LAYER}
                          >
                            {phase.screen}
                          </PhaseLayer>
                        ),
                    )}
                  </PhoneFrame>
                </motion.div>
                {/* Notifications sit outside the phone (which clips) and are wider than it, so they pop out. */}
                <div className="pointer-events-none absolute inset-x-0 top-2/5 z-20">
                  {SPAM_PHASES.map(
                    (phase, i) =>
                      phase.notification && (
                        <phase.notification key={phase.title} shown={spamActive === i} reducedMotion={reducedMotion} />
                      ),
                  )}
                </div>
              </div>
              <div className="grid shrink-0 pb-4">
                {SPAM_PHASES.map((phase, i) => (
                  <PhaseLayer
                    key={phase.title}
                    index={i}
                    progress={spamProgress}
                    reducedMotion={reducedMotion}
                    className="col-start-1 row-start-1 flex flex-col"
                  >
                    <h3 className="m-0 font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                      {phase.title}
                    </h3>
                    <p className="m-0 mt-3 text-lg text-text-secondary">{phase.body}</p>
                  </PhaseLayer>
                ))}
              </div>
            </section>
            {SPAM_PHASES.slice(1).map((phase) => (
              <div key={phase.title} aria-hidden="true" className="h-stage" />
            ))}
            {/* Section four. Pinned like two and three: one stage of scroll per step, and the stepper on the left
                advances with it (see `stepActive`). */}
            <section
              aria-label="How Vanyshr works"
              className="sticky top-0 z-30 flex h-stage flex-col rounded-t-lg bg-bg-app px-6"
            >
              <h2 className="m-0 shrink-0 pt-5 text-left font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                How Vanyshr Works
              </h2>
              <p className="m-0 mt-1 shrink-0 text-left text-lg text-text-secondary">We do the work. You're in control.</p>
              <ol className="m-0 mt-6 flex min-h-0 list-none flex-col p-0">
                {STEPS.map((step, i) => (
                  <ProgressStep
                    key={step.title}
                    number={i + 1}
                    title={step.title}
                    status={i < stepActive ? "done" : i === stepActive ? "active" : "upcoming"}
                    last={i === STEPS.length - 1}
                    reducedMotion={reducedMotion}
                  >
                    {step.content}
                  </ProgressStep>
                ))}
              </ol>
              {/* Fills the space under the steps; sits at the bottom of the stage. */}
              <div className="mt-auto pb-6 pt-4">
                <div className="rounded-lg border border-border-subtle bg-bg-surface p-4 text-left">
                  <h3 className="m-0 text-lg font-semibold text-text-primary">Your data stays yours.</h3>
                  <ul className="m-0 mt-3 flex list-none flex-col gap-3 p-0">
                    {PRIVACY_PROMISES.map(({ icon: Icon, lead, text }) => (
                      <li key={text} className="flex items-start gap-3">
                        <Icon className="mt-0.5 size-4 shrink-0 text-primary-text" aria-hidden="true" />
                        <p className="m-0 text-sm text-text-secondary">
                          {lead && <span className="font-semibold text-text-primary">{lead} </span>}
                          {text}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
            {STEPS.slice(1).map((step) => (
              <div key={step.title} aria-hidden="true" className="h-stage" />
            ))}
            {/* Section five. One stage: the header is pinned and the list of containers scrolls beneath it. */}
            <section
              aria-label="Removal is just the start"
              className="sticky top-0 z-40 flex h-stage flex-col overflow-hidden rounded-t-lg bg-brand-navy px-6"
            >
              <h2 className="m-0 shrink-0 pt-5 text-left font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                Removal is just the start.
              </h2>
              <p className="m-0 mt-1 shrink-0 text-left text-lg text-text-secondary">
                More layers of cover, for added protection
              </p>
              <ul className="m-0 mt-6 flex min-h-0 flex-1 list-none flex-col gap-3 overflow-y-auto p-0 pb-6">
                {COVER_CARDS.map((card) => (
                  <li key={card.headline} className="rounded-lg border border-border-subtle bg-bg-surface p-4 text-left">
                    {card.label && <p className="m-0 mb-2 text-sm font-semibold text-primary-text">{card.label}</p>}
                    <h3 className="m-0 text-lg font-semibold text-text-primary">{card.headline}</h3>
                    <p className="m-0 mt-2 text-md text-text-secondary">{card.body}</p>
                  </li>
                ))}
              </ul>
            </section>
            {/* Section six. One stage: copy on top, the guide preview stacked beneath it. */}
            <section
              aria-label="Do it yourself"
              className="sticky top-0 z-50 flex h-stage flex-col overflow-hidden rounded-t-lg bg-bg-app px-6"
            >
              <h2 className="m-0 shrink-0 pt-5 text-left font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                Don't pay us - Do it Yourself
              </h2>
              <p className="m-0 mt-3 shrink-0 text-left text-lg text-text-secondary">
                Every broker has an opt-out page. Our public guides walk you through each one, step by step — no signup
                to read them. It takes hours, and the data comes back. But it's your data; the instructions should be
                free.
              </p>
              <div className="flex min-h-0 flex-1 flex-col justify-center gap-6 pb-6">
                <GuideStack shown={diyShown} reducedMotion={reducedMotion} />
                {/* Secondary button (DESIGN 11.1): elevated fill, wash overlays for hover/press. Destination TBD. */}
                <button
                  type="button"
                  className="relative flex h-12 w-fit items-center justify-center overflow-hidden rounded-full bg-bg-elevated px-5 text-md font-semibold text-text-primary outline-none before:absolute before:inset-0 before:bg-state-hover before:opacity-0 hover:before:opacity-100 active:before:bg-state-active active:before:opacity-100 focus-visible:outline-2 focus-visible:outline-border-focus focus-visible:ring-4 focus-visible:ring-ring-focus"
                >
                  DIY Portal
                </button>
              </div>
            </section>
            {/* Section seven. One stage: pinned title, FAQ list scrolls beneath it. */}
            <section
              aria-label="FAQs"
              className="sticky top-0 z-60 flex h-stage flex-col overflow-hidden rounded-t-lg bg-brand-navy px-6"
            >
              <h2 className="m-0 shrink-0 pt-5 text-left font-display text-xl font-bold leading-tight tracking-tight text-text-primary">
                FAQs
              </h2>
              <FaqList reducedMotion={reducedMotion} />
            </section>
          </div>
        </div>

        {isOpen && (
          <FindMyDataDrawer
            keyboard={keyboard}
            onClose={() => {
              setIsOpen(false);
              setFieldFocused(false);
            }}
            onFieldFocusChange={setFieldFocused}
          />
        )}
      </Page>
    </>
  );
}
