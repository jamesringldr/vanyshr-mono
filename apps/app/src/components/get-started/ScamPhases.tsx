import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { motion, useTransform, type MotionValue } from "framer-motion";
import { Mail, MessageCircle, Phone, PhoneOff, ShieldAlert, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";

const clamp01 = (n: number) => Math.min(Math.max(n, 0), 1);

/** One phase's copy: fully visible when scroll progress sits on its index, fading and drifting out either side. */
export function PhaseLayer({
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
export function PhoneFrame({ children }: { children: ReactNode }) {
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

export const SCREEN_LAYER = "absolute inset-0 flex flex-col gap-4 px-4 pt-12";

/** Skeleton line used by every phone screen. */
function Bar({ className }: { className?: string }) {
  return <span className={cx("block h-2 rounded-full bg-bg-elevated", className)} />;
}

/** Avatar circle + two lines, the repeating row of the call and email screens. `flag` marks the scam entry. */
function SkeletonRow({ icon: Icon, flag }: { icon: LucideIcon; flag?: boolean }) {
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

export type NotificationProps = { shown: boolean; reducedMotion: boolean };

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
  icon: LucideIcon;
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

/** The three scam phases of section two: one phone screen + notification banner each. */
export const SCAM_PHASES: readonly {
  title: string;
  screen: ReactNode;
  notification: ComponentType<NotificationProps>;
}[] = [
  { title: "Fight Spam Calls", screen: <CallScreen />, notification: CallNotifications },
  { title: "Stop Scam Texts", screen: <TextScreen />, notification: TextNotification },
  { title: "Block Phishing Emails", screen: <EmailScreen />, notification: EmailNotification },
];
