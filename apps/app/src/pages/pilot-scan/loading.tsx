import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import {
  QSResultMultipleModal,
  QSResultSingleModal,
  type QSProfileSummary,
} from "@vanyshr/ui/components/application";
import { groupToSummary, selectGroup, type ScanResult } from "./scan-result";

const EASE_OUT = [0.2, 0, 0, 1] as const;
const STEP_MS = 2200;
const DONE_HOLD_MS = 900;

/**
 * generative-loaders@0.1.1 has no `vortex` yet — `orbit` is the closest
 * circular activity indicator from the published set.
 */
const ACTIVE_LOADER_VARIANT = "orbit" as const;

type StepStatus = "pending" | "active" | "complete";

type LoadingStep = {
  id: string;
  label: string;
  eyebrow: string;
  headline: string;
};

const STEPS: LoadingStep[] = [
  {
    id: "criteria",
    label: "Building Search Criteria",
    eyebrow: "Just a moment...",
    headline: "We're mapping how to find your data",
  },
  {
    id: "brokers",
    label: "Searching Data Brokers",
    eyebrow: "Digging in...",
    headline: "Scanning people-search sites for your info",
  },
  {
    id: "accounts",
    label: "Finding exposed accounts",
    eyebrow: "Still working...",
    headline: "Looking for accounts tied to your identity",
  },
  {
    id: "darkweb",
    label: "Scanning Dark Web",
    eyebrow: "Going deeper...",
    headline: "Checking forums and known credential leaks",
  },
  {
    id: "results",
    label: "Building your Risk Report",
    eyebrow: "Almost done...",
    headline: "Assembling your exposure into a risk report",
  },
];

function stepStatus(index: number, current: number, allDone: boolean): StepStatus {
  if (allDone || index < current) return "complete";
  if (index === current) return "active";
  return "pending";
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#22C55E]"
        aria-hidden
      >
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
    );
  }

  if (status === "active") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
        <InlineLoader
          variant={ACTIVE_LOADER_VARIANT}
          size={24}
          color="#00BFFF"
        />
      </span>
    );
  }

  return (
    <span
      className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4A5568]"
      aria-hidden
    />
  );
}

/**
 * Pilot-scan loading — step narrative while Phase 1 hits scraper-lab.
 */
export function PilotLoadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const holdMode = searchParams.has("hold");
  const prefersReducedMotion = useReducedMotion();
  const [current, setCurrent] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [scanSettled, setScanSettled] = useState(holdMode);
  const [confirmed, setConfirmed] = useState(false);
  const confirmedRef = useRef(false);
  const [picker, setPicker] = useState<"none" | "single" | "multiple" | "empty">("none");
  const [profiles, setProfiles] = useState<QSProfileSummary[]>([]);
  const [searchName, setSearchName] = useState("");
  const [region, setRegion] = useState("");
  const needsConfirm = picker === "single" || picker === "multiple";
  const criteriaUnlocked =
    confirmed || (scanSettled && !needsConfirm);

  useEffect(() => {
    if (holdMode) return;

    let cancelled = false;

    async function runScan() {
      const raw = sessionStorage.getItem("pilotScanFields");
      if (!raw) {
        sessionStorage.setItem("pilotScanError", "Missing scan fields");
        sessionStorage.removeItem("pilotScanResult");
        if (!cancelled) setScanSettled(true);
        return;
      }

      const fields = JSON.parse(raw) as {
        firstName: string;
        lastName: string;
        zipCode: string;
        city: string;
        state: string;
      };
      const sessionId =
        sessionStorage.getItem("pendingScanId") ?? crypto.randomUUID();

      const { data, error } = await supabase.functions.invoke("pilot-scan", {
        body: {
          firstName: fields.firstName,
          lastName: fields.lastName,
          last_name: fields.lastName,
          zipcode: fields.zipCode,
          zipCode: fields.zipCode,
          city: fields.city,
          state: fields.state,
          sessionId,
        },
      });

      if (cancelled) return;

      if (error || data?.error) {
        sessionStorage.setItem(
          "pilotScanError",
          error?.message || data?.error || "Scan failed",
        );
        sessionStorage.removeItem("pilotScanResult");
        setPicker("none");
      } else {
        const result = data as ScanResult;
        sessionStorage.setItem("pilotScanResult", JSON.stringify(result));
        sessionStorage.removeItem("pilotScanError");
        const groups = result.dedup_groups ?? [];
        setSearchName(
          `${fields.firstName} ${fields.lastName}`.trim() || groups[0]?.name || "",
        );
        setRegion(fields.state || "");
        setProfiles(groups.map((g, i) => groupToSummary(g, i)));
        if (groups.length === 0) setPicker("empty");
        else if (groups.length === 1) setPicker("single");
        else setPicker("multiple");
      }
      setScanSettled(true);
    }

    runScan();
    return () => {
      cancelled = true;
    };
  }, [holdMode]);

  useEffect(() => {
    if (holdMode) return;
    if (current !== 0) return;
    if (!criteriaUnlocked) return;
    setCurrent(1);
  }, [criteriaUnlocked, current, holdMode]);

  useEffect(() => {
    if (holdMode) return;
    if (current < 1) return;
    if (allDone) return;

    if (prefersReducedMotion) {
      setCurrent(STEPS.length - 1);
      setAllDone(true);
      return;
    }

    const t = window.setTimeout(() => {
      setCurrent((prev) => {
        if (prev >= STEPS.length - 1) {
          setAllDone(true);
          return prev;
        }
        return prev + 1;
      });
    }, STEP_MS);

    return () => window.clearTimeout(t);
  }, [current, allDone, prefersReducedMotion, holdMode]);

  useEffect(() => {
    if (holdMode) return;
    if (!allDone || !scanSettled) return;
    if (needsConfirm && !confirmed) return;
    const t = window.setTimeout(() => {
      navigate("/pilot-scan/risk-summary", { replace: true });
    }, prefersReducedMotion ? 800 : DONE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [
    allDone,
    scanSettled,
    needsConfirm,
    confirmed,
    holdMode,
    navigate,
    prefersReducedMotion,
  ]);

  function goToSummary() {
    navigate("/pilot-scan/risk-summary", { replace: true });
  }

  function handlePick(profile: QSProfileSummary) {
    const raw = sessionStorage.getItem("pilotScanResult");
    if (raw) {
      try {
        const result = JSON.parse(raw) as ScanResult;
        sessionStorage.setItem(
          "pilotScanResult",
          JSON.stringify(selectGroup(result, profile.id)),
        );
      } catch {
        /* keep stored result */
      }
    }
    confirmedRef.current = true;
    setConfirmed(true);
  }

  const activeStep = STEPS[Math.min(current, STEPS.length - 1)]!;

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={!allDone}
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Logo — glow lives on a sibling so the float transform cannot clip it */}
        <div className="relative mb-6 flex h-[240px] w-[240px] items-center justify-center overflow-visible">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00BFFF]/40 blur-[48px]"
            aria-hidden
          />
          <motion.img
            src={PrimaryIcon}
            alt=""
            className="relative z-10 h-[88px] w-[88px] object-contain"
            animate={
              prefersReducedMotion
                ? undefined
                : { y: [0, -14, 0] }
            }
            transition={
              prefersReducedMotion
                ? undefined
                : {
                    duration: 2.4,
                    repeat: Infinity,
                    ease: [0.45, 0, 0.55, 1],
                  }
            }
          />
        </div>

        {/* Copy — updates per step */}
        <div className="mb-10 min-h-[88px] w-full text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id + (allDone ? "-done" : "")}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <p className="text-base text-[#B8C4CC]">
                {allDone ? "All set..." : activeStep.eyebrow}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                {allDone
                  ? "Your exposure report is ready to review"
                  : activeStep.headline}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Steps */}
        <ol className="flex w-full max-w-[280px] flex-col gap-4" aria-label="Scan progress">
          {STEPS.map((step, index) => {
            const status = stepStatus(index, current, allDone);
            return (
              <li key={step.id} className="flex items-center gap-3">
                <StepIndicator status={status} />
                <span
                  className={cx(
                    "text-[15px] leading-snug transition-colors duration-200",
                    status === "pending" && "text-[#7A92A8]",
                    status === "active" && "font-medium text-white",
                    status === "complete" && "text-[#B8C4CC]",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <QSResultSingleModal
        isOpen={!confirmed && scanSettled && picker === "single" && Boolean(profiles[0])}
        onOpenChange={(open) => {
          if (!open && !confirmedRef.current) goToSummary();
        }}
        profile={profiles[0] ?? { id: "none", fullName: searchName || "Unknown" }}
        region={region}
        onThisIsMe={handlePick}
        onThisIsNotMe={goToSummary}
      />
      <QSResultMultipleModal
        isOpen={!confirmed && scanSettled && picker === "multiple"}
        onOpenChange={(open) => {
          if (!open && !confirmedRef.current) goToSummary();
        }}
        searchName={searchName}
        region={region}
        profiles={profiles}
        onProfileSelect={handlePick}
        onNoneOfThese={goToSummary}
      />
    </div>
  );
}
