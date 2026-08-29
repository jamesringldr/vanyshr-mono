import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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

/**
 * Drawer stages, in order. These are the user-facing arc of the scan and do
 * not map 1:1 to `phase` — criteria and brokers both run inside
 * full_profile. The drawer works out which is live from each log line's
 * stage id, so these must match what the edge functions write.
 */
const DRAWER_STAGES: ProgressStage[] = [
  { id: "confirm", label: "Confirm User Search Details" },
  { id: "criteria", label: "Building Search Criteria" },
  { id: "brokers", label: "Scanning for Data Broker Exposures" },
  { id: "darkweb", label: "Hunting for Breaches on Dark Web" },
  { id: "report", label: "Finishing Up Your Risk Report" },
];

/**
 * Stage 4 is the one span the backend cannot report incrementally: holehe
 * and leakcheck run concurrently inside a single manage-emails "confirm"
 * call that returns once, so there is no intermediate state to read.
 *
 * The bar is therefore an estimate, shaped so it cannot lie in the
 * direction that matters — it approaches CEILING asymptotically and only
 * reaches 100 when the call actually returns. TAU is set against measured
 * wall time (scan_timings; leakcheck dominates at p50 36s, p90 70s, max
 * 81s), so a median run reads ~76% at the moment it completes and a slow
 * one keeps creeping rather than sitting pinned at the top.
 */
const ESTIMATE_CEILING = 95;

/**
 * Approaches CEILING but never reaches it, so an estimate can never claim
 * done before the real event lands. TAU is picked per span from measured
 * wall time (scan_timings) such that a median run reads ~76% at the moment
 * it finishes -- far enough along to feel nearly there, with headroom left
 * if it runs long.
 */
function estimatePercent(elapsedMs: number, tauMs: number): number {
  return Math.round(ESTIMATE_CEILING * (1 - Math.exp(-elapsedMs / tauMs)));
}

/** leakcheck dominates the confirm call: p50 36s, p90 70s, max 81s. */
const BREACH_TAU_MS = 22_000;

/**
 * full_profile_fetch wall time, i.e. the slowest broker since they run in
 * parallel: p50 4s, p90 14.6s, max 19.5s over 44 scans.
 */
const EXTRACTION_TAU_MS = 2_500;

/**
 * Cosmetic filler for the one long silence in stage 3.
 *
 * scrapeBrokerDetails() resolves every target as a unit, so between
 * "Extraction finished" and the stage summary there is a ~25-30s stretch
 * with real work happening and nothing to report. This cycles the field
 * types consolidation actually merges, so the drawer reads as busy rather
 * than stalled. It is deliberately not tied to the merge order -- it says
 * what is being consolidated, not that any one type is done.
 */
const CONSOLIDATION_TYPES = [
  "phone numbers",
  "street addresses",
  "email addresses",
  "relatives",
  "aliases",
  "employment history",
  "education records",
  "property records",
] as const;

/** "1m 04s" / "12s" — mirrors the backend's summary-line formatting. */
function formatElapsed(ms: number): string {
  const total = Math.round(ms / 1000);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return mins > 0 ? `${mins}m ${String(secs).padStart(2, "0")}s` : `${secs}s`;
}

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
  /**
   * Read the live phase inside async work.
   *
   * Not just sugar for `phaseRef.current`: TypeScript does not reset a
   * narrowing of `.current` across a call, so after an early
   * `if (phaseRef.current !== "pick") return` it still believes the value is
   * "pick" further down — even though go() has since reassigned it. That
   * made the mid-poll bail-outs below look like dead code to the checker
   * (and silently disabled checking through them). A call's return value
   * gets no such stale narrowing.
   */
  const currentPhase = (): Phase => phaseRef.current;

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
  const [breachElapsed, setBreachElapsed] = useState(0);
  const [breachSummary, setBreachSummary] = useState<string | null>(null);
  const [extractElapsed, setExtractElapsed] = useState(0);
  const [fillerTick, setFillerTick] = useState(0);
  const [reportElapsed, setReportElapsed] = useState<number | null>(null);
  const scanStartedAtRef = useRef<number>(Date.now());

  const candidatesRef = useRef<IdentifyCandidate[]>([]);
  const rejectedRef = useRef<IdentifyCandidate[]>([]);
  const identifyBrokerRef = useRef<IdentifyBroker>("fps");
  const [identifyBroker, setIdentifyBroker] = useState<IdentifyBroker>("fps");
  const quickScanIdRef = useRef<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
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
    // Long enough for stage 5 to close at 700ms and be read. This is the
    // only moment all five stages show green with their timings.
    const t = window.setTimeout(() => {
      navigate("/pilot-scan/report", { replace: true });
    }, prefersReducedMotion ? 900 : 2000);
    return () => window.clearTimeout(t);
  }, [phase, navigate, prefersReducedMotion]);

  // Stage 3 is mid-lull once the per-target extraction lines have landed
  // (at least one success) but the stage summary has not. Structural rather
  // than matched on copy, so editing a message cannot silently break it.
  const brokerRows = progressMessages.filter((m) => m.step === "brokers");
  const brokersOpen =
    brokerRows.length > 0 && !brokerRows.some((m) => m.status === "summary");
  // The parallel fetch is in flight: its opening line is the newest and
  // nothing has come back yet.
  const extracting =
    brokersOpen &&
    !brokerRows.some((m) => m.status === "success") &&
    brokerRows.at(-1)?.status === "active";
  const consolidating =
    brokerRows.length > 0 &&
    !brokerRows.some((m) => m.status === "summary") &&
    brokerRows.some((m) => m.status === "success") &&
    brokerRows.at(-1)?.status === "active";

  // Clock for the extraction estimate, started when the client first sees
  // the window open.
  useEffect(() => {
    if (!extracting) return;
    const startedAt = Date.now();
    setExtractElapsed(0);
    const id = window.setInterval(() => setExtractElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [extracting]);

  // Stage 3's post-extraction lull: cycle the filler on an irregular beat so
  // it reads as work rather than a spinner on a timer.
  useEffect(() => {
    if (!consolidating) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(() => {
        setFillerTick((n) => n + 1);
        schedule();
      }, 900 + Math.random() * 1500);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, [consolidating]);

  // Let stage 5 land before the navigate, so the run visibly finishes.
  useEffect(() => {
    if (phase !== "report") return;
    const t = window.setTimeout(
      () => setReportElapsed(Date.now() - scanStartedAtRef.current),
      700,
    );
    return () => window.clearTimeout(t);
  }, [phase]);

  // Ticks stage 4's estimated bar for as long as the confirm call is out.
  useEffect(() => {
    if (!isConfirming) return;
    const startedAt = Date.now();
    setBreachElapsed(0);
    const id = window.setInterval(() => setBreachElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(id);
  }, [isConfirming]);

  // The drawer's log. `searching` lines come from summary-scan, the rest
  // from full-profile-scan.
  //
  // One interval for the whole scan rather than one per phase: keying this on
  // `phase` tore the poller down and rebuilt it at every transition, and each
  // of those is a chance to drop an in-flight response. It keeps running
  // through `pick` too -- the drawer is hidden behind the modal there, but
  // the background brokers are still reporting, so the log is current the
  // moment it reopens.
  const scanSettled = phase === "report" || phase === "error" || phase === "no_results";
  useEffect(() => {
    if (!scanId || scanSettled) return;

    const pollInterval = setInterval(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-progress-messages", {
          body: { quickscanId: scanId },
        });

        if (error) {
          console.warn("Failed to fetch progress messages:", error);
          return;
        }

        // Replace, never append. The endpoint returns the whole ordered log
        // every time, so this is idempotent and self-healing: a dropped or
        // out-of-order poll costs nothing, the next one re-syncs. Tracking a
        // cursor and appending the tail is what broke this before -- once the
        // cursor advanced past a batch that did not land, those lines were
        // marked seen and could never come back, so the log truncated
        // permanently mid-scan.
        const messages: ProgressMessage[] = data?.messages ?? [];
        setProgressMessages((prev) =>
          prev.length === messages.length ? prev : messages,
        );
      } catch (err) {
        console.error("Progress polling error:", err);
      }
    }, 500); // Poll every 500ms for near-real-time updates

    return () => clearInterval(pollInterval);
  }, [scanId, scanSettled]);

  // summary-scan responds as soon as FPS resolves and keeps AnyWho/Zaba/NPD
  // in the background; full-profile-scan reports { notReady } instead of
  // guessing with an incomplete match if the pick happens first.
  // Background brokers share a 60s scrape timeout. 75s of 1s polls covers
  // that plus headroom without hanging indefinitely on a background
  // failure that somehow never lands on a terminal status.
  const FULL_PROFILE_MAX_ATTEMPTS = 75;
  const FULL_PROFILE_RETRY_DELAY_MS = 1000;

  async function handlePick(profile: QSProfileSummary) {
    if (currentPhase() !== "pick") return;
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
        if (currentPhase() !== "full_profile") return;
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

    if (currentPhase() === "full_profile") go("emails");
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
    scanStartedAtRef.current = Date.now();
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
      // The bar above is an estimate; the line it settles to is measured.
      const accounts = Number(confirmData?.services_found ?? 0);
      const emailCount = Number(confirmData?.holehe_checked ?? selected.length);
      setBreachSummary(
        `${accounts} account${accounts !== 1 ? "s" : ""} using ${emailCount} email${emailCount !== 1 ? "s" : ""} appeared in data breaches`,
      );
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

  /**
   * Stages 4 and 5 have no backend log — the breach scan is one opaque call
   * (see BREACH_TAU_MS) and the report assembles client-side. These lines
   * are synthesised rather than read back, and are never persisted. Every
   * other stage comes off the real log.
   */
  // The extraction line is a real backend row; the percentage is the only
  // synthetic part, so it rides on that row instead of a duplicate line.
  const extractingRowId = extracting ? brokerRows.at(-1)?.id : undefined;
  const loggedMessages: ProgressMessage[] = extractingRowId
    ? progressMessages.map((m) =>
        m.id === extractingRowId
          ? { ...m, percent: estimatePercent(extractElapsed, EXTRACTION_TAU_MS) }
          : m,
      )
    : progressMessages;

  const syntheticMessages: ProgressMessage[] = [];
  if (consolidating) {
    syntheticMessages.push({
      id: "brokers-consolidating",
      step: "brokers",
      status: "active",
      message: `Consolidating extracted data: ${CONSOLIDATION_TYPES[fillerTick % CONSOLIDATION_TYPES.length]}`,
      created_at: new Date().toISOString(),
    });
  }
  if (isConfirming || breachSummary) {
    syntheticMessages.push(
      breachSummary
        ? {
            id: "darkweb-summary",
            step: "darkweb",
            status: "summary",
            message: `${breachSummary} - ${formatElapsed(breachElapsed)}`,
            created_at: new Date().toISOString(),
          }
        : {
            id: "darkweb-scanning",
            step: "darkweb",
            status: "active",
            message: "Scanning millions of dark web forums and breach databases",
            percent: estimatePercent(breachElapsed, BREACH_TAU_MS),
            created_at: new Date().toISOString(),
          },
    );
  }
  if (phase === "report") {
    syntheticMessages.push(
      reportElapsed !== null
        ? {
            id: "report-ready",
            step: "report",
            status: "summary",
            message: `Risk report ready - ${formatElapsed(reportElapsed)}`,
            created_at: new Date().toISOString(),
          }
        : {
            id: "report-consolidating",
            step: "report",
            status: "active",
            message: "Consolidating Data",
            created_at: new Date().toISOString(),
          },
    );
  }
  const activeStep =
    STEPS.find((s) => statuses[s.id] === "active") ??
    STEPS.find((s) => statuses[s.id] === "pending") ??
    STEPS[STEPS.length - 1]!;
  const pickOpen = phase === "pick";
  // The drawer's own header carries stage name + latest log line for these
  // phases -- showing the eyebrow/headline block on top of it duplicated
  // the same status. Kept for error/pick/no_results, where the drawer is
  // closed and this text is the only explanation on screen.
  const drawerOpen =
    (phase === "searching" || phase === "full_profile" || phase === "emails" || phase === "report") &&
    !holdMode;

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center overflow-x-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={phase === "searching" || phase === "full_profile"}
    >
      <div
        className={cx(
          "relative z-10 flex w-full max-w-xl flex-col items-center",
          // Reserve room for the drawer's open height so the cards can
          // never end up physically behind it -- the drawer is `fixed`,
          // so it draws over whatever content shares its band on screen
          // regardless of where that content sits in the document.
          drawerOpen && "pb-[62vh]",
        )}
      >
        {/* Educational Cards - Show during scanning phases */}
        {(phase === "searching" || phase === "full_profile") && (
          <EducationalCards
            onCardClick={(cardId) => {
              // Routing not wired yet - placeholder for future navigation
              console.log(`Educational card clicked: ${cardId}`);
            }}
          />
        )}

        {!drawerOpen && (
          <div className="mb-10 mt-6 min-h-[88px] w-full text-center" aria-live="polite">
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
                      : activeStep.eyebrow}
                </p>
                <p className="mt-1 text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl">
                  {phase === "error"
                    ? errorMessage || "We couldn't finish this search"
                    : phase === "no_results"
                      ? "We didn't find a public record that looks like you"
                      : phase === "pick"
                      ? pickHeadline(identifyBroker, rejectedRef.current.length === 0)
                      : statusAction || activeStep.headline}
                </p>
              </motion.div>
            </AnimatePresence>
          </div>
        )}

        {phase === "error" && (
          <button
            type="button"
            onClick={() => go("report")}
            className="mt-8 rounded-lg bg-[#00BFFF] px-5 py-2.5 text-sm font-semibold text-white"
          >
            Continue anyway
          </button>
        )}
      </div>

      {/* Progress Drawer -- fixed to the bottom of the viewport, capped
          well under full height so it never covers the educational cards
          above it. */}
      <ProgressDrawer
        isOpen={drawerOpen}
        stages={DRAWER_STAGES}
        progressMessages={[...loggedMessages, ...syntheticMessages]}
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
