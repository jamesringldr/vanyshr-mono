import { cx } from '@/utils/cx';

export interface QSProgressStepsProps {
  /** Total number of steps (e.g. 3 for scanning flow). */
  totalSteps: number;
  /** Current active step (1-based). Steps 1..activeStep are filled. */
  activeStep: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Horizontal progress step indicators for QSScanning / QSCompiling flow.
 * Vanyshr: active = #00BFFF, inactive = muted.
 */
export function QSProgressSteps({
  totalSteps,
  activeStep,
  className,
  "aria-label": ariaLabel = "Progress",
}: QSProgressStepsProps) {
  return (
    <div
      className={cx("flex gap-1.5", className)}
      role="progressbar"
      aria-valuenow={activeStep}
      aria-valuemin={1}
      aria-valuemax={totalSteps}
      aria-label={ariaLabel}
    >
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
        <span
          key={step}
          className={cx(
            "h-1 flex-1 rounded-full transition-colors",
            step <= activeStep
              ? "bg-[#00BFFF]"
              : "bg-[#D4DFE8] dark:bg-[#2A4A68]",
          )}
        />
      ))}
    </div>
  );
}
