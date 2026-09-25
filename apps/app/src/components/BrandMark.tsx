import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryLogoLight from "@vanyshr/ui/assets/PrimaryLogo.png";
import { cx } from "@/utils/cx";

/** Ghost + wordmark. White on dark (default), dark on `.light`. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <>
      <img src={PrimaryLogoDark} alt="Vanyshr" className={cx(className, "in-[.light]:hidden")} />
      <img src={PrimaryLogoLight} alt="Vanyshr" className={cx(className, "hidden in-[.light]:block")} />
    </>
  );
}
