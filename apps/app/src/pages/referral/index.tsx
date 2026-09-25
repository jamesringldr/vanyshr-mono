import { Link, useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Menu } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { Vinnie } from "@vanyshr/ui/components/foundations";
import { cx } from "@/utils/cx";
import { EASE_OUT, scanUi } from "../self-scan/chrome";
import { RollingThreatWord } from "../self-scan/rolling-threat-word";

const ROLL_WORDS = ["Hackers", "Scammers", "Spammers"] as const;

const footerLink = cx(
  "inline-flex min-h-11 items-center px-2 text-[13px] text-text-tertiary underline-offset-2",
  "transition-colors duration-150 hover:text-text-secondary hover:underline",
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-primary",
);

const VINNIE_CYCLE = [
  "idle",
  "surprised",
  "idle",
  "curious",
  "idle",
  "scared",
  "idle",
] as const;

/**
 * Referrer's name, read from the invite link's query string
 * (`?firstName=Dana&lastName=Whitfield` → "Dana W."). Falls back to a
 * neutral phrase so the page still reads if the link is stripped.
 */
function useReferrerName() {
  const [params] = useSearchParams();
  const first = params.get("firstName")?.trim();
  const last = params.get("lastName")?.trim();
  if (!first) return "A friend";
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

// ─── Page ────────────────────────────────────────────────────────────────────

/**
 * Referral landing — /referral.
 *
 * Addressed to the person *receiving* an invite, not the one sending it.
 *
 * Structure: brand bar, positioning pill, floating Vinnie hero, display
 * headline, supporting copy, stacked actions, then the legal footer.
 */
export function ReferralPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const referrer = useReferrerName();

  const rise = (delay: number) =>
    prefersReducedMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.5, ease: EASE_OUT, delay },
        };

  return (
    <div className={scanUi.page} role="main" aria-label="Refer a friend">
      <header className={cx(scanUi.column, "px-6 pt-6")}>
        <div className="flex w-full items-center justify-between">
          <img src={PrimaryLogo} alt="Vanyshr" className="h-7 w-auto object-contain" />
          <button type="button" aria-label="Open menu" className={scanUi.ghostBtn}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className={cx(scanUi.column, "min-h-0 flex-1 px-6 pb-6")}>
        <div className="mt-5 flex justify-center">
          <span className={scanUi.pill}>Agentic Consumer Cyber Defense</span>
        </div>

        {/* Hero — animated Vinnie, gently floating */}
        <motion.div
          {...(prefersReducedMotion
            ? {}
            : {
                initial: { opacity: 0, scale: 0.94 },
                animate: { opacity: 1, scale: 1 },
                transition: { duration: 0.7, ease: EASE_OUT },
              })}
          className="flex min-h-0 flex-[5] items-center justify-center"
          aria-hidden
        >
          <motion.div
            animate={prefersReducedMotion ? undefined : { y: [0, -12, 0] }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
            }
          >
            <Vinnie colorway="auto" cycle={VINNIE_CYCLE} hold={1400} className="h-40 w-40" />
          </motion.div>
        </motion.div>

        {/* Headline + actions */}
        <div className="flex flex-[4] flex-col justify-end">
          <motion.h1
            {...rise(0.08)}
            className="text-center text-[clamp(28px,7.5vw,36px)] font-semibold leading-[1.1] tracking-[-0.03em] text-text-primary"
          >
            <span className="sr-only">
              {referrer} invited you to Vanysh from hackers, scammers, and spammers
            </span>
            <span aria-hidden>
              <span className="block text-balance">
                <span className="text-accent-primary">{referrer}</span> invited you to
              </span>
              <span className="block whitespace-nowrap">
                Vanysh from{" "}
                <RollingThreatWord
                  words={ROLL_WORDS}
                  reducedMotion={Boolean(prefersReducedMotion)}
                />
              </span>
            </span>
          </motion.h1>

          <motion.p
            {...rise(0.16)}
            className="pt-5 text-center text-[15px] leading-relaxed text-text-secondary"
          >
            Protect your personal data from being exposed online &{" "}
            <em className="font-bold uppercase italic tracking-[0.03em] text-text-primary">
              take back your privacy!
            </em>
          </motion.p>

          <motion.div {...rise(0.24)} className="pt-7">
            <p className="pb-2.5 text-center text-[13px] text-text-tertiary">
              See if you’re exposed · No Credit Card or Signup Required
            </p>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => navigate("/self-scan")}
                className={cx(scanUi.primaryBtn, "w-full gap-2")}
              >
                See Your Data
                <ArrowRight className="h-4 w-4" aria-hidden />
              </button>

              <button
                type="button"
                onClick={() => navigate("/referral-v2")}
                className={cx(scanUi.secondaryBtn, "w-full")}
              >
                Learn More about Vanyshr
              </button>
            </div>
          </motion.div>
        </div>
      </main>

      <footer className={cx(scanUi.column, "px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))]")}>
        <div className="flex items-center justify-center gap-1 border-t border-border-subtle">
          <Link to="/privacy" className={footerLink}>
            Privacy Policy
          </Link>
          <span aria-hidden className="text-text-tertiary">
            ·
          </span>
          <Link to="/terms" className={footerLink}>
            Terms of Service
          </Link>
        </div>
      </footer>
    </div>
  );
}
