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
import type { ScanMember } from "./scan-result";
import { EmailConfirmationModal } from "./email-confirmation";

const EASE_OUT = [0.2, 0, 0, 1] as const;

/**
 * generative-loaders@0.1.1 has no `vortex` yet — `orbit` is the closest
 * circular activity indicator from the published set.
 */
const ACTIVE_LOADER_VARIANT = "orbit" as const;

type Phase = "searching" | "pick" | "full_profile" | "emails" | "report" | "error";

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

/** The step list is cosmetic. It is derived from the real phase — never a timer. */
function stepIndexFor(phase: Phase): { current: number; allDone: boolean } {
  switch (phase) {
    case "searching":
      return { current: 1, allDone: false };
    case "pick":
      return { current: 1, allDone: false };
    case "full_profile":
      return { current: 3, allDone: false };
    case "emails":
      return { current: 3, allDone: false };
    case "report":
      return { current: 4, allDone: true };
    case "error":
      return { current: 1, allDone: false };
  }
}

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

type ZabaCandidate = ScanMember & { result_id: string };

function zabaCandidatesFrom(data: { zaba_candidates?: unknown } | null): ZabaCandidate[] {
  const list = Array.isArray(data?.zaba_candidates) ? data!.zaba_candidates : [];
  return list.filter((c): c is ZabaCandidate => Boolean(c && typeof c === "object" && (c as ZabaCandidate).result_id));
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

/** Zaba full_profile_results id -> the QSProfileSummary shape the picker modal renders. */
function zabaToProfile(member: ScanMember, index: number): QSProfileSummary {
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
 * Linear scan sequence. One phase at a time. Nothing else can navigate.
 *
 *   searching (summary-scan) → pick (Zaba) → full_profile (full-profile-scan)
 *   → emails (manage-emails) → report
 */
export function PilotLoadingPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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

  const zabaRef = useRef<ZabaCandidate[]>([]);
  const quickScanIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (holdMode) return;

    let cancelled = false;

    const raw = sessionStorage.getItem("pilotScanFields");
    const quickScanId = sessionStorage.getItem("pendingScanId");
    if (!raw || !quickScanId) {
      sessionStorage.setItem("pilotScanError", "Missing scan fields");
      setErrorMessage("Missing scan fields");
      go("error");
      return;
    }

    const fields = JSON.parse(raw) as ScanFields;
    setSearchName(`${fields.firstName} ${fields.lastName}`.trim());
    setRegion(fields.state || "");
    quickScanIdRef.current = quickScanId;

    invokeOnce(`summary-scan:${quickScanId}`, "summary-scan", { quickscanId: quickScanId })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          setErrorMessage(error?.message || "Search failed");
          go("error");
          return;
        }
        const zaba = zabaCandidatesFrom(data);
        zabaRef.current = zaba;
        sessionStorage.removeItem("pilotScanError");
        setProfiles(zaba.map((m, i) => zabaToProfile(m, i)));
        go(zaba.length > 0 ? "pick" : "error");
        if (zaba.length === 0) setErrorMessage("No ZabaSearch results for that name and city.");
      })
      .catch((err) => {
        if (cancelled) return;
        setErrorMessage(err?.message || "Search failed");
        go("error");
      });

    return () => {
      cancelled = true;
    };
  }, [holdMode]);

  useEffect(() => {
    if (phase !== "report") return;
    const t = window.setTimeout(() => {
      // Temporary: pre-profile is the landing spot while risk-summary isn't
      // wired to consolidated_profile yet. Risk-summary goes back in front
      // of this once it is.
      navigate("/pilot-scan/pre-profile", { replace: true });
    }, prefersReducedMotion ? 400 : 800);
    return () => window.clearTimeout(t);
  }, [phase, navigate, prefersReducedMotion]);

  // summary-scan responds as soon as Zaba resolves and keeps matching
  // FPS/NPD/AnyWho in the background; full-profile-scan reports { notReady }
  // instead of guessing with an incomplete match if the pick happens first.
  // ~20-30s covers that background pass in practice (see quickscan.
  // scan_timings) — 45 gives headroom without hanging indefinitely on a
  // background failure that somehow never lands on a terminal status.
  const FULL_PROFILE_MAX_ATTEMPTS = 45;
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
          body: { quickscanId, fullProfileResultId: profile.id },
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
        // Temporary landing spot while risk-summary isn't wired to
        // consolidated_profile yet — see pre-profile.tsx.
        const brokersScraped = Array.isArray(data?.brokers_scraped) ? data.brokers_scraped.length : 0;
        sessionStorage.setItem(
          "pilotConsolidatedProfile",
          JSON.stringify({ profile: data?.consolidated_profile ?? null, brokerCount: brokersScraped + 1 }),
        );
      }
    } catch (err) {
      console.warn("full-profile-scan error:", err);
      setEmailCandidates([]);
    }

    if (phaseRef.current === "full_profile") go("emails");
  }

  function dismissPick() {
    if (phaseRef.current !== "pick") return;
    // TODO: cross-broker fallback groups + match_outcome="rejected" — deferred,
    // no fallback UI or backend write for this path yet.
    go("report");
  }

  async function handleEmailsConfirmed(emails: string[]) {
    setIsConfirming(true);

    const quickscanId = quickScanIdRef.current;
    if (!quickscanId) {
      go("report");
      return;
    }

    const initial = new Set(emailCandidates);
    const final = new Set(emails);
    const toAdd = emails.filter((e) => !initial.has(e));
    const toRemove = [...initial].filter((e) => !final.has(e));

    try {
      await Promise.all([
        ...toAdd.map((email) =>
          supabase.functions.invoke("manage-emails", { body: { quickscanId, action: "add", email } }),
        ),
        ...toRemove.map((email) =>
          supabase.functions.invoke("manage-emails", { body: { quickscanId, action: "remove", email } }),
        ),
      ]);
      await supabase.functions.invoke("manage-emails", { body: { quickscanId, action: "confirm" } });
    } catch (err) {
      console.warn("manage-emails confirm error:", err);
    }

    go("report");
  }

  const { current, allDone } = stepIndexFor(phase);
  const activeStep = STEPS[Math.min(current, STEPS.length - 1)]!;
  const pickOpen = phase === "pick";

  return (
    <div
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-x-hidden bg-[#022136] px-6 py-12 font-ubuntu"
      role="main"
      aria-label="Scan in progress"
      aria-busy={phase === "searching" || phase === "full_profile"}
    >
      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
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
              key={phase + activeStep.id}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: EASE_OUT }}
            >
              <p className="text-base text-[#B8C4CC]">
                {phase === "error"
                  ? "Something stopped the scan"
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
                  : phase === "pick"
                    ? "Pick your ZabaSearch record"
                    : phase === "full_profile"
                      ? "Pulling your full profiles from each site"
                      : phase === "emails"
                        ? "Confirm the emails we found"
                        : allDone
                          ? "Your exposure report is ready to review"
                          : activeStep.headline}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

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

      <QSResultSingleModal
        isOpen={pickOpen && profiles.length === 1 && Boolean(profiles[0])}
        onOpenChange={(open) => {
          if (!open) dismissPick();
        }}
        profile={profiles[0] ?? { id: "none", fullName: searchName || "Unknown" }}
        region={region}
        onThisIsMe={handlePick}
        onThisIsNotMe={dismissPick}
      />
      <QSResultMultipleModal
        isOpen={pickOpen && profiles.length > 1}
        onOpenChange={(open) => {
          if (!open) dismissPick();
        }}
        searchName={searchName}
        region={region}
        profiles={profiles}
        onProfileSelect={handlePick}
        onNoneOfThese={dismissPick}
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
