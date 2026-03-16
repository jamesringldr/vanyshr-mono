import { useState } from "react";
import { cx } from "@/utils/cx";

export interface QuickScanErrorProps {
  onQueueWithEmail?: (email: string) => Promise<void> | void;
  onDismiss?: () => void;
  className?: string;
  isLoading?: boolean;
}

export function QuickScanError({
  onQueueWithEmail,
  onDismiss,
  className,
  isLoading = false,
}: QuickScanErrorProps) {
  const [email, setEmail] = useState("");
  const [emailSubmitted, setEmailSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Simple email validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setEmailError("Please enter a valid email");
      return;
    }

    setEmailError(null);
    setIsSubmitting(true);

    try {
      await onQueueWithEmail?.(email);
      setEmailSubmitted(true);
      setEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to queue search");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Success state
  if (emailSubmitted) {
    return (
      <div className={cx("w-full bg-[#2D3847] rounded-xl overflow-hidden", className)}>
        <div className="p-6 pt-8 flex flex-col gap-8 items-center text-center min-h-[500px] flex flex-col items-center justify-center">
          {/* Success icon/graphic */}
          <div className="flex flex-col gap-4 items-center">
            <div className="w-16 h-16 rounded-full bg-[#00D4AA]/20 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-[#00D4AA]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-2xl font-bold text-white font-ubuntu">
                Got It!
              </h2>
              <p className="text-[#B8C4CC] text-base font-ubuntu">
                We'll send results to <span className="font-bold text-white">{email}</span> once our agents are back online.
              </p>
            </div>
          </div>

          {/* Secondary content */}
          <div className="flex flex-col gap-4 items-center w-full px-6">
            <p className="text-white font-bold text-base font-ubuntu leading-[1.5]">
              See how data brokers put you at risk of identity theft, scams and spam
            </p>
            <button
              onClick={onDismiss}
              className="w-full h-[52px] bg-[#00BFFF] hover:bg-[#00D4FF] active:bg-[#0099CC] text-[#022136] active:text-white font-bold text-base rounded-xl transition-all duration-150 shadow-md active:scale-[0.98] font-ubuntu"
            >
              Learn More
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  return (
    <div className={cx("w-full bg-[#2D3847] rounded-xl overflow-hidden", className)}>
      <div className="p-6 pt-8 flex flex-col gap-8">
        {/* Heading */}
        <div className="flex flex-col gap-3 text-center">
          <h1 className="text-2xl font-bold text-white font-ubuntu tracking-tight leading-[1.2]">
            Uh-Oh!<br />Something Broke
          </h1>
        </div>

        {/* Body copy */}
        <div className="flex flex-col gap-4 text-center">
          <p className="text-[#B8C4CC] text-base font-normal font-ubuntu leading-[1.5]">
            We are actively working on fixing our search agents
          </p>
          <p className="text-white font-bold text-base font-ubuntu leading-[1.5]">
            We will queue your search and send you the results once our agents are back on-line
          </p>
        </div>

        {/* Email Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
          <div className="flex flex-col gap-2">
            <input
              id="queue-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              disabled={isSubmitting || isLoading}
              className={cx(
                "h-[52px] w-full rounded-xl border px-4 py-3 text-base bg-[#022136]/50 text-white placeholder:text-[#7A92A8] font-ubuntu outline-none transition-colors duration-150 disabled:opacity-50",
                emailError
                  ? "border-[#FF5757] focus:border-[#FF5757] focus:ring-1 focus:ring-[#FF5757]"
                  : "border-[#2A4A68] focus:border-[#00BFFF] focus:ring-1 focus:ring-[#00BFFF]"
              )}
            />
            {emailError && (
              <p className="text-[#FF5757] text-xs font-medium px-1">
                {emailError}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={!email || isSubmitting || isLoading}
            className={cx(
              "w-full h-[52px] font-bold text-base rounded-xl transition-all duration-150 shadow-md active:scale-[0.98] font-ubuntu",
              email && !isSubmitting && !isLoading
                ? "bg-[#00BFFF] hover:bg-[#00D4FF] active:bg-[#0099CC] text-[#022136] active:text-white"
                : "bg-[#4A5568] text-[#7A92A8] cursor-not-allowed"
            )}
          >
            {isSubmitting ? "Queuing..." : "Submit"}
          </button>
        </form>

        {/* Secondary CTA */}
        <div className="flex flex-col gap-2 text-center pt-2">
          <p className="text-white text-sm font-bold font-ubuntu">
            Not interested?
          </p>
          <button
            onClick={onDismiss}
            className="text-[#7A92A8] text-xs leading-relaxed hover:text-[#B8C4CC] transition-colors duration-150 font-ubuntu"
          >
            No Worries! Your search won't be queued and will be completely wiped from our database
          </button>
        </div>
      </div>
    </div>
  );
}
