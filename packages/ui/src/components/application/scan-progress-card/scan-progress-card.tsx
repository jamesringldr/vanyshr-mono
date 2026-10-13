import { useEffect, useState, type ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type MotionValue } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { Vinnie } from "../../foundations/vinnie";

export interface ScanPhase {
    label: string;
    icon: LucideIcon;
    /**
     * Finale styling: once this phase is the finished, active row it stands alone (the title and
     * the earlier rows are hidden), drops its check, shows the label bold, and puts this line under
     * it in thin white italics.
     */
    detail?: string;
}

export interface ScanProgressCardProps {
    /** Ordered phases. The card shows the previous, active and next phase. */
    phases: readonly ScanPhase[];
    /** Zero-based index of the active phase. Controlled by the parent. */
    activeIndex: number;
    /** `scanning` runs the tracer, shimmer and pulses; `complete` settles everything static. */
    status?: "scanning" | "complete";
    /** Active phase row ~30% larger (row height, icon, label). */
    largeActive?: boolean;
    /** Tighter spacing: shorter phase rows and less space under the title. */
    dense?: boolean;
    /** Heading above Vinnie and the phase rows. */
    title?: string;
    /**
     * On `complete`: Vinnie spins and morphs into a green circle with a white check, and the card
     * outline turns green. Off by default (the card just settles).
     */
    successOnComplete?: boolean;
    /**
     * Text sizes follow the viewport (the `--fluid-15` / `--fluid-19p5` variables, defined by the
     * app's `.fluid-type` trial class on an ancestor) instead of the fixed 15px / 19.5px.
     */
    fluid?: boolean;
    className?: string;
}

const VINNIE_CYCLE = ["idle", "shy", "shy", "scared"] as const;

/**
 * Vinnie's `auto` colorway keys off Tailwind's `dark:` variant, which this app
 * pins off (the `.light` class on the root is the only theme mechanism), so
 * `auto` never switches. Read the root class instead: light → navy, dark → primary.
 */
function useIsLightTheme(): boolean {
    const [isLight, setIsLight] = useState(() => document.documentElement.classList.contains("light"));

    useEffect(() => {
        const root = document.documentElement;
        const observer = new MutationObserver(() => setIsLight(root.classList.contains("light")));
        observer.observe(root, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    return isLight;
}

/** Three white dots pulsing in sequence; static when not animated. */
export function PulseDots({ animated }: { animated: boolean }) {
    return (
        <span className="ml-1 flex shrink-0 items-center gap-1" aria-hidden>
            {[0, 1, 2].map((dot) => (
                <motion.span
                    key={dot}
                    className="size-1.5 rounded-full bg-text-primary"
                    initial={false}
                    animate={animated ? { opacity: [0.25, 1, 0.25], scale: [0.8, 1, 0.8] } : { opacity: 0.6 }}
                    transition={
                        animated
                            ? { duration: 1.2, ease: "easeInOut", repeat: Infinity, delay: dot * 0.2 }
                            : { duration: 0 }
                    }
                />
            ))}
        </span>
    );
}

/** Vinnie bobbing through the scan expression cycle. Size him with `className` (h-/w-). */
export function ScanVinnie({ className }: { className?: string }) {
    const isLight = useIsLightTheme();
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            className="shrink-0"
            animate={reduceMotion ? undefined : { y: ["0%", "-8%", "0%"] }}
            transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
        >
            <Vinnie
                colorway={isLight ? "navy" : "primary"}
                cycle={VINNIE_CYCLE}
                hold={1400}
                className={cx("drop-shadow-lg drop-shadow-primary/40", className)}
                aria-hidden
            />
        </motion.div>
    );
}

/**
 * Vinnie, or on success a green check circle. On the flip Vinnie spins one full turn while he
 * shrinks and fades, and the circle spins in from the other direction and grows into his place;
 * the check then draws itself. `initial={false}`: mounting already-complete shows the end state.
 */
function VinnieOrSuccess({ success }: { success: boolean }) {
    const reduceMotion = useReducedMotion();
    const spin = { duration: reduceMotion ? 0 : 0.7, ease: [0.4, 0, 0.2, 1] as const };

    return (
        <div className="relative size-16 shrink-0">
            <motion.div
                className="absolute inset-0"
                initial={false}
                animate={success ? { rotate: 360, scale: 0.3, opacity: 0 } : { rotate: 0, scale: 1, opacity: 1 }}
                transition={spin}
                aria-hidden={success}
            >
                <ScanVinnie className="h-16 w-16" />
            </motion.div>
            <motion.div
                className="absolute inset-0 flex items-center justify-center"
                initial={false}
                animate={success ? { rotate: 0, scale: 1, opacity: 1 } : { rotate: -180, scale: 0.3, opacity: 0 }}
                transition={{ ...spin, delay: success && !reduceMotion ? 0.25 : 0 }}
                aria-hidden
            >
                <span className="flex size-14 items-center justify-center rounded-full bg-status-success">
                    <svg viewBox="0 0 24 24" className="size-8" fill="none" aria-hidden>
                        <motion.path
                            d="M5 12.5l4.5 4.5L19 7.5"
                            className="stroke-(--color-brand-primary4)"
                            strokeWidth={3}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={false}
                            animate={{ pathLength: success ? 1 : 0 }}
                            transition={{ duration: reduceMotion ? 0 : 0.4, delay: success && !reduceMotion ? 0.65 : 0 }}
                        />
                    </svg>
                </span>
            </motion.div>
        </div>
    );
}

/**
 * Comet layers, tail to head: each is a dash ending at the same head point, longer ones thinner.
 * Stacked with round caps they read as one stroke that's thick at the head and tapers to a
 * point; enough layers that the width steps between neighbors are too small to see. Lengths are
 * in pathLength units (100 = the full perimeter); width falls linearly with distance from the head.
 */
const COMET_STEPS = 24;
const COMET_HEAD = { length: 2, width: 3 };
const COMET_TAIL = { length: 26, width: 0.5 };
const COMET_LAYERS = Array.from({ length: COMET_STEPS }, (_, i) => {
    const t = i / (COMET_STEPS - 1); // 0 = tail, 1 = head
    return {
        length: COMET_TAIL.length + (COMET_HEAD.length - COMET_TAIL.length) * t,
        width: COMET_TAIL.width + (COMET_HEAD.width - COMET_TAIL.width) * t,
    };
});
const COMET_LENGTH = COMET_TAIL.length;

/** One comet layer. Its dash offset is derived from the shared `progress`, never animated on its own. */
function CometLayer({ length, width, progress }: { length: number; width: number; progress: MotionValue<number> }) {
    // Shift each dash so its leading end lines up with the longest one's.
    const start = length - COMET_LENGTH;
    const strokeDashoffset = useTransform(progress, (v) => start - v);

    return (
        <motion.rect
            width="100%"
            height="100%"
            style={{ rx: "var(--radius-lg)", strokeDashoffset }}
            fill="none"
            className="stroke-primary"
            strokeWidth={width}
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${length} ${100 - length}`}
        />
    );
}

/**
 * Comet traveling the card border. pathLength=100 keeps the dashes relative to the perimeter.
 * One animation drives every layer, so they can't drift apart (separate per-layer animations did,
 * splitting the head from the tail on iOS Safari).
 */
function PerimeterTracer() {
    const progress = useMotionValue(0);

    useEffect(() => {
        const controls = animate(progress, 100, { duration: 5, ease: "linear", repeat: Infinity });
        return () => controls.stop();
    }, [progress]);

    return (
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            {COMET_LAYERS.map(({ length, width }) => (
                <CometLayer key={length} length={length} width={width} progress={progress} />
            ))}
        </svg>
    );
}

/** Active-phase label: a bright band travels left to right across the words. */
function ShimmerLabel({ children, animated }: { children: ReactNode; animated: boolean }) {
    if (!animated) return <span className="truncate font-medium text-text-primary">{children}</span>;

    return (
        <motion.span
            className="truncate bg-shimmer-text bg-clip-text font-medium text-transparent"
            style={{ backgroundSize: "200% 100%" }}
            initial={{ backgroundPosition: "200% 0" }}
            animate={{ backgroundPosition: "-200% 0" }}
            transition={{ duration: 2.6, ease: "easeInOut", repeat: Infinity }}
        >
            {children}
        </motion.span>
    );
}

/**
 * ScanProgressCard — a "Finding your data" title (with the pulsing loader while scanning) over
 * Vinnie on the left and a three-row phase ticker on the right. The active phase sits in the middle row.
 */
export function ScanProgressCard({ phases, activeIndex, status = "scanning", largeActive = false, dense = false, title = "Finding your data", successOnComplete = false, fluid = false, className }: ScanProgressCardProps) {
    const reduceMotion = useReducedMotion();
    const scanning = status === "scanning";
    const animated = scanning && !reduceMotion;
    const success = successOnComplete && !scanning;
    const textBase = fluid ? "text-(length:--fluid-15)" : "text-lg";
    const textLarge = fluid ? "text-(length:--fluid-19p5)" : "text-[19.5px]";
    const active = Math.min(Math.max(activeIndex, 0), phases.length - 1);

    // Finale: the finished card shows only its closing row (the one with `detail`), centred.
    const finale = !scanning && !!phases[active]?.detail;

    // Fixed three slots so the active row stays centred; out-of-range slots are blank spacers.
    const slots = finale ? [active] : [active - 1, active, active + 1];

    return (
        <div
            role="status"
            aria-live="polite"
            className={cx(
                "relative flex flex-col rounded-lg border bg-bg-elevated p-4 shadow-scan-card transition-colors duration-slow",
                success ? "border-status-success" : "border-text-primary/10",
                dense ? "gap-1.5" : "gap-3",
                className,
            )}
        >
            {animated && <PerimeterTracer />}

            {/* items-baseline: the loader dots sit on the text baseline, reading as a trailing ellipsis. */}
            {!finale && (
                <p className={cx("m-0 flex items-baseline font-bold text-text-primary", textBase)}>
                    {title}
                    {scanning && <PulseDots animated={!reduceMotion} />}
                </p>
            )}

            <div className="flex items-center gap-4">
            {successOnComplete ? <VinnieOrSuccess success={success} /> : <ScanVinnie className="h-16 w-16" />}

            {/* Fixed height (the three default row heights): a long active label may wrap to a second
                line, which the empty spacer row absorbs, so the card never changes height. The
                finale has no title, so it is that much shorter. */}
            <ul className={cx("flex min-w-0 flex-1 flex-col justify-center", dense ? "h-20" : "h-26")}>
                {slots.map((index) => {
                    const phase = phases[index];
                    if (!phase) return <li key={`pad${index}`} aria-hidden className="min-h-0 flex-1" />;

                    const isActive = index === active;
                    const large = largeActive && isActive;
                    const isDone = !scanning || index < active;
                    const Icon = phase.icon;

                    return (
                        <motion.li
                            key={index}
                            layout={reduceMotion ? false : "position"}
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: reduceMotion ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
                            aria-hidden={!isActive}
                            className={cx(
                                "flex shrink-0 items-center gap-2",
                                large ? (dense ? "min-h-8" : "min-h-10") : dense ? "h-6" : "h-8",
                                large ? textLarge : textBase,
                            )}
                        >
                            {isActive && isDone && phase.detail ? (
                                <div className="min-w-0">
                                    <p className="m-0 font-bold leading-tight text-text-primary">{phase.label}</p>
                                    <p className={cx("m-0 font-light italic leading-tight text-text-primary", textBase)}>{phase.detail}</p>
                                </div>
                            ) : (
                                <>
                                    {isDone ? (
                                        <Check className={cx("shrink-0 text-primary", large ? "size-5" : "size-4")} aria-hidden />
                                    ) : (
                                        <Icon
                                            className={cx(
                                                "shrink-0",
                                                large ? "size-5" : "size-4",
                                                isActive ? "text-text-primary" : "text-text-primary/40",
                                            )}
                                            aria-hidden
                                        />
                                    )}
                                    {isActive && !isDone ? (
                                        <ShimmerLabel animated={!reduceMotion}>{phase.label}</ShimmerLabel>
                                    ) : (
                                        <span className={cx(large ? "leading-tight" : "truncate", "text-text-primary/40")}>{phase.label}</span>
                                    )}
                                </>
                            )}
                        </motion.li>
                    );
                })}
            </ul>
            </div>
        </div>
    );
}
