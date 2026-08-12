import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import {
  QSResultSingleModal,
  QSResultMultipleModal,
  QSNoResultsModal,
  type QSProfileSummary,
  type ProfileMatch,
} from "@vanyshr/ui/components/application";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";

const EASE_OUT = [0.2, 0, 0, 1] as const;
const DONE_HOLD_MS = 900;

const ACTIVE_LOADER_VARIANT = "orbit" as const;

type StepStatus = "pending" | "active" | "complete";

type LoadingStep = {
  id: string;
  label: string;
  eyebrow: string;
  headline: string;
};

/** 5 status steps — each synced to a real pipeline stage */
const STEPS: LoadingStep[] = [
  {
    id: "summary",
    label: "Searching Data Brokers",
    eyebrow: "Digging in...",
    headline: "Scanning people-search sites for your info",
  },
  {
    id: "profile",
    label: "Pulling your full profile",
    eyebrow: "Still working...",
    headline: "Gathering details from your matched records",
  },
  {
    id: "holehe",
    label: "Finding exposed accounts",
    eyebrow: "Still working...",
    headline: "Looking for accounts tied to your identity",
  },
  {
    id: "leakcheck",
    label: "Scanning Dark Web",
    eyebrow: "Going deeper...",
    headline: "Checking forums and known credential leaks",
  },
  {
    id: "results",
    label: "Organizing your results",
    eyebrow: "Almost done...",
    headline: "Pulling everything together into your report",
  },
];

type PilotFields = {
  firstName: string;
  lastName: string;
  zipCode: string;
  city: string;
  state: string;
};

type PilotDedupGroup = {
  id: string | null;
  name: string;
  age?: number;
  city: string;
  state: string;
  sources?: string[];
  confidence?: number;
  members?: Array<Record<string, unknown>>;
};

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
        <InlineLoader variant={ACTIVE_LOADER_VARIANT} size={24} color="#00BFFF" />
      </span>
    );
  }

  return (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-[#4A5568]" aria-hidden />
  );
}

function mapPilotDedupGroups(groups: PilotDedupGroup[]): ProfileMatch[] {
  return groups.map((g, i) => ({
    id: String(g.id || `pilot-group-${i}`),
    name: g.name || "",
    age: g.age != null ? String(g.age) : undefined,
    city_state: [g.city, g.state].filter(Boolean).join(", ") || undefined,
    source: (g.sources || []).join(",") || "pilot",
    match_score: g.confidence,
    fullProfile: {
      sources: g.sources || [],
      members: g.members || [],
      confidence: g.confidence,
      city: g.city,
      state: g.state,
    },
  }));
}

function mapProfile(p: ProfileMatch): QSProfileSummary {
  return {
    id: p.id,
    fullName: p.name,
    age: p.age ? parseInt(p.age, 10) : undefined,
    currentAddress: p.city_state ? [p.city_state] : undefined,
  };
}

function readFields(): PilotFields | null {
  try {
    const raw = sessionStorage.getItem("pilotScanFields");
    if (!raw) return null;
    return JSON.parse(raw) as PilotFields;
  } catch {
    return null;
  }
}

/** In-flight Phase 1 by session — survives React StrictMode remount without double-billing. */
const phase1Inflight = new Map<
  string,
  Promise<{
    success: boolean;
    quick_scan_id?: string;
    dedup_groups?: PilotDedupGroup[];
    error?: string;
  }>
>();

function invokePhase1(sessionId: string, fields: PilotFields) {
  const existing = phase1Inflight.get(sessionId);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase.functions.invoke("pilot-scan", {
      body: {
        firstName: fields.firstName,
        lastName: fields.lastName,
        zipCode: fields.zipCode,
        zipcode: fields.zipCode,
        sessionId,
      },
    });
    if (error) throw new Error(error.message || "Search failed");
    if (data?.error) throw new Error(data.error);
    if (!data?.success) throw new Error("Search failed");
    return data as {
      success: boolean;
      quick_scan_id?: string;
      dedup_groups?: PilotDedupGroup[];
      error?: string;
    };
  })();

  phase1Inflight.set(sessionId, promise);
  promise.catch(() => {
    phase1Inflight.delete(sessionId);
  });
  return promise;
}

/**
 * Pilot-scan loading — status steps synced to real pipeline:
 * 0 summary (Phase 1) → profile select → 1 profile → 2 holehe → 3 leakcheck → 4 organize → risk summary
 */
export function PilotLoadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const holdMode = searchParams.has("hold");
  const prefersReducedMotion = useReducedMotion();

  const [current, setCurrent] = useState(0);
  const [allDone, setAllDone] = useState(false);
  const [matches, setMatches] = useState<ProfileMatch[]>([]);
  const [awaitingSelection, setAwaitingSelection] = useState(false);
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showMultipleModal, setShowMultipleModal] = useState(false);
  const [showNoResultsModal, setShowNoResultsModal] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);

  const enrichmentRef = useRef({
    emails: [] as string[],
    holehe_services: [] as string[],
    leakcheck_breaches: [] as unknown[],
  });

  const sessionIdRef = useRef(
    sessionStorage.getItem("pilotSessionId") ||
      sessionStorage.getItem("pendingScanId") ||
      `pilot-${Date.now()}`,
  );

  const fields = readFields();
  const sessionId = sessionIdRef.current;

  const runEnrichStage = useCallback(
    async (
      stage: "profile" | "holehe" | "leakcheck" | "finalize",
      dedupGroupId: string,
    ) => {
      const body: Record<string, unknown> = {
        dedupGroupId,
        sessionId,
        enrichStage: stage,
        emails: enrichmentRef.current.emails,
        holehe_services: enrichmentRef.current.holehe_services,
        leakcheck_breaches: enrichmentRef.current.leakcheck_breaches,
      };

      const { data, error } = await supabase.functions.invoke("pilot-scan", { body });
      if (error) throw new Error(error.message || `${stage} failed`);
      if (data?.error) throw new Error(data.error);

      if (Array.isArray(data?.emails)) {
        enrichmentRef.current.emails = data.emails;
        sessionStorage.setItem("pilotEmails", JSON.stringify(data.emails));
      }
      if (Array.isArray(data?.holehe_services)) {
        enrichmentRef.current.holehe_services = data.holehe_services;
        sessionStorage.setItem("pilotHolehe", JSON.stringify(data.holehe_services));
      }
      if (Array.isArray(data?.leakcheck_breaches)) {
        enrichmentRef.current.leakcheck_breaches = data.leakcheck_breaches;
        sessionStorage.setItem("pilotLeakcheck", JSON.stringify(data.leakcheck_breaches));
      }
      if (data?.consolidated_profile) {
        sessionStorage.setItem(
          "pilotConsolidatedProfile",
          JSON.stringify(data.consolidated_profile),
        );
      }
      if (data?.enrichment) {
        sessionStorage.setItem("pilotEnrichment", JSON.stringify(data.enrichment));
      }

      return data;
    },
    [sessionId],
  );

  const continueAfterSelection = useCallback(
    async (dedupGroupId: string) => {
      setAwaitingSelection(false);
      setShowSingleModal(false);
      setShowMultipleModal(false);
      sessionStorage.setItem("pilotDedupGroupId", dedupGroupId);

      try {
        // Step 1 — full profile
        setCurrent(1);
        await runEnrichStage("profile", dedupGroupId);

        // Step 2 — Holehe
        setCurrent(2);
        await runEnrichStage("holehe", dedupGroupId);

        // Step 3 — LeakCheck
        setCurrent(3);
        await runEnrichStage("leakcheck", dedupGroupId);

        // Step 4 — organize / finalize
        setCurrent(4);
        await runEnrichStage("finalize", dedupGroupId);

        setAllDone(true);
      } catch (err) {
        console.error("Pilot enrichment pipeline error:", err);
        setPipelineError(err instanceof Error ? err.message : "Enrichment failed");
        // Still finish organize step so user isn't stuck
        setCurrent(4);
        setAllDone(true);
      }
    },
    [runEnrichStage],
  );

  const handleSelectProfile = useCallback(
    (profile: QSProfileSummary) => {
      const original = matches.find((m) => m.id === profile.id);
      if (!original) return;
      sessionStorage.setItem("selectedProfile", JSON.stringify(original));
      void continueAfterSelection(original.id);
    },
    [matches, continueAfterSelection],
  );

  const handleNoneOfThese = useCallback(() => {
    setShowSingleModal(false);
    setShowMultipleModal(false);
    setShowNoResultsModal(true);
  }, []);

  // Kick off Phase 1 (summary) when loader mounts — syncs to step 0.
  // Do NOT gate with a startedRef: React StrictMode remounts once and would
  // cancel the in-flight request then skip the remount start → endless spinner.
  useEffect(() => {
    if (holdMode) return;

    const scanFields = readFields();
    if (!scanFields?.firstName || !scanFields?.lastName || !scanFields?.zipCode) {
      setPipelineError("Missing scan details. Please start again.");
      return;
    }

    let cancelled = false;

    async function runPhase1() {
      setCurrent(0);
      setPipelineError(null);
      setAwaitingSelection(false);
      setShowSingleModal(false);
      setShowMultipleModal(false);
      setShowNoResultsModal(false);

      try {
        console.log("[pilot-loading] Phase 1 starting", scanFields);
        const data = await invokePhase1(sessionIdRef.current, scanFields!);

        if (cancelled) {
          console.log("[pilot-loading] Phase 1 result ignored (stale effect)");
          return;
        }

        if (data.quick_scan_id) {
          sessionStorage.setItem("pendingScanId", data.quick_scan_id);
        }

        const groups = (data.dedup_groups || []) as PilotDedupGroup[];
        sessionStorage.setItem("pilotPhase1Groups", JSON.stringify(groups));
        const profiles = mapPilotDedupGroups(groups);
        console.log("[pilot-loading] Phase 1 done", profiles.length, "groups");
        setMatches(profiles);

        // Step 0 complete — wait for "This is me" before step 1
        setAwaitingSelection(true);
        if (profiles.length === 0) {
          setShowNoResultsModal(true);
        } else if (profiles.length === 1) {
          setShowSingleModal(true);
        } else {
          setShowMultipleModal(true);
        }
      } catch (err) {
        console.error("Pilot Phase 1 error:", err);
        if (!cancelled) {
          setPipelineError(err instanceof Error ? err.message : "Search failed");
          setShowNoResultsModal(true);
          setAwaitingSelection(true);
        }
      }
    }

    void runPhase1();
    return () => {
      cancelled = true;
    };
  }, [holdMode]);

  // Navigate when pipeline finished
  useEffect(() => {
    if (holdMode || !allDone) return;
    const t = window.setTimeout(() => {
      navigate("/pilot-scan/risk-summary", { replace: true });
    }, DONE_HOLD_MS);
    return () => window.clearTimeout(t);
  }, [allDone, navigate, holdMode]);

  const activeStep = STEPS[Math.min(current, STEPS.length - 1)]!;
  const searchName = fields
    ? `${fields.firstName} ${fields.lastName}`.trim()
    : "your search";

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={!allDone && !awaitingSelection}
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <div className="relative mb-10 flex h-[168px] w-[168px] items-center justify-center">
          <motion.img
            src={PrimaryIcon}
            alt=""
            className="relative z-10 h-[88px] w-[88px] object-contain drop-shadow-[0_0_28px_rgba(0,191,255,0.45)]"
            animate={prefersReducedMotion ? undefined : { y: [0, -14, 0] }}
            transition={
              prefersReducedMotion
                ? undefined
                : { duration: 2.4, repeat: Infinity, ease: [0.45, 0, 0.55, 1] }
            }
          />
        </div>

        <div className="mb-10 min-h-[88px] w-full text-center" aria-live="polite">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep.id + (allDone ? "-done" : awaitingSelection ? "-select" : "")}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <p className="text-base text-[#B8C4CC]">
                {allDone
                  ? "All set..."
                  : awaitingSelection
                    ? "We found matches..."
                    : activeStep.eyebrow}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                {allDone
                  ? "Your exposure report is ready to review"
                  : awaitingSelection
                    ? "Confirm which record is you"
                    : activeStep.headline}
              </p>
              {pipelineError && (
                <p className="mt-3 text-sm text-red-300">{pipelineError}</p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <ol className="flex w-full max-w-[280px] flex-col gap-4" aria-label="Scan progress">
          {STEPS.map((step, index) => {
            // While waiting on selection, step 0 shows complete
            const effectiveCurrent = awaitingSelection ? 1 : current;
            const status = stepStatus(
              index,
              awaitingSelection && index === 0 ? 1 : effectiveCurrent,
              allDone,
            );
            // Force step 0 complete during selection pause
            const displayStatus =
              awaitingSelection && index === 0
                ? "complete"
                : awaitingSelection && index > 0
                  ? "pending"
                  : status;

            return (
              <li key={step.id} className="flex items-center gap-3">
                <StepIndicator status={displayStatus} />
                <span
                  className={cx(
                    "text-[15px] leading-snug transition-colors duration-200",
                    displayStatus === "pending" && "text-[#7A92A8]",
                    displayStatus === "active" && "font-medium text-white",
                    displayStatus === "complete" && "text-[#B8C4CC]",
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <QSNoResultsModal
        isOpen={showNoResultsModal}
        onOpenChange={setShowNoResultsModal}
        searchName={searchName}
        onScanAgain={(_type: "first" | "last", _value: string) => {
          setShowNoResultsModal(false);
          navigate("/pilot-scan", { replace: true });
        }}
      />

      {showSingleModal && matches[0] && (
        <QSResultSingleModal
          isOpen={showSingleModal}
          onOpenChange={setShowSingleModal}
          profile={mapProfile(matches[0])}
          region={fields?.city}
          onThisIsMe={handleSelectProfile}
          onThisIsNotMe={handleNoneOfThese}
        />
      )}

      {showMultipleModal && matches.length > 1 && (
        <QSResultMultipleModal
          isOpen={showMultipleModal}
          onOpenChange={setShowMultipleModal}
          searchName={searchName}
          region={fields?.city}
          profiles={matches.map(mapProfile)}
          onProfileSelect={handleSelectProfile}
          onNoneOfThese={handleNoneOfThese}
        />
      )}
    </div>
  );
}
