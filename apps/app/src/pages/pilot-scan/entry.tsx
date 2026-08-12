import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PrimaryLogo from "@vanyshr/ui/assets/PrimaryLogo.png";
import PrimaryLogoDark from "@vanyshr/ui/assets/PrimaryLogo-DarkMode.png";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { QuickScanForm, type ProfileMatch } from "@vanyshr/ui/components/application";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

function formatName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

type InviteScanResponse = {
  success: boolean;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  email?: string;
  scan_id?: string;
  profile_id?: string;
  error?: string;
};

const DRAWER_EASE = [0.2, 0, 0, 1] as const;

/**
 * Pilot-scan entry — /pilot-scan (invite-style landing).
 * "See My Data" opens the form drawer; Scan Now goes to splash immediately,
 * then the status loader runs Phase 1 → profile select → staged enrichment → risk summary.
 * Optional `?id=` still hydrates welcome name from invite RPC.
 */
export function PilotEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const scanIdParam = searchParams.get("id");
  const [firstName, setFirstName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(scanIdParam));
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!scanIdParam) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadInviteScan() {
      setIsLoading(true);
      const { data, error } = await supabase.rpc("get_invite_scan", {
        p_scan_id: scanIdParam,
      });

      if (cancelled) return;

      const result = data as InviteScanResponse | null;

      if (error || !result?.success) {
        setFirstName(null);
        setIsLoading(false);
        return;
      }

      if (result.first_name) {
        setFirstName(formatName(result.first_name));
      }
      const resolvedScanId = result.scan_id ?? scanIdParam;
      if (resolvedScanId) {
        sessionStorage.setItem("pendingScanId", resolvedScanId);
      }
      if (result.profile_id) {
        sessionStorage.setItem("pendingProfileId", result.profile_id);
      }
      if (result.email) {
        sessionStorage.setItem("invitePrefillEmail", result.email);
      } else {
        sessionStorage.removeItem("invitePrefillEmail");
      }

      setIsLoading(false);
    }

    loadInviteScan();

    return () => {
      cancelled = true;
    };
  }, [scanIdParam]);

  const handlePilotSubmit = useCallback(
    (fields: {
      firstName: string;
      lastName: string;
      zipCode: string;
      city: string;
      state: string;
    }) => {
      const sessionId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `pilot-${Date.now()}`;
      sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
      sessionStorage.setItem("searchParams", JSON.stringify(fields));
      sessionStorage.setItem("pilotSessionId", sessionId);
      sessionStorage.removeItem("pilotDedupGroupId");
      sessionStorage.removeItem("pilotPhase1Groups");
      sessionStorage.removeItem("pilotEmails");
      sessionStorage.removeItem("pilotHolehe");
      sessionStorage.removeItem("pilotLeakcheck");
      sessionStorage.removeItem("pilotConsolidatedProfile");
      sessionStorage.removeItem("pilotEnrichment");
      setIsDrawerOpen(false);
      navigate("/pilot-scan/splash");
    },
    [navigate],
  );

  const handleSelectProfile = useCallback(
    (
      profile: ProfileMatch,
      fields: {
        firstName: string;
        lastName: string;
        zipCode: string;
        city: string;
        state: string;
      },
      scanId: string | null,
    ) => {
      // Legacy/fallback — primary pilot path uses onPilotSubmit → splash → loading
      sessionStorage.setItem("selectedProfile", JSON.stringify(profile));
      sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
      sessionStorage.setItem("searchParams", JSON.stringify(fields));
      if (scanId) {
        sessionStorage.setItem("pendingScanId", scanId);
      }
      setIsDrawerOpen(false);
      navigate("/pilot-scan/splash");
    },
    [navigate],
  );

  const handleTotalFailure = useCallback(
    (
      fields: {
        firstName: string;
        lastName: string;
        zipCode: string;
        city: string;
        state: string;
      },
      originalScanId: string | null,
    ) => {
      sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
      navigate("/quickscan-error", {
        state: { searchParams: fields, originalScanId },
      });
    },
    [navigate],
  );

  return (
    <>
      <motion.div
        className={cx(
          "min-h-screen w-full font-sans transition-colors duration-200",
          "bg-[#F0F4F8] dark:bg-[#022136]",
        )}
        role="main"
        aria-label="Pilot scan invitation"
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={prefersReducedMotion ? undefined : { opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        <motion.div
          className="mx-auto flex w-full max-w-md flex-col items-center px-6 pb-12 pt-10 text-center"
          initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
          animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.05 }}
        >
          <div className="flex justify-center">
            <img
              src={PrimaryLogo}
              alt="Vanyshr"
              className="h-10 w-auto dark:hidden sm:h-11"
            />
            <img
              src={PrimaryLogoDark}
              alt="Vanyshr"
              className="hidden h-10 w-auto dark:block sm:h-11"
            />
          </div>

          <span
            className={cx(
              "mt-5 inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium",
              "bg-[#00BFFF]/10 border border-[#00BFFF]/30 text-[#00BFFF]",
            )}
          >
            AI-Powered Data Privacy
          </span>

          {isLoading ? (
            <p className="mt-4 text-sm text-[var(--text-muted)] dark:text-[#7A92A8] font-ubuntu">
              Loading your invite…
            </p>
          ) : firstName ? (
            <p className="mt-4 text-xl font-semibold text-[#022136] dark:text-white font-ubuntu">
              Welcome {firstName}
            </p>
          ) : null}

          <div className="mt-8 flex justify-center" aria-hidden>
            <motion.img
              src={PrimaryIconOutline}
              alt=""
              className="h-36 w-36 object-contain sm:h-40 sm:w-40"
              animate={prefersReducedMotion ? undefined : { y: [0, -10, 0] }}
              transition={
                prefersReducedMotion
                  ? undefined
                  : { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
              }
            />
          </div>

          <h1 className="mt-8 text-3xl font-bold tracking-tight text-[#022136] dark:text-white sm:text-4xl font-ubuntu leading-tight">
            You&apos;ve Been Invited to Vanyshr!
          </h1>

          <p className="mt-4 text-base text-[var(--text-muted)] dark:text-[#B8C4CC] font-ubuntu leading-relaxed">
            See what private info is exposed and how to start Vanyshing!
          </p>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            disabled={isLoading}
            className={cx(
              "mt-8 flex h-[52px] w-full max-w-sm items-center justify-center rounded-xl text-sm font-semibold text-white outline-none transition",
              "bg-[#00BFFF] hover:bg-[#0E9AE8]",
              "focus-visible:ring-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#022136]",
              isLoading && "cursor-not-allowed opacity-50 hover:bg-[#00BFFF]",
            )}
          >
            See My Data
          </button>

          <p className="mt-5 text-sm font-light italic text-[#00BFFF]">
            No Credit Card Required
          </p>

          <p className="mt-6 max-w-sm text-xs leading-relaxed text-[#7A92A8]">
            The data we show is pulled from public sources. Your data is not saved,
            stored, sold, or used to spam you.
          </p>
        </motion.div>
      </motion.div>

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
                prefersReducedMotion
                  ? { duration: 0 }
                  : { duration: 0.38, ease: DRAWER_EASE }
              }
              drag={prefersReducedMotion ? false : "y"}
              dragConstraints={{ top: 0 }}
              dragElastic={0.2}
              onDragEnd={(_, info) => {
                if (info.offset.y > 150) setIsDrawerOpen(false);
              }}
              className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
            >
              <div className="relative flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-[32px] bg-[#2D3847] shadow-[0_0_40px_rgba(0,191,255,0.35),0_0_80px_rgba(0,191,255,0.18),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
                <div className="flex h-8 w-full shrink-0 items-center justify-center">
                  <div className="h-1.5 w-12 rounded-full bg-[#2A4A68]" />
                </div>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setIsDrawerOpen(false)}
                  className="absolute right-4 top-3 cursor-pointer rounded-full p-1.5 text-[#7A92A8] transition-colors hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
                <div className="overflow-y-auto px-1 pb-10">
                  <QuickScanForm
                    startAtPrivacy
                    searchMode="pilot"
                    supabaseClient={supabase}
                    onPilotSubmit={handlePilotSubmit}
                    onProfileSelect={handleSelectProfile}
                    onTotalFailure={handleTotalFailure}
                    onPhoneLookup={async (phone: string) => {
                      const { data, error } = await supabase.functions.invoke(
                        "phone-lookup",
                        { body: { phone } },
                      );
                      if (error) return { error: "fetch_failed" };
                      return data;
                    }}
                    onClose={() => setIsDrawerOpen(false)}
                    className="!bg-transparent"
                  />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
