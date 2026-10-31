import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
import { List, ListItem, Navbar, Page, Panel } from "konsta/react";
import {
  Briefcase,
  Cake,
  Car,
  ChevronDown,
  ChevronRight,
  CreditCard,
  GraduationCap,
  House,
  IdCard,
  Image,
  Mail,
  MapPin,
  Menu,
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
      className="relative h-full w-2/3 overflow-hidden rounded-t-4xl border border-b-0 border-border-subtle bg-bg-surface"
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

/** Section three: "Why you get..." phases, each with its own phone screen. */
const SPAM_PHASES: readonly { title: string; body: string; screen: ReactNode }[] = [
  {
    title: "Spam Calls",
    body: "They publish your name and number for anyone to find. That's the robocall pipeline — no leak required, it's just listed.",
    screen: <CallScreen />,
  },
  {
    title: "Scam Texts",
    body: "A lot of these brokers list your info for free, where scammers can easily access millions of cell phone numbers at a time and send millions of scam texts at once - they only need a few to fall for it.",
    screen: <TextScreen />,
  },
  {
    title: "Phishing Emails",
    body: "Knowing your email and accounts like banking or social media, they can send sophisticated realistic alerts prompting you to enter your credentials giving them your username and password so they can login and take over your account.",
    screen: <EmailScreen />,
  },
];

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
  // Navbar action: "Sign in" on the hero, hamburger once the snap stack is scrolled past halfway to section 2.
  const [pastHero, setPastHero] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  // Section two's chip entrance plays once it is mostly in view and resets when the hero is back on screen.
  const [sectionTwoEntered, setSectionTwoEntered] = useState(false);
  const { scrollY } = useScroll({ container: scrollerRef });
  useMotionValueEvent(scrollY, "change", (y) => {
    const stage = scrollerRef.current?.clientHeight ?? 0;
    if (stage > 0) {
      setPastHero(y / stage >= 0.5);
      setSectionTwoEntered((on) => (on ? y / stage > 0.25 : y / stage >= 0.6));
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
                  key="menu"
                  type="button"
                  aria-label="Open menu"
                  onClick={() => setMenuOpen(true)}
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: reducedMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                  className="flex size-11 items-center justify-center text-text-primary outline-none focus-visible:outline-2 focus-visible:outline-border-focus"
                >
                  <Menu className="size-6" aria-hidden="true" />
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
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-2 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-3 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-4 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-5 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-6 h-px snap-start snap-always" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-stage-7 h-px snap-start snap-always" />

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
              aria-label="Why you get"
              className="sticky top-0 z-20 flex h-stage flex-col overflow-hidden rounded-t-lg bg-brand-navy px-6 text-center"
            >
              <h2 className="m-0 shrink-0 pt-5 font-display text-display-xs font-bold leading-tight tracking-tight text-text-primary">
                Why you get...
              </h2>
              <div className="flex max-h-7/10 min-h-0 flex-1 items-start justify-center pt-4">
                <PhoneFrame>
                  {SPAM_PHASES.map((phase, i) => (
                    <PhaseLayer
                      key={phase.title}
                      index={i}
                      progress={spamProgress}
                      reducedMotion={reducedMotion}
                      className={SCREEN_LAYER}
                    >
                      {phase.screen}
                    </PhaseLayer>
                  ))}
                </PhoneFrame>
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
            <section
              aria-label="Section four"
              className="sticky top-0 z-30 h-stage rounded-t-lg bg-brand-orange"
            />
          </div>
        </div>

        {/* Side menu: Konsta Panel from the right, half the screen width. */}
        <Panel
          side="right"
          opened={menuOpen}
          onBackdropClick={() => setMenuOpen(false)}
          className="w-1/2! rounded-l-lg! bg-bg-surface!"
        >
          <List nested className="my-4! text-text-primary">
            <ListItem
              link
              title={<span className="text-text-primary">Find my data</span>}
              onClick={() => {
                setMenuOpen(false);
                setIsOpen(true);
              }}
            />
            <ListItem link title={<span className="text-text-primary">Sign in</span>} onClick={() => navigate("/login")} />
          </List>
        </Panel>

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
