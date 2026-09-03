import { motion, AnimatePresence } from "framer-motion";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import { cx } from "@/utils/cx";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import type { ProgressStage, ProgressMessage } from "../pilot-scan/progress-drawer";

export interface StatusContainerProps {
  isOpen: boolean;
  stages: ProgressStage[];
  progressMessages?: ProgressMessage[];
}

const EASE_OUT = [0.2, 0, 0, 1] as const;

/** Three dots pulsing in sequence -- the "..." after the title, and the
 * marker in front of the running phase name, are both this, not static
 * punctuation or a spinner. */
function EllipsisLoader({ size = 4, color, className }: { size?: number; color: string; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-0.5", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
          animate={{ opacity: [0.25, 1, 0.25] }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut", delay: i * 0.18 }}
        />
      ))}
    </span>
  );
}

/**
 * Self-scan's status container -- a fixed-height, always-expanded sibling
 * of pilot-scan's ProgressDrawer. No collapse/expand affordance: the header
 * is static and the content is always visible.
 *
 * Stage rows read differently from the drawer they replace:
 *  - done: one green line (dot + label). No summary line underneath anymore.
 *  - active: a plain white heading, with exactly two sub-status lines under
 *    it -- the last completed step (muted) and the current one (blue, with
 *    a loading indicator).
 *  - pending: one muted grey line (dot + label).
 */
export function StatusContainer({ isOpen, stages, progressMessages = [] }: StatusContainerProps) {
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
    return { stage, state, items, currentId };
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

  // Hidden on the phases that hand the screen to a modal (pick, no_results)
  // or navigate away (report, error).
  if (!isOpen) return null;

  return (
    // A normal flex child, last in the page's h-screen column -- not
    // `position: fixed`. Fixed height, not auto -- otherwise the card would
    // grow/shrink as stages complete and resize the page around it. 334px
    // is the worst case measured (5 stages, one active with 2 sub-lines);
    // every other state has room to spare inside it. Bordered and rounded
    // on all sides, with breathing room below -- a floating card, not a
    // sheet docked to the viewport edge.
    <div className="flex w-full shrink-0 justify-center px-4 pb-4">
      <div className="flex h-[334px] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-[#1E3A52] bg-[#112538]">
        {/* Header (static -- no toggle affordance). */}
        <div className="flex shrink-0 items-start gap-3 px-5 py-4">
          <img src={PrimaryIcon} alt="" className="h-8 w-8 shrink-0 object-contain" />

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex w-full items-center gap-2">
              <span className="flex min-w-0 items-center gap-1 truncate text-[15px] font-bold text-white">
                Running SelfScan
                <EllipsisLoader color="#ffffff" />
              </span>
              <span className="ml-auto shrink-0 text-xs font-medium text-[#7A92A8]">
                Step {currentStepIndex} of {totalSteps}
              </span>
            </div>

            {/* Currently running phase, mirrors the active stage below. */}
            {currentStage && (
              <div className="flex items-center gap-1.5">
                <EllipsisLoader size={3} color="#14ABFE" />
                <span className="truncate text-[13px] font-medium text-[#14ABFE]">
                  {currentStage.stage.label}
                </span>
              </div>
            )}

            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#14ABFE]/20">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="h-full bg-[#14ABFE]"
              />
            </div>
          </div>
        </div>

        {/* Content (always visible). Scrolls only as a fallback -- see the
            height comment above, this shouldn't normally need it. */}
        <div className="flex-1 overflow-y-auto border-t border-[#3D4A5C] px-5 py-4">
          {stageViews.map(({ stage, state, items, currentId }) => {
            if (state === "success") {
              return (
                <div key={stage.id} className="flex items-center gap-2.5 pb-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#22C55E]">
                    {stage.label}
                  </span>
                </div>
              );
            }

            if (state === "pending") {
              return (
                <div key={stage.id} className="flex items-center gap-2.5 pb-3">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[#4A5568]" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#7A92A8]">
                    {stage.label}
                  </span>
                </div>
              );
            }

            // Active -- plain heading, then the last completed sub-step
            // (muted) and the current one (blue, ripple), nothing else.
            const subItems = items.slice(-2);
            return (
              <div key={stage.id} className="pb-4">
                <div className="text-[14px] font-bold leading-tight text-white">{stage.label}</div>
                <div className="mt-2 space-y-1.5">
                  <AnimatePresence initial={false} mode="popLayout">
                    {subItems.map((item) => {
                      const isCurrent = item.id === currentId;
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.24, ease: EASE_OUT }}
                          className="flex items-center gap-2"
                        >
                          {isCurrent ? (
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                              <InlineLoader variant="ripple" size={14} />
                            </span>
                          ) : (
                            <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" aria-hidden>
                              <span className="h-1.5 w-1.5 rounded-full bg-[#4A5568]" />
                            </span>
                          )}
                          <span
                            className={cx(
                              "min-w-0 flex-1 truncate text-[12px] leading-snug",
                              isCurrent ? "text-[#14ABFE]" : "text-[#7A92A8]",
                            )}
                          >
                            {item.message}
                          </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
