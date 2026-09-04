import { cx } from "@/utils/cx";

/** Shared visual language for the self-scan flow. Tokens only. */
export const EASE_OUT = [0.2, 0, 0, 1] as const;

export const scanUi = {
  page: "relative flex h-dvh w-full flex-col bg-bg-page",
  primaryBtn: cx(
    "inline-flex min-h-12 items-center justify-center rounded-lg bg-accent-primary px-5",
    "text-[16px] font-semibold text-brand-ink",
    "transition-colors duration-150",
    "hover:bg-accent-hover",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
    "disabled:cursor-not-allowed disabled:bg-disabled disabled:text-text-tertiary",
  ),
  secondaryBtn: cx(
    "inline-flex min-h-12 items-center justify-center rounded-lg border border-border-subtle bg-bg-surface px-5",
    "text-[16px] font-semibold text-text-primary",
    "transition-colors duration-150",
    "hover:bg-bg-surface-secondary",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
  ),
  ghostBtn: cx(
    "inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-text-tertiary",
    "transition-colors duration-150 hover:bg-bg-surface hover:text-text-primary",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
  ),
  chip: cx(
    "inline-flex items-center gap-1.5 rounded-full border border-border-subtle",
    "px-3 py-1.5 text-[13px] font-medium text-text-secondary",
  ),
  kicker: "text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary",
  column: "mx-auto flex w-full max-w-md flex-col",
  overlay: "fixed inset-0 z-40 bg-bg-page/80 backdrop-blur-sm",
  sheet: cx(
    "relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden",
    "rounded-t-2xl border-t border-border-subtle bg-bg-surface",
  ),
  terminal: "font-terminal lowercase tracking-tight",
  input: cx(
    "h-12 w-full rounded-lg border border-border-subtle bg-bg-page px-4",
    "text-[15px] text-text-primary placeholder:text-text-tertiary",
    "outline-none transition-colors duration-150",
    "focus:border-accent-primary focus:ring-1 focus:ring-accent-primary",
    "disabled:opacity-50",
  ),
} as const;
