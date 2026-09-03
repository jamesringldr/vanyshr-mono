import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Fingerprint, Globe, Search, ShieldAlert, ShieldCheck, X } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import { QuickScanForm } from "@vanyshr/ui/components/application";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

const DOT_COUNT = 3;
const ACTIVE_DOT = 0;
const DRAWER_EASE = [0.2, 0, 0, 1] as const;

/**
 * Self-scan entry — /self-scan.
 *
 * Base structural layout only, borrowed from a reference mobile design:
 * top brand bar, then the page split 60/40 — visual content (status pills +
 * hero panel with overlapping stat pills) on top, title/subtext/pagination/CTA
 * on the bottom, anchored to the bottom of its 40% section (so extra space
 * collects above the headline, not between the dots and the CTA). Copy,
 * imagery, and stats below are placeholders standing in for real scan data
 * — content and wiring get filled in as the page iterates.
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
    navigate("/pilot-scan/splash");
  }

  return (
    <div
      className="relative flex h-dvh w-full flex-col bg-brand-dark font-ubuntu"
      role="main"
      aria-label="Self scan"
    >
      <header className="flex items-center px-6 pt-6">
        <img src={PrimaryLogo} alt="Vanyshr" className="h-7 w-auto object-contain" />
      </header>

      <main className="flex flex-1 flex-col px-6 pb-10">
        {/* Visual content — top 60% */}
        <div className="flex min-h-0 flex-[6] flex-col">
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 rounded-full border border-border-subtle px-3 py-1.5 text-[13px] font-medium text-text-secondary">
              <Fingerprint className="h-3.5 w-3.5" />
              Your Digital Footprint
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-success px-3 py-1.5 text-[13px] font-semibold text-brand-dark">
              <ShieldCheck className="h-3.5 w-3.5" />
              Score: A
            </span>
          </div>

          <div className="relative mt-4 flex min-h-0 flex-1 flex-col">
            <div className="flex flex-1 items-center justify-center rounded-3xl border border-border-subtle bg-bg-surface-secondary">
              {/* Placeholder hero — swap for real scan visual / imagery */}
              <div className="flex h-20 w-20 items-center justify-center rounded-full border border-accent-primary/40 bg-brand-dark">
                <ShieldAlert className="h-8 w-8 text-accent-primary" />
              </div>
            </div>

            <div className="absolute inset-x-4 -bottom-6 flex items-center justify-between gap-2">
              {[
                { Icon: Search, label: "128 Sources" },
                { Icon: Globe, label: "40+ Brokers" },
                { Icon: ShieldAlert, label: "12 Exposures" },
              ].map(({ Icon, label }) => (
                <span
                  key={label}
                  className="flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full border border-border-subtle bg-bg-surface px-1.5 py-2 text-[11px] font-medium text-text-secondary"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-accent-primary" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Title + everything under it — bottom 40%, anchored to the bottom */}
        <div className="flex min-h-0 flex-[4] flex-col justify-end">
          <h1 className="text-[28px] font-bold leading-tight tracking-tight text-text-primary">
            See what's exposed about you today
          </h1>
          <p className="mt-3 max-w-[320px] text-[15px] leading-snug text-text-secondary">
            Live results from across the web — checked and scored before you dig in.
          </p>

          <div className="mt-4 flex items-center justify-center gap-1.5">
            {Array.from({ length: DOT_COUNT }).map((_, i) => (
              <span
                key={i}
                className={cx(
                  "h-1.5 rounded-full transition-all",
                  i === ACTIVE_DOT ? "w-4 bg-accent-primary" : "w-1.5 bg-border-subtle",
                )}
              />
            ))}
          </div>

          <div className="flex flex-col items-center gap-3 pt-8">
            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent-primary text-[17px] font-semibold text-text-primary"
            >
              Scan Now
            </button>
            <div className="flex items-center justify-center gap-3 p-[5px] text-[14px] font-medium text-text-tertiary">
              <span>- No Credit Card</span>
              <span>- No Sign Up</span>
            </div>
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
              transition={{ duration: 0.2, ease: DRAWER_EASE }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Start your scan"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={
                prefersReducedMotion ? { duration: 0 } : { duration: 0.52, ease: DRAWER_EASE }
              }
              drag={prefersReducedMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsDrawerOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            >
              <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-bg-surface shadow-[0_0_40px_rgba(20,171,254,0.35),0_0_80px_rgba(20,171,254,0.18),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                <div className="flex h-8 w-full shrink-0 items-center justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-border-subtle" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute right-4 top-3 cursor-pointer rounded-full p-1.5 text-text-tertiary transition-colors hover:text-text-primary"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="overflow-y-auto px-1 pb-10">
                  <QuickScanForm
                    startAtPrivacy
                    onPilotSubmit={handlePilotSubmit}
                    onClose={() => setIsDrawerOpen(false)}
                    className="!bg-transparent"
                    scanLabel="SelfScan"
                    heading="Are you exposed?"
                    headingSubtext="3 basic data points is all a hacker needs"
                    firstNamePlaceholder="First Name"
                    firstNameHint={
                      <>First Name <span className="text-xs italic">(legal name is best)</span></>
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
