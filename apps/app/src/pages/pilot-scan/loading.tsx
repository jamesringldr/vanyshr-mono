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
import { ProgressDrawer, type ProgressStep } from "./progress-drawer";
import { EducationalCards } from "./educational-cards";

const EASE_OUT = [0.2, 0, 0, 1] as const;

/**
 * generative-loaders@0.1.1 has no `vortex` yet — `orbit` is the closest
 * circular activity indicator from the published set.
 */
const ACTIVE_LOADER_VARIANT = "orbit" as const;

type Phase = "searching" | "pick" | "full_profile" | "emails" | "report" | "error" | "no_results";

type ScanFields = {
  firstName: string;
  lastName: string;
  zipCode: string;
  city: string;
  state: string;
};

type StepStatus = "pending" | "active" | "complete";

type LoadingStep = {
  id: string;
  label: string;
  eyebrow: string;
  headline: string;
};

/** Sample cards for `?hold=single|multiple|none` so we can restyle overlays without a live scan. */
const HOLD_PROFILES: QSProfileSummary[] = [
  {
    id: "hold-1",
    fullName: "Luke Clark",
    age: 42,
    aliases: ["Lucas Clark"],
    phones: ["(602) 555-0142"],
    relatives: ["Jane Clark", "Sam Clark"],
    currentAddress: ["Waddell, AZ"],
  },
  {
    id: "hold-2",
    fullName: "Luke A Clark",
    age: 38,
    phones: ["(480) 555-0199"],
    relatives: ["Pat Clark"],
    currentAddress: ["Phoenix, AZ"],
  },
];

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

const DRAWER_STEPS: ProgressStep[] = [
  {
    id: "criteria",
    label: "Building Search Criteria",
    subtext: "Set up search parameters for your identity",
  },
  {
    id: "brokers",
    label: "Searching Data Brokers",
    subtext: "Querying FastPeopleSearch, AnyWho, Zaba, NPD...",
  },
  {
    id: "accounts",
    label: "Finding exposed accounts",
    subtext: "Checking for breaches and compromised credentials",
  },
  {
    id: "darkweb",
    label: "Scanning Dark Web",
    subtext: "Checking forums and known credential leaks",
  },
  {
    id: "results",
    label: "Building your Risk Report",
    subtext: "Assembling findings into an exposure report",
  },
];

/**
 * The step list is cosmetic. It is derived from the real phase — never a
 * timer.
 *
 *   searching     → summary-scan in flight (building/running the search)
 *   pick          → identify list ready (FPS, then AnyWho, then Zaba, then NPD).
 *                   Empty/blocked/failed on a broker is the same as reject.
 *                   Other brokers' summaries land in the background.
 *   full_profile  → full-profile-scan polling — resolve the pick against
 *                   the other brokers, then scrape matched detail pages
 *   emails        → email-selector modal up. `isConfirming` distinguishes
 *                   "still the user's turn" from "Confirm tapped — the
 *                   manage-emails 'confirm' call (which triggers holehe +
 *                   leakcheck server-side) is actually in flight," since both
 *                   share this one phase
 *   report        → confirm call returned, navigating to the report
 *   error         → search failed (blocked / unreachable), not an empty list
 *   no_results    → every identify list was empty or the user rejected them all
 */
function stepStatuses(phase: Phase, isConfirming: boolean): Record<string, StepStatus> {
  if (phase === "report") {
    return {
      criteria: "complete",
      brokers: "complete",
      accounts: "complete",
      darkweb: "complete",
      results: "active",
    };
  }
  if (phase === "error" || phase === "no_results") {
    return { criteria: "complete", brokers: "active", accounts: "pending", darkweb: "pending", results: "pending" };
  }

  const criteriaDone = phase !== "searching";
  const brokersDone = phase === "emails";
  // Holehe and leakcheck run inside one manage-emails "confirm" call, so the
  // client only ever knows "confirmed, call in flight" vs "call returned" —
  // not which of the two finished first. Shown active together rather than
  // pretending to know an order the backend doesn't report.
  const enriching = phase === "emails" && isConfirming;

  return {
    criteria: criteriaDone ? "complete" : "active",
    brokers: !criteriaDone ? "pending" : brokersDone ? "complete" : "active",
    accounts: !brokersDone ? "pending" : enriching ? "active" : "pending",
    darkweb: !brokersDone ? "pending" : enriching ? "active" : "pending",
    results: "pending",
  };
}

function getStepCompletionResult(stepId: string, phase: Phase): string | undefined {
  // Only return completion result when the step has moved past "active"
  const statuses = stepStatuses(phase, false);
  const stepStatus = statuses[stepId as keyof typeof statuses];

  if (stepStatus !== "complete") return undefined;

  // Generate appropriate completion message for each step
  switch (stepId) {
    case "criteria":
      return "Confirmed search criteria";
    case "brokers":
      return `Queried all data brokers`;
    case "accounts":
      return "Checked for exposed accounts";
    case "darkweb":
      return "Completed dark web scan";
    case "results":
      return "Report ready";
    default:
      return undefined;
  }
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

type IdentifyBroker = "fps" | "anywho" | "zaba" | "npd";
// Keep in sync with supabase/functions/_shared/quickscan/identify-order.ts
const IDENTIFY_ORDER: IdentifyBroker[] = ["fps", "anywho", "zaba", "npd"];

type IdentifyCandidate = ScanMember & { result_id: string };

function nextIdentifyBroker(current: IdentifyBroker): IdentifyBroker | null {
  const i = IDENTIFY_ORDER.indexOf(current);
  return i >= 0 ? IDENTIFY_ORDER[i + 1] ?? null : null;
}

function identifyBrokerFrom(data: { broker?: unknown } | null): IdentifyBroker {
  const raw = String(data?.broker || "").toLowerCase();
  if (raw === "anywho" || raw === "zaba" || raw === "npd") return raw;
  return "fps";
}

function pickHeadline(broker: IdentifyBroker, isFirstShown: boolean): string {
  if (isFirstShown) return "Pick the person that is you";
  if (nextIdentifyBroker(broker) === null) return "Last list — any of these?";
  return "Not on that list — any of these?";
}

function candidatesFrom(data: { candidates?: unknown; zaba_candidates?: unknown } | null): IdentifyCandidate[] {
  const raw = Array.isArray(data?.candidates) && data!.candidates!.length
    ? data!.candidates
    : Array.isArray(data?.zaba_candidates)
      ? data!.zaba_candidates
      : [];
  return raw.filter((c): c is IdentifyCandidate => Boolean(c && typeof c === "object" && (c as IdentifyCandidate).result_id));
}

function splitList(raw?: string): string[] {
  if (!raw || typeof raw !== "string") return [];
  return raw.split(/[,;|]|(?:\s+and\s+)/i).map((s) => s.trim()).filter((s) => s.length > 1);
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out;
}

/** Stored candidate row id -> the QSProfileSummary shape the picker modal renders. */
function candidateToProfile(member: ScanMember, index: number): QSProfileSummary {
  const ageRaw = member.age;
  const age = typeof ageRaw === "number" ? ageRaw : ageRaw ? parseInt(String(ageRaw), 10) || undefined : undefined;
  return {
    id: member.result_id || `zaba-${index}`,
    fullName: member.name || "Unknown",
    age,
    aliases: unique(splitList(member.aliases)),
    phones: unique(splitList(member.phone)),
    relatives: unique(splitList(member.relatives)),
    currentAddress: member.address ? [member.address] : [],
  };
}

function emailsFrom(data: { consolidated_profile?: { emails?: unknown } } | null): string[] {
  const raw = data?.consolidated_profile?.emails;
  const list = Array.isArray(raw) ? raw : [];
  return unique(list.filter((e): e is string => typeof e === "string" && e.includes("@")))
    .filter((e) => !/x{3,}/i.test(e));
}

/** One in-flight invoke per quickscan+function so React Strict Mode doesn't scrape twice. */
const inflight = new Map<string, Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>>();

function invokeOnce(key: string, fn: string, body: object) {
  const existing = inflight.get(key);
  if (existing) return existing;
  const pending = supabase.functions
    .invoke(fn, { body })
    .then(({ data, error }) => ({
      data: error ? null : (data as Record<string, unknown>),
      error: error ? { message: error.message } : data?.error ? { message: String(data.error) } : null,
    }));
  inflight.set(key, pending);
  return pending;
}

/**
 * Calculate progress percentage for the drawer progress bar.
 * Adds extra visual progress during active phases to show responsiveness.
 */
function getProgressPercent(phase: Phase, currentStepIndex: number, totalSteps: number): number {
  const basePercent = (currentStepIndex / totalSteps) * 100;
  // Add extra visual progress for active phases
  if (phase === "searching" || phase === "full_profile") {
    return Math.min(basePercent + 10, 95); // Cap at 95% until complete
  }
  if (phase === "emails") {
    return 80;
  }
  if (phase === "report") {
    return 100;
  }
  return basePercent;
}

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

  const candidatesRef = useRef<IdentifyCandidate[]>([]);
  const rejectedRef = useRef<IdentifyCandidate[]>([]);
  const identifyBrokerRef = useRef<IdentifyBroker>("fps");
  const [identifyBroker, setIdentifyBroker] = useState<IdentifyBroker>("fps");
  const quickScanIdRef = useRef<string | null>(null);
  const fieldsRef = useRef<ScanFields | null>(null);
  const scanRunRef = useRef(0);
  const skipNoResultsExitRef = useRef(false);
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
    identifyBrokerRef.current = "fps";
    setIdentifyBroker("fps");
    rejectedRef.current = [];
    candidatesRef.current = [];
    setProfiles([]);
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
        currentStep={activeStep.label}
        statusAction={statusAction}
        progressPercent={getProgressPercent(
          phase,
          DRAWER_STEPS.findIndex((s) => s.id === activeStep.id) + 1,
          DRAWER_STEPS.length
        )}
        currentStepIndex={DRAWER_STEPS.findIndex((s) => s.id === activeStep.id) + 1}
        totalSteps={DRAWER_STEPS.length}
        steps={DRAWER_STEPS.map((step) => ({
          ...step,
          // Inject live statusAction as "running command" for active steps
          result:
            step.id === "brokers" && (phase === "searching" || phase === "full_profile")
              ? statusAction || (phase === "searching" ? "Querying data brokers..." : "Pulling your full profiles from each site")
              : undefined,
          // Inject completion result for finished steps
          completionResult: getStepCompletionResult(step.id, phase),
        }))}
        stepStatuses={stepStatuses(phase, isConfirming)}
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
