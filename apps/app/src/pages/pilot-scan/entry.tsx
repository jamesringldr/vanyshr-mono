import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import { QuickScanForm } from "@vanyshr/ui/components/application";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import { VanishingPiiField } from "./vanishing-pii-field";

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
const REVEAL_EASE = [0.2, 0, 0, 1] as const;
/** Ghost rise duration — drawer starts near the end so he feels like he's lifting it. */
const GHOST_LIFT_MS = 1850;
const DRAWER_DELAY_MS = 1480;

/**
 * Pilot-scan entry — /pilot-scan.
 * Intro: PII artifacts vanish into the ghost beat, then the scan drawer
 * auto-opens. Optional `?id=` still hydrates invite sessionStorage.
 * `?skipIntro` jumps to the ghost beat (useful while iterating).
 */
export function PilotEntryPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const prefersReducedMotion = useReducedMotion();
  const scanIdParam = searchParams.get("id");
  const skipIntro = searchParams.has("skipIntro");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [introDone, setIntroDone] = useState(skipIntro);
  const [heroVisible, setHeroVisible] = useState(skipIntro);
  const [ghostLift, setGhostLift] = useState(false);
  const handleVanishStart = useCallback(() => setHeroVisible(true), []);
  const handleIntroComplete = useCallback(() => {
    setHeroVisible(true);
    setIntroDone(true);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) {
      setHeroVisible(true);
      setIntroDone(true);
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!introDone) return;
    if (prefersReducedMotion) {
      setGhostLift(true);
      setIsDrawerOpen(true);
      return;
    }
    setGhostLift(true);
    const t = window.setTimeout(() => setIsDrawerOpen(true), DRAWER_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [introDone, prefersReducedMotion]);

  useEffect(() => {
    if (!scanIdParam) return;

    let cancelled = false;

    async function loadInviteScan() {
      const { data, error } = await supabase.rpc("get_invite_scan", {
        p_scan_id: scanIdParam,
      });

      if (cancelled) return;

      const result = data as InviteScanResponse | null;

      if (error || !result?.success) {
        return;
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
    }

    loadInviteScan();

    return () => {
      cancelled = true;
    };
  }, [scanIdParam]);

  function handlePilotSubmit(fields: {
    firstName: string;
    lastName: string;
    zipCode: string;
    city: string;
    state: string;
  }) {
    sessionStorage.setItem("pilotScanFields", JSON.stringify(fields));
    setIsDrawerOpen(false);
    navigate("/pilot-scan/splash");
  }

  const showIntro = !introDone && !prefersReducedMotion;

  return (
    <>
      <div
        className={cx(
          "relative min-h-dvh w-full overflow-hidden font-ubuntu transition-colors duration-200",
          "bg-[#F0F4F8] dark:bg-[#022136]",
        )}
        role="main"
        aria-label="Pilot scan invitation"
      >
        <AnimatePresence>
          {showIntro && (
            <motion.div
              key="pii-intro"
              className="absolute inset-0 z-20"
              exit={{ opacity: 0 }}
              transition={{ duration: 0.32, ease: REVEAL_EASE }}
            >
              <VanishingPiiField
                onVanishStart={handleVanishStart}
                onComplete={handleIntroComplete}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          type="button"
          className="absolute inset-0 z-10 flex min-h-dvh w-full flex-col items-center overflow-hidden bg-transparent text-center"
          initial={prefersReducedMotion || skipIntro ? false : { opacity: 0 }}
          animate={{ opacity: heroVisible ? 1 : 0 }}
          transition={{ duration: 0.7, ease: REVEAL_EASE }}
          onClick={() => introDone && setIsDrawerOpen(true)}
          aria-label="Open scan"
        >
          <h1 className="relative z-10 mt-[18vh] px-8 text-[32px] font-bold leading-[1.15] tracking-tight text-white sm:text-[36px]">
            It&apos;s time to Vanysh
            <br />
            from the scammers
            <br />
            &amp; spammers
          </h1>
          <motion.img
            src={PrimaryIcon}
            alt=""
            className="pointer-events-none absolute left-1/2 w-[78%] max-w-[340px] select-none object-contain"
            style={{ top: "36%" }}
            initial={false}
            animate={{
              x: "-50%",
              y: prefersReducedMotion || ghostLift ? "0vh" : "46vh",
              scale: prefersReducedMotion || ghostLift ? 1 : 1.06,
              opacity: heroVisible ? 1 : 0,
            }}
            transition={{
              y: {
                duration: prefersReducedMotion ? 0 : GHOST_LIFT_MS / 1000,
                ease: REVEAL_EASE,
              },
              scale: {
                duration: prefersReducedMotion ? 0 : GHOST_LIFT_MS / 1000,
                ease: REVEAL_EASE,
              },
              opacity: { duration: 0.7, ease: REVEAL_EASE },
            }}
          />
        </motion.button>
      </div>

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
                  : { duration: 0.52, ease: DRAWER_EASE }
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
                    onPilotSubmit={handlePilotSubmit}
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
