import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { saveConsolidatedProfile, type ConsolidatedProfile } from "@/pages/pilot-scan/consolidated-profile";
import type { ScanMember } from "@/pages/pilot-scan/scan-result";

/**
 * Simple scan loading — clean, minimal progress indicator.
 * Polls for REAL scan completion using the same backend as /pilot-scan.
 */

type IdentifyBroker = "fps" | "anywho" | "zaba" | "npd";
const IDENTIFY_ORDER: IdentifyBroker[] = ["fps", "anywho", "zaba", "npd"];

type IdentifyCandidate = ScanMember & { result_id: string };

function nextIdentifyBroker(current: IdentifyBroker): IdentifyBroker | null {
  const i = IDENTIFY_ORDER.indexOf(current);
  return i >= 0 ? IDENTIFY_ORDER[i + 1] ?? null : null;
}

function candidatesFrom(data: { candidates?: unknown; zaba_candidates?: unknown } | null): IdentifyCandidate[] {
  const raw = Array.isArray(data?.candidates) && data!.candidates!.length
    ? data!.candidates
    : Array.isArray(data?.zaba_candidates)
      ? data!.zaba_candidates
      : [];
  return raw.filter((c): c is IdentifyCandidate => Boolean(c && typeof c === "object" && (c as IdentifyCandidate).result_id));
}

function emailsFrom(data: { consolidated_profile?: { emails?: unknown } } | null): string[] {
  const raw = data?.consolidated_profile?.emails;
  const list = Array.isArray(raw) ? raw : [];
  return list.filter((e): e is string => typeof e === "string" && e.includes("@"))
    .filter((e) => !/x{3,}/i.test(e));
}

export function SimpleScanLoading() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("Starting scan...");
  const [progress, setProgress] = useState(0);
  const [hasMultiple, setHasMultiple] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const quickScanIdRef = useRef<string | null>(null);
  const candidatesRef = useRef<IdentifyCandidate[]>([]);
  const rejectedRef = useRef<IdentifyCandidate[]>([]);
  const identifyBrokerRef = useRef<IdentifyBroker>("fps");

  useEffect(() => {
    const scanId = sessionStorage.getItem("pendingScanId");
    if (!scanId) {
      navigate("/simple/scan");
      return;
    }

    quickScanIdRef.current = scanId;

    // Start the summary scan
    (async () => {
      try {
        setStatus("Searching data brokers...");
        setProgress(20);

        const { data, error } = await supabase.functions.invoke("summary-scan", {
          body: { quickscanId: scanId },
        });

        if (error || data?.error) {
          console.error("summary-scan error:", error || data?.error);
          navigate("/simple/scan");
          return;
        }

        const candidates = candidatesFrom(data);
        candidatesRef.current = candidates;

        if (candidates.length === 0) {
          // Try next broker
          const next = nextIdentifyBroker("fps");
          if (next) {
            await tryNextBroker(next, scanId);
          } else {
            navigate("/simple/scan"); // No results
          }
          return;
        }

        setProgress(50);

        if (candidates.length > 1) {
          // Multiple matches - show picker
          setHasMultiple(true);
          setStatus("Which one is you?");
        } else {
          // Single match - auto-pick and continue
          setStatus("Found you! Gathering details...");
          setProgress(70);
          await runFullProfileScan(scanId, candidates[0]!.result_id);
        }
      } catch (err) {
        console.error("Scan error:", err);
        navigate("/simple/scan");
      }
    })();
  }, [navigate]);

  async function tryNextBroker(broker: IdentifyBroker, scanId: string) {
    setStatus(`Searching ${broker.toUpperCase()}...`);

    const { data, error } = await supabase.functions.invoke("summary-scan", {
      body: { quickscanId: scanId, listBroker: broker },
    });

    if (error || data?.error || data?.notReady) {
      const next = nextIdentifyBroker(broker);
      if (next) {
        await tryNextBroker(next, scanId);
      } else {
        navigate("/simple/scan"); // No results from any broker
      }
      return;
    }

    const candidates = candidatesFrom(data);
    if (candidates.length === 0) {
      const next = nextIdentifyBroker(broker);
      if (next) {
        await tryNextBroker(next, scanId);
      } else {
        navigate("/simple/scan");
      }
      return;
    }

    candidatesRef.current = candidates;
    identifyBrokerRef.current = broker;

    if (candidates.length > 1) {
      setHasMultiple(true);
      setStatus("Which one is you?");
    } else {
      setProgress(70);
      await runFullProfileScan(scanId, candidates[0]!.result_id);
    }
  }

  async function runFullProfileScan(scanId: string, profileId: string) {
    setStatus("Gathering your details...");
    setProgress(80);

    try {
      const { data, error } = await supabase.functions.invoke("full-profile-scan", {
        body: {
          quickscanId: scanId,
          fullProfileResultId: profileId,
          rejected: rejectedRef.current,
        },
      });

      if (error || data?.error) {
        console.error("full-profile-scan error:", error || data?.error);
        navigate("/simple/scan");
        return;
      }

      setProgress(100);

      // Save consolidated profile to sessionStorage
      if (data?.consolidated_profile) {
        const brokerFields: Record<string, string[]> =
          data?.broker_fields && typeof data.broker_fields === "object" ? data.broker_fields : {};
        const brokers = Object.keys(brokerFields);

        saveConsolidatedProfile(
          data.consolidated_profile as ConsolidatedProfile,
          brokers.length,
          brokers,
          brokerFields,
          scanId,
        );
      }

      // Navigate to reveal
      setTimeout(() => navigate("/simple/scan/reveal"), 500);
    } catch (err) {
      console.error("Full profile scan error:", err);
      navigate("/simple/scan");
    }
  }

  async function handlePick(candidate: IdentifyCandidate) {
    setHasMultiple(false);
    setPickedId(candidate.result_id);
    setStatus("Gathering your details...");
    setProgress(70);

    const scanId = quickScanIdRef.current;
    if (!scanId) {
      navigate("/simple/scan");
      return;
    }

    await runFullProfileScan(scanId, candidate.result_id);
  }

  async function handleNoneOfThese() {
    rejectedRef.current = [...rejectedRef.current, ...candidatesRef.current];
    const next = nextIdentifyBroker(identifyBrokerRef.current);

    if (!next) {
      navigate("/simple/scan"); // Rejected all
      return;
    }

    const scanId = quickScanIdRef.current;
    if (!scanId) {
      navigate("/simple/scan");
      return;
    }

    setHasMultiple(false);
    await tryNextBroker(next, scanId);
  }

  if (hasMultiple) {
    // Person picker UI
    return (
      <div className="flex min-h-screen flex-col bg-white">
        {/* Header */}
        <header className="px-4 py-6">
          <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
              <Shield className="h-5 w-5 text-blue-600" />
            </div>
            <span className="text-lg font-semibold text-gray-900">Vanyshr</span>
          </div>
        </header>

        {/* Main Content */}
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-8">
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-semibold text-gray-900">Which one is you?</h1>
              <p className="mt-2 text-base text-gray-600">We found multiple people. Pick yours to continue.</p>
            </div>

            {/* Candidate list */}
            <div className="space-y-3">
              {candidatesRef.current.map((candidate) => (
                <button
                  key={candidate.result_id}
                  onClick={() => handlePick(candidate)}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-5 text-left transition-colors hover:border-blue-300 hover:bg-blue-50"
                >
                  <p className="font-semibold text-gray-900">{candidate.name}</p>
                  {candidate.age && <p className="mt-1 text-sm text-gray-600">{candidate.age} years old</p>}
                  {candidate.address && <p className="mt-1 text-sm text-gray-600">{candidate.address}</p>}
                </button>
              ))}
            </div>

            {/* None of these */}
            <button
              onClick={handleNoneOfThese}
              className="w-full rounded-2xl border border-gray-200 bg-white px-6 py-4 text-center text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              None of these are me
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
            <Shield className="h-5 w-5 text-blue-600" />
          </div>
          <span className="text-lg font-semibold text-gray-900">Vanyshr</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-4">
        <div className="w-full space-y-8 text-center">
          {/* Spinner */}
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-50">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            </div>
          </div>

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xl font-semibold text-gray-900">{status}</p>
            <p className="text-sm text-gray-500">This usually takes 2-3 minutes</p>
          </div>

          {/* Progress bar */}
          <div className="mx-auto w-full max-w-md">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-500"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
