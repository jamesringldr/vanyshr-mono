import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import { cx } from "@/utils/cx";

export type StepStatus = "pending" | "active" | "complete";

/** Written by the edge functions; see logProgress in consolidation.ts. */
export type LogStatus = "active" | "success" | "failed" | "summary";

export interface ProgressMessage {
  id: string;
  message: string;
  /** Stage id this line belongs to. */
  step?: string;
  status?: LogStatus;
  created_at: string;
  /**
   * Client-side completion estimate, 0-100. Only set on synthesised lines
   * for work the backend cannot report incrementally -- never persisted.
   */
  percent?: number;
}

/** A stage heading in the drawer. Order here is display order. */
export interface ProgressStage {
  id: string;
  label: string;
}

export interface ProgressDrawerProps {
  isOpen: boolean;
  stages: ProgressStage[];
  progressMessages?: ProgressMessage[];
  /** Shown in the header until the first log line lands. */
  statusAction?: string;
  onToggle?: () => void;
}

const EASE_OUT = [0.2, 0, 0, 1] as const;

const DOT = {
  success: "bg-[#22C55E]",
  failed: "bg-[#F97066]",
  pending: "bg-[#4A5568]",
} as const;

const TEXT = {
  active: "text-[#00BFFF]",
  success: "text-[#22C55E]",
  failed: "text-[#F97066]",
} as const;

/**
 * One indicator for both rows -- a ripple while in flight, a coloured dot
 * once settled. `box` keeps every state the same footprint so the labels
 * beside them stay on a common left edge.
 */
function Indicator({
  state,
  box,
  dot,
  ripple,
}: {
  state: "active" | "success" | "failed" | "pending";
  box: string;
  dot: string;
  ripple: number;
}) {
  return (
    <span className={cx("flex shrink-0 items-center justify-center", box)} aria-hidden>
      {state === "active" ? (
        <InlineLoader variant="ripple" size={ripple} />
      ) : (
        <span className={cx("rounded-full", dot, DOT[state])} />
      )}
    </span>
  );
}

export function ProgressDrawer({
  isOpen,
  stages,
  progressMessages = [],
  statusAction = "",
  onToggle,
}: ProgressDrawerProps) {
  // Open by default: the log is the point of the drawer, and a scan runs long
  // enough that starting collapsed hides it behind a tap most people never make.
  const [isExpanded, setIsExpanded] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  // The log only ever appends, so pin the view to the newest line.
  useEffect(() => {
    if (!isExpanded) return;
    logEndRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [progressMessages.length, isExpanded]);

  // Everything below is derived from the log rather than from `phase`.
  // Stages 2 and 3 both run inside the full_profile phase, so phase cannot
  // tell them apart -- and deriving the header and the body from one source
  // means they cannot disagree.
  const stageViews = stages.map((stage) => {
    const rows = progressMessages.filter((m) => m.step === stage.id);
    const summary = rows.find((m) => m.status === "summary");
    const items = rows.filter((m) => m.status !== "summary");
    const state: "active" | "success" | "pending" = summary
      ? "success"
      : rows.length > 0
        ? "active"
        : "pending";
    // The newest line that has not settled is what is happening now.
    const currentId =
      state === "active"
        ? items.filter((m) => (m.status ?? "active") === "active").at(-1)?.id
        : undefined;
    return { stage, state, summary, items, currentId };
  });

  const activeIndex = stageViews.findIndex((v) => v.state === "active");
  const doneCount = stageViews.filter((v) => v.state === "success").length;
  // Land on the last stage once everything has closed out.
  const headerIndex = activeIndex >= 0 ? activeIndex : Math.max(doneCount - 1, 0);
  const currentStage = stageViews[headerIndex];
  const currentStepIndex = headerIndex + 1;
  const totalSteps = stages.length;
  // A stage in flight counts as half, so the bar moves when one opens rather
  // than only when it closes.
  const progressPercent = totalSteps
    ? ((doneCount + (activeIndex >= 0 ? 0.5 : 0)) / totalSteps) * 100
    : 0;

  // Collapsed, the drawer is one line tall -- show the newest log line,
  // falling back to the phase's generic copy before the first one lands.
  const latestMessage = progressMessages.at(-1)?.message ?? statusAction;

  // Closed on the phases that hand the screen to a modal (pick, no_results)
  // or navigate away (report, error). Hooks above run unconditionally.
  if (!isOpen) return null;

  return (
    /* Docked in-flow, not a fixed overlay -- it sits below whatever the
        page put above it (educational cards, status text) instead of
        covering it, so both are visible and usable at the same time. */
    <div className="mt-8 flex w-full justify-center">
      <motion.div
        layout
        initial={false}
        animate={{
          // Fixed, not content-driven -- a growing log (e.g. stage 3's
          // per-broker lines) must never nudge the drawer's top edge.
          // Exactly two resting positions: open and closed. Open is
          // capped well under full height so it never crowds out
          // whatever is above it in the flow.
          height: isExpanded ? "55vh" : "120px",
        }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#2A4A68] bg-[#2D3847]"
      >
        {/* Header (Always Visible). The whole row is the hit target -- the
            badge is the affordance, not a nested button. */}
        <button
          onClick={handleToggle}
          className={cx(
            "flex shrink-0 flex-col gap-1.5 px-5 py-4",
            "transition-all duration-200 hover:bg-[#354254] active:bg-[#0B3B52]",
            "cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-inset"
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Hide scan progress details" : "Show scan progress details"}
        >
          {/* Stage row: step name and the toggle badge */}
          <div className="flex w-full items-center gap-2.5">
            <InlineLoader variant="orbit" size={16} color="#00BFFF" />
            <span className="truncate text-[15px] font-bold text-white">
              {currentStage?.stage.label ?? ""}
            </span>
            <span
              className={cx(
                "ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full",
                "border border-[#2A4A68] bg-[#022136] px-3 py-1",
                "text-xs font-medium text-[#00BFFF]"
              )}
            >
              {isExpanded ? "Hide" : "Details"}
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              )}
            </span>
          </div>

          {/* Latest line off the backend log */}
          {latestMessage && (
            <div className="w-full truncate text-left font-mono text-[12px] text-[#00BFFF]/80">
              {latestMessage}
            </div>
          )}

          {/* Progress Bar */}
          <div className="flex w-full items-center gap-3 pt-1">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#00BFFF]/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full bg-[#00BFFF]"
              />
            </div>
            <span className="min-w-fit text-[12px] font-medium text-[#7A92A8]">
              Step {currentStepIndex} of {totalSteps}
            </span>
          </div>
        </button>

        {/* Content (Hidden Until Expanded) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              ref={contentRef}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: EASE_OUT, delay: 0.04 }}
              className="flex-1 overflow-y-auto border-t border-[#3D4A5C] px-5 py-4 -webkit-overflow-scrolling-touch"
            >
              {stageViews.map(({ stage, state, summary, items, currentId }) => (
                <div key={stage.id} className="flex gap-3">
                  <Indicator
                    state={state}
                    box="mt-0.5 h-5 w-5"
                    dot="h-3 w-3"
                    ripple={20}
                  />

                  <div className="min-w-0 flex-1 pb-4">
                    <div className="text-[14px] font-bold leading-tight text-white">
                      {stage.label}
                    </div>

                    {/* A finished stage collapses to its one-line summary. */}
                    {summary && (
                      <div className="mt-1.5 font-mono text-[12px] leading-snug text-[#22C55E]">
                        {summary.message}
                      </div>
                    )}

                    {/* A running stage shows its log, windowed to the 3
                        newest lines -- as a 4th arrives, the oldest of the
                        3 fades and slides up off the top, rolodex-style,
                        rather than the list growing without bound (that
                        growth was what pushed the drawer's own position
                        around). Stages that have not started show nothing
                        -- just the grey dot. */}
                    {!summary && items.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <AnimatePresence initial={false} mode="popLayout">
                          {items.slice(-3).map((item) => {
                            const itemState =
                              item.id === currentId
                                ? "active"
                                : item.status === "failed"
                                  ? "failed"
                                  : "success";
                            return (
                              <motion.div
                                key={item.id}
                                layout
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.24, ease: EASE_OUT }}
                                className="flex items-start gap-2.5"
                              >
                                <Indicator
                                  state={itemState}
                                  box="mt-1 h-3.5 w-3.5"
                                  dot="h-2 w-2"
                                  ripple={14}
                                />
                                <span
                                  className={cx(
                                    "min-w-0 flex-1 font-mono text-[12px] leading-snug",
                                    TEXT[itemState],
                                  )}
                                >
                                  {item.message}
                                </span>
                                {item.percent !== undefined && (
                                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-[#00BFFF]">
                                    {item.percent}%
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={logEndRef} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
