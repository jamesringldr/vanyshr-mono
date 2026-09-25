import { useEffect, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cx } from "@/utils/cx";
import { Vinnie } from "../../foundations/vinnie";

export interface ScanPhase {
    label: string;
    icon: LucideIcon;
}

export interface ScanProgressCardProps {
    /** Ordered phases. The card shows the previous, active and next phase. */
    phases: readonly ScanPhase[];
    /** Zero-based index of the active phase. Controlled by the parent. */
    activeIndex: number;
    /** `scanning` runs the tracer, shimmer and pulses; `complete` settles everything static. */
    status?: "scanning" | "complete";
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
function PulseDots({ animated }: { animated: boolean }) {
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

/** Comet traveling the card border. pathLength=100 keeps the dash relative to the perimeter. */
function PerimeterTracer() {
    return (
        <svg className="pointer-events-none absolute inset-0 size-full overflow-visible" aria-hidden>
            <motion.rect
                width="100%"
                height="100%"
                style={{ rx: "var(--radius-lg)" }}
                fill="none"
                className="stroke-primary/45"
                strokeWidth={1.5}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray="20 80"
                initial={{ strokeDashoffset: 0 }}
                animate={{ strokeDashoffset: -100 }}
                transition={{ duration: 5, ease: "linear", repeat: Infinity }}
            />
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
 * ScanProgressCard — Vinnie on the left, a three-row phase ticker on the right. The active phase sits in the middle row.
 */
export function ScanProgressCard({ phases, activeIndex, status = "scanning", className }: ScanProgressCardProps) {
    const isLight = useIsLightTheme();
    const reduceMotion = useReducedMotion();
    const scanning = status === "scanning";
    const animated = scanning && !reduceMotion;
    const active = Math.min(Math.max(activeIndex, 0), phases.length - 1);

    // Fixed three slots so the active row stays centred; out-of-range slots are blank spacers.
    const slots = [active - 1, active, active + 1];

    return (
        <div
            role="status"
            aria-live="polite"
            className={cx(
                "relative flex items-center gap-4 rounded-lg border border-text-primary/10 bg-bg-elevated p-4 shadow-scan-card",
                className,
            )}
        >
            {animated && <PerimeterTracer />}

            <motion.div
                className="shrink-0"
                animate={reduceMotion ? undefined : { y: ["0%", "-8%", "0%"] }}
                transition={{ duration: 3, ease: "easeInOut", repeat: Infinity }}
            >
                <Vinnie
                    colorway={isLight ? "navy" : "primary"}
                    cycle={VINNIE_CYCLE}
                    hold={1400}
                    className="h-16 w-16 drop-shadow-lg drop-shadow-primary/40"
                    aria-hidden
                />
            </motion.div>

            <ul className="flex min-w-0 flex-1 flex-col">
                {slots.map((index) => {
                    const phase = phases[index];
                    if (!phase) return <li key={`pad${index}`} aria-hidden className="h-8" />;

                    const isActive = index === active;
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
                            className="flex h-8 items-center gap-2 text-lg"
                        >
                            {isDone ? (
                                <Check className="size-4 shrink-0 text-primary" aria-hidden />
                            ) : (
                                <Icon
                                    className={cx("size-4 shrink-0", isActive ? "text-text-primary" : "text-text-primary/40")}
                                    aria-hidden
                                />
                            )}
                            {isActive && !isDone ? (
                                <ShimmerLabel animated={!reduceMotion}>{phase.label}</ShimmerLabel>
                            ) : (
                                <span className="truncate text-text-primary/40">{phase.label}</span>
                            )}
                            {isActive && !isDone && (
                                <PulseDots animated={!reduceMotion} />
                            )}
                        </motion.li>
                    );
                })}
            </ul>
        </div>
    );
}
