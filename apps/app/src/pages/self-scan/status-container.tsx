import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { cx } from "@/utils/cx";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import type { ProgressStage, ProgressMessage } from "../pilot-scan/progress-drawer";
import { EASE_OUT, scanUi } from "./chrome";

export interface StatusContainerProps {
  isOpen: boolean;
  stages: ProgressStage[];
  progressMessages?: ProgressMessage[];
}

function WaveDots({ className }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  return (
    <span className={cx("inline-grid grid-cols-3 gap-0.5 text-current", className)} aria-hidden>
      {Array.from({ length: 9 }, (_, i) => (
        <motion.span
          key={i}
          className="h-1 w-1 rounded-[1px] bg-current"
          animate={prefersReducedMotion ? { opacity: 0.45 } : { opacity: [0.15, 1, 0.15] }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: 1.15,
                  repeat: Infinity,
                  ease: EASE_OUT,
                  delay: (Math.floor(i / 3) + (i % 3)) * 0.07,
                }
          }
        />
      ))}
    </span>
  );
}

/**
 * Self-scan status container — a fixed-height, always-expanded sibling of
 * pilot-scan's ProgressDrawer. Terminal-style log: header is static, body
 * is always visible. Stage rows:
 *  - done: one success line
 *  - active: heading + last completed sub-step + current sub-step
 *  - pending: one muted line
 */
export function StatusContainer({ isOpen, stages, progressMessages = [] }: StatusContainerProps) {
  const prefersReducedMotion = useReducedMotion();
  const stageViews = stages.map((stage) => {
    const rows = progressMessages.filter((m) => m.step === stage.id);
    const summary = rows.find((m) => m.status === "summary");
    const items = rows.filter((m) => m.status !== "summary");
    const state: "active" | "success" | "pending" = summary
      ? "success"
      : rows.length > 0
        ? "active"
        : "pending";
    const currentId =
      state === "active" ? items.filter((m) => (m.status ?? "active") === "active").at(-1)?.id : undefined;
    return { stage, state, items, currentId };
  });

  const activeIndex = stageViews.findIndex((v) => v.state === "active");
  const doneCount = stageViews.filter((v) => v.state === "success").length;
  const headerIndex = activeIndex >= 0 ? activeIndex : Math.max(doneCount - 1, 0);
  const currentStage = stageViews[headerIndex];
  const currentStepIndex = headerIndex + 1;
  const totalSteps = stages.length;
  const progressPercent = totalSteps
    ? ((doneCount + (activeIndex >= 0 ? 0.5 : 0)) / totalSteps) * 100
    : 0;

  if (!isOpen) return null;

  return (
    <div className="flex w-full shrink-0 justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="flex h-[334px] w-full max-w-md flex-col overflow-hidden rounded-xl border border-border-subtle bg-gray-950">
        <div className="flex shrink-0 items-start gap-3 px-4 py-3.5">
          <img src={PrimaryIcon} alt="" className="mt-0.5 h-7 w-7 shrink-0 object-contain" />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex w-full items-center gap-2">
              <span
                className={cx(
                  scanUi.terminal,
                  "flex min-w-0 items-center gap-2 truncate text-[14px] font-medium text-text-primary",
                )}
              >
                <WaveDots className="text-accent-primary" />
                running selfscan
              </span>
              <span className={cx(scanUi.kicker, "ml-auto shrink-0 normal-case tracking-normal")}>
                {currentStepIndex}/{totalSteps}
              </span>
            </div>

            {currentStage ? (
              <p className={cx(scanUi.terminal, "truncate text-[13px] text-accent-primary")}>
                {currentStage.stage.label}
              </p>
            ) : null}

            <div className="h-px w-full overflow-hidden bg-border-subtle">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.4, ease: EASE_OUT }}
                className="h-full bg-accent-primary"
              />
            </div>
          </div>
        </div>

        <div
          className="flex-1 overflow-y-auto border-t border-border-subtle px-4 py-3"
          aria-live="polite"
        >
          {stageViews.map(({ stage, state, items, currentId }) => {
            if (state === "success") {
              return (
                <div key={stage.id} className="flex items-center gap-2.5 pb-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-success" aria-hidden />
                  <span className={cx(scanUi.terminal, "min-w-0 flex-1 truncate text-[13px] text-success")}>
                    {stage.label}
                  </span>
                </div>
              );
            }

            if (state === "pending") {
              return (
                <div key={stage.id} className="flex items-center gap-2.5 pb-2.5">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-disabled" aria-hidden />
                  <span className={cx(scanUi.terminal, "min-w-0 flex-1 truncate text-[13px] text-text-tertiary")}>
                    {stage.label}
                  </span>
                </div>
              );
            }

            const subItems = items.slice(-2);
            return (
              <div key={stage.id} className="pb-3">
                <div className={cx(scanUi.terminal, "text-[13px] font-medium text-text-primary")}>
                  {stage.label}
                </div>
                <div className="mt-1.5 space-y-1 border-l border-border-subtle pl-3">
                  <AnimatePresence initial={false} mode="popLayout">
                    {subItems.map((item) => {
                      const isCurrent = item.id === currentId;
                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                          transition={{ duration: 0.22, ease: EASE_OUT }}
                          className="flex items-center gap-2"
                        >
                          <span className="flex h-3 w-3 shrink-0 items-center justify-center" aria-hidden>
                            <span
                              className={cx(
                                "h-1 w-1 rounded-full",
                                isCurrent ? "bg-accent-primary" : "bg-disabled",
                              )}
                            />
                          </span>
                          <span
                            className={cx(
                              scanUi.terminal,
                              "min-w-0 flex-1 truncate text-[12px] leading-snug",
                              isCurrent ? "text-accent-primary" : "text-text-tertiary",
                            )}
                          >
                            {item.message}
                          </span>
                          {isCurrent ? (
                            <span className="inline-block h-3 w-px bg-accent-primary animate-caret-blink" aria-hidden />
                          ) : null}
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
