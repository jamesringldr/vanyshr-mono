import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Menu, X } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { QuickScanForm } from "@vanyshr/ui/components/application";
import { Vinnie } from "@vanyshr/ui/components/foundations";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import { EASE_OUT, scanUi } from "./chrome";

const VINNIE_CYCLE = ["idle", "angry", "scared", "focused", "surprised", "idle"] as const;

const ROLL_WORDS = ["HACKERS", "SCAMMERS", "SPAMMERS"] as const;
const ROLL_MS = 2200;

function RollingThreatWord({ reducedMotion }: { reducedMotion: boolean }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reducedMotion) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % ROLL_WORDS.length);
    }, ROLL_MS);
    return () => window.clearInterval(id);
  }, [reducedMotion]);

  if (reducedMotion) {
    return <span className="text-warning">HACKERS</span>;
  }

  return (
    <span className="relative inline-grid overflow-hidden align-baseline" aria-live="polite">
      <span className="invisible col-start-1 row-start-1 font-semibold" aria-hidden>
        SCAMMERS
      </span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={ROLL_WORDS[index]}
          initial={{ y: "70%", opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: "-70%", opacity: 0 }}
          transition={{ duration: 0.34, ease: EASE_OUT }}
          className="col-start-1 row-start-1 font-semibold text-warning"
        >
          {ROLL_WORDS[index]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/**
 * Self-scan entry — /self-scan.
 *
 * Top brand bar (logo + menu), then a 60/40 split: pill + animated Vinnie
 * on top, title / CTA anchored to the bottom of the lower section.
 */
export function SelfScanEntryPage() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  async function handlePilotSubmit(fields: {
    firstName: string;
    lastName: string;
    zipCode: string;
    city: string;
    state: string;
  }) {
    sessionStorage.removeItem("pilotScanResult");
    sessionStorage.removeItem("pilotScanError");
    sessionStorage.removeItem("pilotPhase2Result");
    sessionStorage.removeItem("pilotConfirmedEmails");
    sessionStorage.removeItem("pendingScanId");

    const { data, error } = await supabase.functions.invoke("intro-scan", {
      body: {
        firstName: fields.firstName,
        lastName: fields.lastName,
        zipCode: fields.zipCode,
        city: fields.city,
        state: fields.state,
      },
    });
    if (error || data?.error || !data?.id) {
      throw new Error(error?.message || data?.error || "Could not start scan");
    }

    sessionStorage.setItem("pendingScanId", data.id);
    sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
    setIsDrawerOpen(false);
    navigate("/self-scan/splash");
  }

  return (
    <div className={scanUi.page} role="main" aria-label="Self scan">
      <header className={cx(scanUi.column, "px-6 pt-6")}>
        <div className="flex w-full items-center justify-between">
          <img src={PrimaryLogo} alt="Vanyshr" className="h-7 w-auto object-contain" />
          <button type="button" aria-label="Open menu" className={scanUi.ghostBtn}>
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </header>

      <main className={cx(scanUi.column, "min-h-0 flex-1 px-6 pb-[max(2.5rem,env(safe-area-inset-bottom))]")}>
        <div className="flex min-h-0 flex-[6] flex-col">
          <div className="mt-5 flex justify-center">
            <span
              className={cx(
                "rounded-full bg-accent-primary px-4 py-1.5 text-center text-[12px] font-semibold leading-tight text-brand-ink",
                "shadow-[0_0_10px_var(--color-accent-primary),0_0_28px_color-mix(in_srgb,var(--color-accent-primary)_50%,transparent)]",
              )}
            >
              Agentic Consumer Cyber Defense
            </span>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center" aria-hidden>
            <motion.div
              animate={prefersReducedMotion ? undefined : { y: [0, -12, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 3.4, repeat: Infinity, ease: "easeInOut" }
              }
            >
              <Vinnie
                colorway="auto"
                cycle={VINNIE_CYCLE}
                hold={1400}
                className="h-50 w-50"
              />
            </motion.div>
          </div>
        </div>

        <div className="flex min-h-0 flex-[4] flex-col justify-end pt-6">
          <div className="flex flex-col items-center text-center">
            <h1 className="text-[28px] font-semibold leading-[1.05] tracking-tight text-text-primary">
              <span className="sr-only">Vanysh from hackers, scammers, and spammers</span>
              <span aria-hidden className="inline">
                Vanysh from{" "}
                <RollingThreatWord reducedMotion={Boolean(prefersReducedMotion)} />
              </span>
            </h1>
            <p className="mt-3 max-w-[36ch] text-[15px] leading-relaxed text-text-secondary">
              Data Brokers harvest &amp; expose your data ...
            </p>
            <p className="mt-2 max-w-[36ch] text-[15px] font-bold leading-snug text-text-primary">
              We find whats exposed &amp; where then remove it...
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className={cx(scanUi.primaryBtn, "w-full text-white")}
            >
              Scan now
            </button>
            <p className="text-[13px] text-text-tertiary">No credit card · No sign up</p>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              onClick={() => setIsDrawerOpen(false)}
              className={scanUi.overlay}
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Start your scan"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.44, ease: EASE_OUT }}
              drag={prefersReducedMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.12}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsDrawerOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-[env(safe-area-inset-bottom)]"
            >
              <div className={scanUi.sheet}>
                <div className="flex h-8 w-full shrink-0 items-center justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-border-subtle" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsDrawerOpen(false)}
                  className={cx(scanUi.ghostBtn, "absolute right-3 top-2")}
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="overflow-y-auto px-1 pb-8">
                  <QuickScanForm
                    startAtPrivacy
                    onPilotSubmit={handlePilotSubmit}
                    onClose={() => setIsDrawerOpen(false)}
                    className="!bg-transparent"
                    scanLabel="SelfScan"
                    heading="Are you exposed?"
                    headingSubtext="Name and zip is enough to start"
                    firstNamePlaceholder="First Name"
                    firstNameHint={
                      <>
                        First Name <span className="text-xs italic">(legal name is best)</span>
                      </>
                    }
                    lastNamePlaceholder="Last Name"
                    autoFocusFirstName
                    submitButtonText="Run a SelfScan"
                    disclaimerLeadIn="By running a SelfScan"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
