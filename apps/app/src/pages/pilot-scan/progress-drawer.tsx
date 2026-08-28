import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import { cx } from "@/utils/cx";

export type StepStatus = "pending" | "active" | "complete";

export interface ProgressStep {
  id: string;
  label: string;
  subtext: string;
  result?: string;
}

export interface ProgressDrawerProps {
  isOpen: boolean;
  currentStep: string;
  statusAction: string;
  progressPercent: number;
  currentStepIndex: number;
  totalSteps: number;
  steps: ProgressStep[];
  stepStatuses: Record<string, StepStatus>;
  onToggle?: () => void;
}

const EASE_OUT = [0.2, 0, 0, 1] as const;

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <InlineLoader variant="orbit" size={20} color="#00BFFF" />
      </div>
    );
  }

  return (
    <div className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4A5568]" />
  );
}

function TimelineStepIndicator({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </div>
    );
  }

  if (status === "active") {
    return (
      <div className="flex h-6 w-6 shrink-0 items-center justify-center">
        <InlineLoader variant="orbit" size={18} color="#00BFFF" />
      </div>
    );
  }

  return (
    <div className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4A5568]" />
  );
}

export function ProgressDrawer({
  isOpen,
  currentStep,
  statusAction,
  progressPercent,
  currentStepIndex,
  totalSteps,
  steps,
  stepStatuses,
  onToggle,
}: ProgressDrawerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            onClick={handleToggle}
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[4px]"
            aria-hidden
          />
        )}
      </AnimatePresence>

      {/* Drawer */}
      <motion.div
        layout
        initial={false}
        animate={{
          maxHeight: isExpanded ? "90vh" : "120px",
        }}
        transition={{ duration: 0.32, ease: EASE_OUT }}
        className="fixed bottom-0 left-0 right-0 z-40 flex flex-col border-t border-[#2A4A68] bg-[#1A2E42] rounded-t-2xl"
      >
        {/* Header (Always Visible) */}
        <button
          onClick={handleToggle}
          className={cx(
            "flex flex-1 items-center gap-4 px-6 py-4",
            "transition-all duration-200 hover:bg-[#1F3654] active:bg-[#0B3B52]",
            "cursor-pointer select-none focus:outline-none focus:ring-2 focus:ring-[#00BFFF] focus:ring-inset"
          )}
          aria-expanded={isExpanded}
          aria-label="Toggle scan progress details"
        >
          {/* Left Content */}
          <div className="flex flex-1 flex-col gap-1.5 min-w-0">
            {/* Title: Current Step */}
            <div className="flex items-center gap-2.5">
              <InlineLoader variant="orbit" size={16} color="#00BFFF" />
              <span className="truncate text-[15px] font-bold text-white">
                {currentStep}
              </span>
            </div>

            {/* Subtitle: Progress Status */}
            <div className="text-[13px] leading-snug text-[#7A92A8]">
              <span>Progress: {currentStepIndex} of {totalSteps}</span>
              {statusAction && (
                <span className="ml-2 text-[#00BFFF]">
                  • {statusAction.match(/\d+/)?.[0] || "0"} sites found
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="flex items-center gap-3 pt-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#00BFFF]/20">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="h-full bg-[#00BFFF]"
                />
              </div>
              <span className="text-[12px] font-medium text-[#7A92A8] min-w-fit">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </div>

          {/* Chevron */}
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.28, ease: EASE_OUT }}
            className="flex h-5 w-5 shrink-0 items-center justify-center text-[#00BFFF] text-sm"
          >
            ▼
          </motion.div>
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
              className="flex-1 overflow-y-auto border-t border-[#2A4A68] px-6 py-4 -webkit-overflow-scrolling-touch"
            >
              <div className="space-y-3">
                {steps.map((step, index) => {
                  const status = stepStatuses[step.id];
                  const isActive = status === "active";
                  const isComplete = status === "complete";

                  return (
                    <div
                      key={step.id}
                      className={cx(
                        "flex gap-3 pb-3",
                        index !== steps.length - 1 && "border-b border-[#2A4A68]"
                      )}
                    >
                      <TimelineStepIndicator status={status} />

                      <div className="flex flex-1 flex-col gap-1 min-w-0 pt-0.5">
                        <div
                          className={cx(
                            "text-[14px] font-semibold leading-tight",
                            isComplete || isActive
                              ? "text-white"
                              : "text-[#B8C4CC]"
                          )}
                        >
                          {step.label}
                        </div>

                        <div className="text-[13px] leading-snug text-[#7A92A8]">
                          {step.subtext}
                        </div>

                        {isActive && step.result && (
                          <div className="mt-2 text-[13px] font-semibold text-[#00BFFF]">
                            ✓ {step.result}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
}
