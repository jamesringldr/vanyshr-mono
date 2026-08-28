import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { InlineLoader } from "generative-loaders";
import "generative-loaders/styles.css";
import PrimaryIcon from "@vanyshr/ui/assets/PrimaryIcon-Nooutline.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import { signupPath } from "@/lib/pending-scan";
import {
  QSNoResultsModal,
  QSResultMultipleModal,
  QSResultSingleModal,
  type QSProfileSummary,
} from "@vanyshr/ui/components/application";
import type { ScanMember } from "./scan-result";
import { EmailConfirmationModal } from "./email-confirmation";
import { loadConsolidatedProfile, saveConsolidatedProfile, type ConsolidatedProfile } from "./consolidated-profile";
import { ProgressDrawer, type ProgressStage, type ProgressMessage } from "./progress-drawer";
import { EducationalCards } from "./educational-cards";

const EASE_OUT = [0.2, 0, 0, 1] as const;


/**
 * Linear scan sequence. One phase at a time. Nothing else can navigate.
 *
 *   searching (summary-scan) → pick (FPS → AnyWho → Zaba → NPD) → full_profile
 *   → emails (manage-emails) → report
 *   Empty lists / reject-all → no_results (QSNoResultsModal)
 */
export function PilotLoadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const holdParam = searchParams.get("hold");
  const holdPreview =
    holdParam === "single" || holdParam === "multiple" || holdParam === "none" ? holdParam : null;
  const holdMode = searchParams.has("hold");
  const prefersReducedMotion = useReducedMotion();

  const [phase, setPhase] = useState<Phase>(holdMode ? "searching" : "searching");
  const phaseRef = useRef<Phase>(phase);
  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }

  const [profiles, setProfiles] = useState<QSProfileSummary[]>([]);
  const [searchName, setSearchName] = useState("");
  const [region, setRegion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailCandidates, setEmailCandidates] = useState<string[]>([]);
  // The modal itself has no loading state — Confirm triggers real Holehe
  // (subprocess, several seconds) + Leakcheck (paced ~7s/email) calls with
  // nothing visible happening until they finish. Hide the modal the instant
  // Confirm is clicked so the step list underneath (already showing
  // "Finding exposed accounts" / "Scanning Dark Web" for this phase) reads
  // as progress instead of a frozen button.
  const [isConfirming, setIsConfirming] = useState(false);
  const [statusAction, setStatusAction] = useState<string>("");
  const [progressMessages, setProgressMessages] = useState<ProgressMessage[]>([]);

  const candidatesRef = useRef<IdentifyCandidate[]>([]);
  const rejectedRef = useRef<IdentifyCandidate[]>([]);
  const identifyBrokerRef = useRef<IdentifyBroker>("fps");
  const [identifyBroker, setIdentifyBroker] = useState<IdentifyBroker>("fps");
  const quickScanIdRef = useRef<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const fieldsRef = useRef<ScanFields | null>(null);
  const scanRunRef = useRef(0);
  const skipNoResultsExitRef = useRef(false);
  const lastProgressCountRef = useRef<number>(0);
  // Tip: `/pilot-scan/loading?noresults` opens the recovery modal without a scan.
  const previewNoResults = searchParams.has("noresults");

  useEffect(() => {
    if (!holdPreview) return;
    setSearchName("Luke Clark");
    setRegion("AZ");
    if (holdPreview === "single") {
      setProfiles(HOLD_PROFILES.slice(0, 1));
      go("pick");
    } else if (holdPreview === "multiple") {
      setProfiles(HOLD_PROFILES);
      go("pick");
    }
  }, [holdPreview]);

  useEffect(() => {
    if (holdMode) return;

    if (previewNoResults) {
      setSearchName("Alex Rivera");
      go("no_results");
      return;
    }

    const raw = sessionStorage.getItem("pilotScanFields");
    const quickScanId = sessionStorage.getItem("pendingScanId");
    if (!raw || !quickScanId) {
      sessionStorage.setItem("pilotScanError", "Missing scan fields");
      setErrorMessage("Missing scan fields");
      go("error");
      return;
    }

    const fields = JSON.parse(raw) as ScanFields;
    fieldsRef.current = fields;
    setSearchName(`${fields.firstName} ${fields.lastName}`.trim());
    setRegion(fields.state || "");
    beginSummaryScan(quickScanId);
  }, [holdMode, previewNoResults]);

  useEffect(() => {
    if (phase !== "report") return;
    const t = window.setTimeout(() => {
      navigate("/pilot-scan/report", { replace: true });
    }, prefersReducedMotion ? 400 : 800);
    return () => window.clearTimeout(t);
  }, [phase, navigate, prefersReducedMotion]);

  // The drawer's log. Backend writes one row per sub-step; this reads them
  // back in order. Runs across every phase the drawer is open for -- the
  // `searching` lines come from summary-scan, the rest from
  // full-profile-scan. beginSummaryScan() resets the cursor, so the count is
  // safe to use as "how many have I already appended".
  useEffect(() => {
    const scanning = phase === "searching" || phase === "full_profile" || phase === "emails";
    if (!scanId || !scanning) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-progress-messages", {
          body: { quickscanId: scanId },
        });

        if (error) {
          console.warn("Failed to fetch progress messages:", error);
          return;
        }

        const messages = data?.messages || [];
        if (messages.length > lastProgressCountRef.current) {
          setProgressMessages((prev) => [...prev, ...messages.slice(lastProgressCountRef.current)]);
          lastProgressCountRef.current = messages.length;
        }
      } catch (err) {
        console.error("Progress polling error:", err);
      }
    }, 500); // Poll every 500ms for near-real-time updates

    return () => clearInterval(pollInterval);
  }, [phase, scanId]);

  // summary-scan responds as soon as FPS resolves and keeps AnyWho/Zaba/NPD
  // in the background; full-profile-scan reports { notReady } instead of
  // guessing with an incomplete match if the pick happens first.
  // Background brokers share a 60s scrape timeout. 75s of 1s polls covers
  // that plus headroom without hanging indefinitely on a background
  // failure that somehow never lands on a terminal status.
  const FULL_PROFILE_MAX_ATTEMPTS = 75;
  const FULL_PROFILE_RETRY_DELAY_MS = 1000;

  async function handlePick(profile: QSProfileSummary) {
    if (phaseRef.current !== "pick") return;
    go("full_profile");

    const quickscanId = quickScanIdRef.current;
    if (!quickscanId) {
      setEmailCandidates([]);
      go("emails");
      return;
    }

    try {
      let data: any, error: any;
      for (let attempt = 0; attempt < FULL_PROFILE_MAX_ATTEMPTS; attempt++) {
        // Cancelled/navigated away mid-poll — the already-running loading
        // screen covers this wait, so bail rather than keep invoking.
        if (phaseRef.current !== "full_profile") return;
        ({ data, error } = await supabase.functions.invoke("full-profile-scan", {
          body: { quickscanId, fullProfileResultId: profile.id, rejected: rejectedRef.current },
        }));
        if (error || !data?.notReady) break;
        await new Promise((resolve) => setTimeout(resolve, FULL_PROFILE_RETRY_DELAY_MS));
      }

      if (error || data?.error) {
        console.warn("full-profile-scan failed:", error?.message || data?.error);
        setEmailCandidates([]);
      } else if (data?.notReady) {
        // Exhausted retries — the background match never landed on a
        // terminal status. Degrade rather than hang the loading screen
        // forever; the user still gets Zaba's own data either way.
        console.warn("full-profile-scan: background match never completed");
        setEmailCandidates([]);
      } else {
        setEmailCandidates(emailsFrom(data));
        if (data?.status_action) {
          setStatusAction(String(data.status_action));
        }
        // Report carousel (risk-summary + pre-profile) reads this back —
        // services_found/breaches aren't in it yet at this point (that's
        // manage-emails' confirm step, later); handleEmailsConfirmed()
        // below overwrites this same key once those land.
        // broker_fields' keys are the authoritative broker list — built
        // server-side from whichever brokers actually contributed data
        // (correctly omits Zaba on the fallback-pick path, unlike the old
        // brokers_scraped + hardcoded "zaba" approach this replaced).
        const brokerFields: Record<string, string[]> =
          data?.broker_fields && typeof data.broker_fields === "object" ? data.broker_fields : {};
        const brokers = Object.keys(brokerFields);
        if (data?.consolidated_profile) {
          saveConsolidatedProfile(data.consolidated_profile as ConsolidatedProfile, brokers.length, brokers, brokerFields);
        }
      }
    } catch (err) {
      console.warn("full-profile-scan error:", err);
      setEmailCandidates([]);
    }

    if (phaseRef.current === "full_profile") go("emails");
  }

  const LIST_MAX_ATTEMPTS = 75;
  const LIST_RETRY_DELAY_MS = 1000;

  async function loadIdentifyList(broker: IdentifyBroker): Promise<{ list: IdentifyCandidate[] | null; statusAction?: string }> {
    const quickscanId = quickScanIdRef.current;
    if (!quickscanId) return { list: [] };

    for (let attempt = 0; attempt < LIST_MAX_ATTEMPTS; attempt++) {
      const { data, error } = await supabase.functions.invoke("summary-scan", {
        body: { quickscanId, listBroker: broker },
      });
      if (error || data?.error) {
        console.warn("summary-scan listBroker failed:", error?.message || data?.error);
        return { list: [] };
      }
      if (data?.notReady) {
        await new Promise((resolve) => setTimeout(resolve, LIST_RETRY_DELAY_MS));
        continue;
      }
      return { list: candidatesFrom(data), statusAction: String(data?.status_action || "") };
    }
    console.warn("summary-scan listBroker: background fetch never completed");
    return { list: [] };
  }

  async function showIdentifyBroker(broker: IdentifyBroker, run = scanRunRef.current) {
    if (run !== scanRunRef.current) return;
    identifyBrokerRef.current = broker;
    setIdentifyBroker(broker);
    setProfiles([]);

    const result = await loadIdentifyList(broker);
    if (run !== scanRunRef.current) return;
    if (phaseRef.current !== "pick" && phaseRef.current !== "searching") return;

    if (result.statusAction) {
      setStatusAction(result.statusAction);
    }

    if (result.list && result.list.length > 0) {
      candidatesRef.current = result.list;
      setProfiles(result.list.map((m, i) => candidateToProfile(m, i)));
      go("pick");
      return;
    }

    const next = nextIdentifyBroker(broker);
    if (next) {
      await showIdentifyBroker(next, run);
      return;
    }

    // Never showed a card — no broker had this person. Reject-all is only
    // for the user turning down lists they actually saw.
    if (rejectedRef.current.length === 0) {
      openNoResults("empty");
      return;
    }

    openNoResults("rejected");
  }

  function dismissPick() {
    if (phaseRef.current !== "pick") return;
    rejectedRef.current = [...rejectedRef.current, ...candidatesRef.current];
    const next = nextIdentifyBroker(identifyBrokerRef.current);
    if (!next) {
      openNoResults("rejected");
      return;
    }
    void showIdentifyBroker(next);
  }

  function openNoResults(mode: "empty" | "rejected") {
    skipNoResultsExitRef.current = false;
    if (mode === "rejected") {
      const quickscanId = quickScanIdRef.current;
      if (quickscanId) {
        void supabase.functions.invoke("summary-scan", { body: { quickscanId, rejectAll: true } });
      }
    }
    go("no_results");
  }

  function beginSummaryScan(quickScanId: string) {
    const run = ++scanRunRef.current;
    quickScanIdRef.current = quickScanId;
    // Ref too, for the async handlers below. The poll effect needs it as
    // state: phase already starts at "searching", so go("searching") here is
    // a no-op re-render and an effect keyed only on phase would never see
    // the id arrive.
    setScanId(quickScanId);
    identifyBrokerRef.current = "fps";
    setIdentifyBroker("fps");
    rejectedRef.current = [];
    candidatesRef.current = [];
    setProfiles([]);
    setProgressMessages([]);
    lastProgressCountRef.current = 0;
    go("searching");

    invokeOnce(`summary-scan:${quickScanId}`, "summary-scan", { quickscanId: quickScanId })
      .then(({ data, error }) => {
        if (run !== scanRunRef.current) return;
        if (error || !data) {
          setErrorMessage(error?.message || "Search failed");
          go("error");
          return;
        }
        const list = candidatesFrom(data);
        const broker = identifyBrokerFrom(data);
        identifyBrokerRef.current = broker;
        setIdentifyBroker(broker);
        candidatesRef.current = list;
        sessionStorage.removeItem("pilotScanError");
        if (data.status_action) {
          setStatusAction(String(data.status_action));
        }
        if (data.unavailable) {
          setErrorMessage("We couldn't reach a people-search site. Try the scan again.");
          go("error");
          return;
        }
        if (list.length > 0) {
          setProfiles(list.map((m, i) => candidateToProfile(m, i)));
          go("pick");
          return;
        }
        const next = nextIdentifyBroker(broker);
        if (next) {
          void showIdentifyBroker(next, run);
          return;
        }
        openNoResults("empty");
      })
      .catch((err) => {
        if (run !== scanRunRef.current) return;
        setErrorMessage(err?.message || "Search failed");
        go("error");
      });
  }

  async function handleScanAgain(type: "first" | "last", value: string) {
    const trimmed = value.trim();
    const fields = fieldsRef.current;
    if (!trimmed || !fields) {
      navigate("/pilot-scan", { replace: true });
      return;
    }

    skipNoResultsExitRef.current = true;
    const nextFields: ScanFields = {
      ...fields,
      firstName: type === "first" ? trimmed : fields.firstName,
      lastName: type === "last" ? trimmed : fields.lastName,
    };
    fieldsRef.current = nextFields;
    setSearchName(`${nextFields.firstName} ${nextFields.lastName}`.trim());
    go("searching");

    const { data, error } = await supabase.functions.invoke("intro-scan", {
      body: nextFields,
    });
    if (error || data?.error || !data?.id) {
      setErrorMessage(error?.message || data?.error || "Could not start scan");
      go("error");
      return;
    }

    sessionStorage.setItem("pendingScanId", data.id);
    sessionStorage.setItem("pilotScanFields", JSON.stringify(nextFields));
    beginSummaryScan(String(data.id));
  }

  async function handlePhoneLookup(phone: string) {
    const quickscanId = sessionStorage.getItem("pendingScanId");
    const { data, error } = await supabase.functions.invoke("phone-lookup", {
      body: { phone, quickscanId },
    });
    if (error || !data) return { error: "fetch_failed" };
    return data;
  }

  function handleRunFullScan() {
    skipNoResultsExitRef.current = true;
    navigate(signupPath());
  }

  function handleNoResultsOpenChange(open: boolean) {
    if (open) return;
    if (skipNoResultsExitRef.current) return;
    if (phaseRef.current !== "no_results") return;
    navigate("/pilot-scan", { replace: true });
  }

  /**
   * `selected` is the subset the user chose to run through the dark-web
   * check, not the subset that is theirs. Every discovered address stays on
   * the profile and on the report; nothing is removed for being unselected.
   * Anything the user typed in is new to the scan and has to be added first.
   */
  async function handleEmailsConfirmed(selected: string[]) {
    setIsConfirming(true);

    const quickscanId = quickScanIdRef.current;
    if (!quickscanId) {
      go("report");
      return;
    }

    const discovered = new Set(emailCandidates);
    const toAdd = selected.filter((e) => !discovered.has(e));

    try {
      await Promise.all(
        toAdd.map((email) =>
          supabase.functions.invoke("manage-emails", { body: { quickscanId, action: "add", email } }),
        ),
      );
      const { data: confirmData } = await supabase.functions.invoke("manage-emails", {
        body: { quickscanId, action: "confirm", emails: selected },
      });
      // Refresh the cached profile with the now-populated services_found/
      // breaches — the pick-time copy predates email confirmation, so it
      // never had these (see handlePick above).
      if (confirmData?.status_action) {
        setStatusAction(String(confirmData.status_action));
      }
      if (confirmData?.consolidated_profile) {
        const stored = loadConsolidatedProfile().data;
        saveConsolidatedProfile(
          confirmData.consolidated_profile as ConsolidatedProfile,
          stored?.brokerCount ?? 1,
          stored?.brokers,
          stored?.brokerFields,
        );
      }
    } catch (err) {
      console.warn("manage-emails confirm error:", err);
    }

    go("report");
  }

  const statuses = stepStatuses(phase, isConfirming);
  const allDone = phase === "report";
  const activeStep =
    STEPS.find((s) => statuses[s.id] === "active") ??
    STEPS.find((s) => statuses[s.id] === "pending") ??
    STEPS[STEPS.length - 1]!;
  const pickOpen = phase === "pick";

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={phase === "searching" || phase === "full_profile"}
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        {/* Educational Cards - Show during scanning phases */}
        {(phase === "searching" || phase === "full_profile") && (
          <EducationalCards
            onCardClick={(cardId) => {
              // Routing not wired yet - placeholder for future navigation
              console.log(`Educational card clicked: ${cardId}`);
            }}
          />
        )}

        <div className="relative mb-6 flex h-[240px] w-[240px] items-center justify-center overflow-visible">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[200px] w-[200px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#00BFFF]/40 blur-[48px]"
            aria-hidden
          />
          <motion.img
            src={PrimaryIcon}
            alt=""
            className="relative z-10 h-[88px] w-[88px] object-contain"
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
              key={phase + activeStep.id + identifyBroker + statusAction}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <p className="text-base text-[#B8C4CC]">
                {phase === "error"
                  ? "Something stopped the scan"
                  : phase === "no_results"
                    ? "You're harder to find than most"
                    : phase === "pick"
                    ? "Is this you?"
                    : phase === "emails"
                      ? "Almost done..."
                      : allDone
                        ? "All set..."
                        : activeStep.eyebrow}
              </p>
              <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                {phase === "error"
                  ? errorMessage || "We couldn't finish this search"
                  : phase === "no_results"
                    ? "We didn't find a public record that looks like you"
                    : phase === "pick"
                    ? pickHeadline(identifyBroker, rejectedRef.current.length === 0)
                    : phase === "full_profile"
                      ? statusAction || "Pulling your full profiles from each site"
                      : phase === "emails"
                        ? statusAction || "Confirm the emails we found"
                        : allDone
                          ? "Your exposure report is ready to review"
                          : statusAction || activeStep.headline}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <ol className="flex w-full max-w-[280px] flex-col gap-4" aria-label="Scan progress">
          {STEPS.map((step) => {
            const status = statuses[step.id]!;
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

        {phase === "error" && (
          <button
            type="button"
            onClick={() => go("report")}
            className="mt-8 rounded-lg bg-[#00BFFF] px-5 py-2.5 text-sm font-semibold text-[#022136]"
          >
            Continue anyway
          </button>
        )}
      </div>

      {/* Progress Drawer */}
      <ProgressDrawer
        isOpen={
          (phase === "searching" || phase === "full_profile" || phase === "emails") &&
          !holdMode
        }
        stages={DRAWER_STAGES}
        progressMessages={progressMessages}
        statusAction={statusAction}
      />

      <QSResultSingleModal
        isOpen={pickOpen && profiles.length === 1 && Boolean(profiles[0])}
        onOpenChange={(open) => {
          if (!open && !holdPreview) dismissPick();
        }}
        profile={profiles[0] ?? { id: "none", fullName: searchName || "Unknown" }}
        region={region}
        onThisIsMe={holdPreview ? () => undefined : handlePick}
        onThisIsNotMe={holdPreview ? () => undefined : dismissPick}
      />
      <QSResultMultipleModal
        isOpen={pickOpen && profiles.length > 1}
        onOpenChange={(open) => {
          if (!open && !holdPreview) dismissPick();
        }}
        searchName={searchName}
        region={region}
        profiles={profiles}
        onProfileSelect={holdPreview ? () => undefined : handlePick}
        onNoneOfThese={holdPreview ? () => undefined : dismissPick}
      />
      <QSNoResultsModal
        isOpen={holdPreview === "none"}
        onOpenChange={() => undefined}
        searchName={searchName || "Luke Clark"}
      />
      <QSNoResultsModal
        isOpen={phase === "no_results"}
        onOpenChange={handleNoResultsOpenChange}
        searchName={searchName}
        onScanAgain={handleScanAgain}
        onPhoneLookup={handlePhoneLookup}
        onRunFullScan={handleRunFullScan}
      />

      {phase === "emails" ? (
        <EmailConfirmationModal
          isOpen={!isConfirming}
          key={unique(emailCandidates).join("|") || "empty"}
          initialEmails={unique(emailCandidates)}
          onConfirm={handleEmailsConfirmed}
          onCancel={() => {
            if (phaseRef.current === "emails") go("pick");
          }}
        />
      ) : null}
    </div>
  );
}
