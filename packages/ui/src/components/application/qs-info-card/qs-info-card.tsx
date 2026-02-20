import type { HTMLAttributes } from "react";
import { ShieldAlert } from "lucide-react";
import { cx } from '@/utils/cx';

/** Default icon path (place in public/brand/icons/ in the Vite app). */
const DEFAULT_ICON_SRC = "/brand/icons/spammer.png";

/** Default copy for QSScanning page. */
const DEFAULT_TITLE = "Prevent Spam Calls & Texts";
const DEFAULT_DESCRIPTION =
  "Predatory companies buy your exposed data from data brokers to relentlessly attempt to sell you unsolicited products or services.";

export interface QSInfoCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /**
   * Optional custom icon image source. Defaults to /brand/icons/spammer.png.
   */
  iconSrc?: string;
  /**
   * Card title. Defaults to scanning copy.
   */
  title?: string;
  /**
   * Card description. Defaults to scanning copy.
   */
  description?: string;
}

/**
 * QSInfoCard — Informational card shown while the API is pulling data (e.g. during Quick Scan search).
 * Uses Untitled UI structure and Vanyshr Design System tokens (card, typography, dark mode).
 */
export function QSInfoCard({
  className,
  iconSrc = DEFAULT_ICON_SRC,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  ...props
}: QSInfoCardProps) {
  return (
    <article
      role="region"
      aria-labelledby="qs-info-card-title"
      className={cx(
        "w-full max-w-sm rounded-xl border p-4 transition-colors",
        // Vanyshr: Container/Card (strict)
        "bg-white dark:bg-[#2A2A3F]",
        "border-[#D4DFE8] dark:border-[#2A4A68]",
        "shadow-sm",
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-4">
        {/* Icon */}
        <div className="flex shrink-0 items-center justify-center" aria-hidden>
          <img
            src={iconSrc}
            alt=""
            className="h-12 w-12 object-contain"
            onError={(e) => {
              const target = e.currentTarget;
              target.style.display = "none";
              const fallback = target.nextElementSibling;
              if (fallback) (fallback as HTMLElement).style.display = "block";
            }}
          />
          <ShieldAlert
            className="h-12 w-12 hidden text-[#B8C4CC] dark:text-[#B8C4CC]"
            aria-hidden
          />
        </div>

        {/* Text block — Inter via font-body */}
        <div className="min-w-0 flex-1 space-y-1">
          <h2
            id="qs-info-card-title"
            className="font-semibold text-[#022136] dark:text-white text-base leading-tight"
          >
            {title}
          </h2>
          <p className="text-sm text-[#B8C4CC] dark:text-[#B8C4CC] leading-snug">
            {description}
          </p>
        </div>
      </div>
    </article>
  );
}
