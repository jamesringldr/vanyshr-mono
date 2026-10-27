import primaryIcon from "@/assets/brand/primary-icon.png";
import wordmark from "@/assets/brand/vanyshr-wordmark.svg";
import { cx } from "@/utils/cx";

/*
 * Horizontal lockup assembled from parts, per vanyshrdesignsys Brand/Logo/README.md:
 * wordmark ink height = icon ink height (H), gap = H/8, wordmark top 0.08H below
 * the icon top. Geometry below is the README recipe measured against these exact
 * files (icon ink 1081x1517 in a 1563 square; wordmark ink 867x239 in a 900x300
 * viewBox), expressed as % of the lockup box (width = 4.472H, height = H).
 * The wordmark is a CSS mask so it takes --color-text-primary (the README asks
 * for currentColor; the SVG bakes in a navy fallback).
 * Size it with a height class (min 24px tall); width follows from the aspect ratio.
 */
const ICON = { left: "-1.474%", top: "-1.98%", width: "23.04%" };
const WORDMARK = { left: "16.575%", top: "-2.06%", width: "84.34%" };

export function BrandLockup({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Vanyshr"
      className={cx("relative inline-block aspect-[4.472] shrink-0", className)}
    >
      <img src={primaryIcon} alt="" className="absolute max-w-none" style={ICON} />
      <span
        aria-hidden="true"
        className="absolute aspect-[3/1] bg-text-primary"
        style={{
          ...WORDMARK,
          maskImage: `url(${wordmark})`,
          WebkitMaskImage: `url(${wordmark})`,
          maskSize: "100% 100%",
          WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
        }}
      />
    </span>
  );
}
