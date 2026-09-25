import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { Dialog, DialogButton } from "konsta/react";
import {
  Binoculars,
  FileText,
  FileX,
  Fingerprint,
  Ghost,
  Radar,
  Receipt,
  ScanEye,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  QSNoResultsModal,
  QSResultMultipleModal,
  QSResultSingleModal,
  type QSProfileSummary,
} from "@vanyshr/ui/components/application";
import { ScanLoadingView, type ScanSlide } from "@/components/ScanLoadingView";
import { supabase } from "@/lib/supabase";
import { signupPath } from "@/lib/pending-scan";
import { EmailConfirmationModal } from "./pilot-scan/email-confirmation";
import {
  loadConsolidatedProfile,
  saveConsolidatedProfile,
  type ConsolidatedProfile,
} from "./pilot-scan/consolidated-profile";
import {
  candidatesFrom,
  candidateToProfile,
  emailsFrom,
  identifyBrokerFrom,
  invokeOnce,
  nextIdentifyBroker,
  unique,
  type IdentifyBroker,
  type IdentifyCandidate,
} from "./self-scan/loading";

/**
 * /find-my-data/loading — runs the live scan behind ScanLoadingView.
 *
 * Same sequence as self-scan/loading: summary-scan → pick (FPS → AnyWho → Zaba → NPD)
 * → full-profile-scan → email selection → manage-emails confirm → report.
 *
 * Preview flags: ?preview runs the old timer instead of a scan (add ?complete for the
 * settled state); ?fast advances slides every 4s; ?empty passes no slides.
 */

const PHASES = [
  { label: "Sweeping broker sites", icon: Radar },
  { label: "Matching listings to you", icon: Fingerprint },
  { label: "Checking the dark web", icon: ShieldAlert },
  { label: "Building your report", icon: FileText },
] as const;

const SCAN_SLIDES: ScanSlide[] = [
  { icon: ShieldCheck, headline: "Secure", sub: "Serious protection, minus the complexity." },
  { icon: Radar, headline: "Scan", sub: "We scan 1000s of brokers & dark web forums to find your data." },
  {
    icon: ScanEye,
    headline: "Show",
    sub: "We show you your real data and exactly where it's listed — totally free",
    note: "(Not just teased behind a paywall)",
  },
  { icon: FileX, headline: "Shred", sub: "Our agents are deployed to shred the profiles they built on you." },
  { icon: Ghost, headline: "Stuff", sub: "We stuff their files with synthetic data they can't trust." },
  {
    icon: Binoculars,
    headline: "Scout",
    sub: "We continuously scout out any new data that pops up and our agents automatically remove it.",
  },
  {
    icon: Receipt,
    headline: "Supervise",
    sub: "Every removal status and progress is backed by a receipt so you can supervise our work.",
  },
];

const PREVIEW_PHASE_MS = 2500;
const REPORT_PATH = "/find-my-data/report";
const ENTRY_PATH = "/find-my-data";

// Background brokers share a 60s scrape timeout; 75 × 1s covers it with headroom.
const MAX_ATTEMPTS = 75;
const RETRY_DELAY_MS = 1000;

type Phase = "searching" | "pick" | "full_profile" | "emails" | "report" | "error" | "no_results";

type ScanFields = {
  firstName: string;
  lastName: string;
  zipCode: string;
  city: string;
  state: string;
};

function cardIndex(phase: Phase, isConfirming: boolean): number {
  if (phase === "searching") return 0;
  if (phase === "report") return 3;
  if (phase === "emails" && isConfirming) return 2;
  return 1;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function FindMyDataLoadingPage() {
  const [searchParams] = useSearchParams();
  const slides = searchParams.has("empty") ? [] : SCAN_SLIDES;
  const autoAdvanceMs = searchParams.has("fast") ? 4000 : undefined;

  if (searchParams.has("preview")) {
    return (
      <PreviewScan slides={slides} autoAdvanceMs={autoAdvanceMs} complete={searchParams.has("complete")} />
    );
  }
  return <LiveScan slides={slides} autoAdvanceMs={autoAdvanceMs} />;
}

type ViewProps = { slides: ScanSlide[]; autoAdvanceMs?: number };

function PreviewScan({ slides, autoAdvanceMs, complete }: ViewProps & { complete: boolean }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setActiveIndex((prev) => (prev + 1) % PHASES.length), PREVIEW_PHASE_MS);
    return () => window.clearInterval(id);
  }, []);

  return (
    <ScanLoadingView
      slides={slides}
      autoAdvanceMs={autoAdvanceMs}
      phases={PHASES}
      activeIndex={activeIndex}
      status={complete ? "complete" : "scanning"}
    />
  );
}

function LiveScan({ slides, autoAdvanceMs }: ViewProps) {
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("searching");
  const phaseRef = useRef<Phase>("searching");
  function go(next: Phase) {
    phaseRef.current = next;
    setPhase(next);
  }
  // A call, not `phaseRef.current` inline: TS keeps a stale narrowing of `.current` across awaits.
  const currentPhase = (): Phase => phaseRef.current;

  const [profiles, setProfiles] = useState<QSProfileSummary[]>([]);
  const [searchName, setSearchName] = useState("");
  const [region, setRegion] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailCandidates, setEmailCandidates] = useState<string[]>([]);
  const [isConfirming, setIsConfirming] = useState(false);

  const quickScanIdRef = useRef<string | null>(null);
  const fieldsRef = useRef<ScanFields | null>(null);
  const candidatesRef = useRef<IdentifyCandidate[]>([]);
  const rejectedRef = useRef<IdentifyCandidate[]>([]);
  const identifyBrokerRef = useRef<IdentifyBroker>("fps");
  const scanRunRef = useRef(0);
  const skipNoResultsExitRef = useRef(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("pilotScanFields");
    const quickScanId = sessionStorage.getItem("pendingScanId");
    if (!raw || !quickScanId) {
      navigate(ENTRY_PATH, { replace: true });
      return;
    }
    const fields = JSON.parse(raw) as ScanFields;
    fieldsRef.current = fields;
    setSearchName(`${fields.firstName} ${fields.lastName}`.trim());
    setRegion(fields.state || "");
    beginSummaryScan(quickScanId);
  }, []);

  function beginSummaryScan(quickScanId: string) {
    const run = ++scanRunRef.current;
    quickScanIdRef.current = quickScanId;
    identifyBrokerRef.current = "fps";
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
        if (data.unavailable) {
          setErrorMessage("We couldn't reach a people-search site. Try the scan again.");
          go("error");
          return;
        }
        const list = candidatesFrom(data);
        const broker = identifyBrokerFrom(data);
        identifyBrokerRef.current = broker;
        candidatesRef.current = list;
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

  async function loadIdentifyList(broker: IdentifyBroker): Promise<IdentifyCandidate[]> {
    const quickscanId = quickScanIdRef.current;
    if (!quickscanId) return [];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const { data, error } = await supabase.functions.invoke("summary-scan", {
        body: { quickscanId, listBroker: broker },
      });
      if (error || data?.error) {
        console.warn("summary-scan listBroker failed:", error?.message || data?.error);
        return [];
      }
      if (!data?.notReady) return candidatesFrom(data);
      await wait(RETRY_DELAY_MS);
    }
    console.warn("summary-scan listBroker: background fetch never completed");
    return [];
  }

  async function showIdentifyBroker(broker: IdentifyBroker, run = scanRunRef.current) {
    if (run !== scanRunRef.current) return;
    identifyBrokerRef.current = broker;
    setProfiles([]);

    const list = await loadIdentifyList(broker);
    if (run !== scanRunRef.current) return;
    if (currentPhase() !== "pick" && currentPhase() !== "searching") return;

    if (list.length > 0) {
      candidatesRef.current = list;
      setProfiles(list.map((m, i) => candidateToProfile(m, i)));
      go("pick");
      return;
    }

    const next = nextIdentifyBroker(broker);
    if (next) {
      await showIdentifyBroker(next, run);
      return;
    }
    openNoResults(rejectedRef.current.length === 0 ? "empty" : "rejected");
  }

  function dismissPick() {
    if (currentPhase() !== "pick") return;
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
    const quickscanId = quickScanIdRef.current;
    if (mode === "rejected" && quickscanId) {
      void supabase.functions.invoke("summary-scan", { body: { quickscanId, rejectAll: true } });
    }
    go("no_results");
  }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let data: any = null;
      let error: { message?: string } | null = null;
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        if (currentPhase() !== "full_profile") return;
        ({ data, error } = await supabase.functions.invoke("full-profile-scan", {
          body: { quickscanId, fullProfileResultId: profile.id, rejected: rejectedRef.current },
        }));
        if (error || !data?.notReady) break;
        await wait(RETRY_DELAY_MS);
      }

      if (error || data?.error || data?.notReady) {
        console.warn("full-profile-scan did not complete:", error?.message || data?.error || "notReady");
        setEmailCandidates([]);
      } else {
        setEmailCandidates(emailsFrom(data));
        const brokerFields: Record<string, string[]> =
          data?.broker_fields && typeof data.broker_fields === "object" ? data.broker_fields : {};
        const brokers = Object.keys(brokerFields);
        if (data?.consolidated_profile) {
          saveConsolidatedProfile(
            data.consolidated_profile as ConsolidatedProfile,
            brokers.length,
            brokers,
            brokerFields,
            quickscanId,
          );
        }
      }
    } catch (err) {
      console.warn("full-profile-scan error:", err);
      setEmailCandidates([]);
    }

    if (currentPhase() === "full_profile") go("emails");
  }

  /** `selected` scopes the dark-web check only; every discovered email stays on the profile. */
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
      if (confirmData?.consolidated_profile) {
        const stored = loadConsolidatedProfile().data;
        saveConsolidatedProfile(
          confirmData.consolidated_profile as ConsolidatedProfile,
          stored?.brokerCount ?? 1,
          stored?.brokers,
          stored?.brokerFields,
          stored?.quick_scan_id ?? quickscanId,
        );
      }
    } catch (err) {
      console.warn("manage-emails confirm error:", err);
    }

    go("report");
  }

  function handleSkipBreachScan() {
    if (currentPhase() === "emails") go("report");
  }

  async function handleScanAgain(type: "first" | "last", value: string) {
    const trimmed = value.trim();
    const fields = fieldsRef.current;
    if (!trimmed || !fields) {
      navigate(ENTRY_PATH, { replace: true });
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
    sessionStorage.removeItem("pilotConsolidatedProfile");
    go("searching");

    const { data, error } = await supabase.functions.invoke("intro-scan", { body: nextFields });
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
    const { data, error } = await supabase.functions.invoke("phone-lookup", {
      body: { phone, quickscanId: quickScanIdRef.current },
    });
    if (error || !data) return { error: "fetch_failed" };
    return data;
  }

  function handleRunFullScan() {
    skipNoResultsExitRef.current = true;
    navigate(signupPath());
  }

  function handleNoResultsOpenChange(open: boolean) {
    if (open || skipNoResultsExitRef.current || currentPhase() !== "no_results") return;
    navigate(ENTRY_PATH, { replace: true });
  }

  const pickOpen = phase === "pick";

  return (
    <>
      <ScanLoadingView
        slides={slides}
        autoAdvanceMs={autoAdvanceMs}
        phases={PHASES}
        activeIndex={cardIndex(phase, isConfirming)}
        status={phase === "report" ? "complete" : "scanning"}
        onComplete={() => navigate(REPORT_PATH, { replace: true })}
      />

      <QSResultSingleModal
        isOpen={pickOpen && profiles.length === 1}
        onOpenChange={(open: boolean) => {
          if (!open) dismissPick();
        }}
        profile={profiles[0] ?? { id: "none", fullName: searchName || "Unknown" }}
        region={region}
        onThisIsMe={handlePick}
        onThisIsNotMe={dismissPick}
      />
      <QSResultMultipleModal
        isOpen={pickOpen && profiles.length > 1}
        onOpenChange={(open: boolean) => {
          if (!open) dismissPick();
        }}
        searchName={searchName}
        region={region}
        profiles={profiles}
        onProfileSelect={handlePick}
        onNoneOfThese={dismissPick}
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
          onCancel={handleSkipBreachScan}
        />
      ) : null}

      <Dialog
        opened={phase === "error"}
        title="Something stopped the scan"
        content={errorMessage || "We couldn't finish this search."}
        buttons={
          <DialogButton strong onClick={() => navigate(ENTRY_PATH, { replace: true })}>
            Try again
          </DialogButton>
        }
      />
    </>
  );
}
