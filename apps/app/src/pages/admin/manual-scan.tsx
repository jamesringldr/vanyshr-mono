import { useCallback, useState } from "react";
import { Link } from "react-router";
import { supabase } from "../../lib/supabase";

const BROKERS = [
  {
    id: "fastpeoplesearch",
    label: "FastPeopleSearch",
    sourceLabel: "FastPeopleSearch",
    urlPlaceholder: "https://www.fastpeoplesearch.com/...",
  },
  {
    id: "anywho",
    label: "AnyWho",
    sourceLabel: "AnyWho",
    urlPlaceholder: "https://www.anywho.com/people/...",
  },
  {
    id: "zabasearch",
    label: "Zabasearch",
    sourceLabel: "Zabasearch",
    urlPlaceholder: "https://www.zabasearch.com/people/...",
  },
] as const;

type BrokerId = (typeof BROKERS)[number]["id"];

interface BrokerUpload {
  detailUrl: string;
  file: File | null;
  fileName: string | null;
  matchName: string;
  matchAge: string;
}

interface SourceResult {
  site_name: string;
  success: boolean;
  error?: string;
  fields?: { phones: number; addresses: number; relatives: number };
}

interface BatchParseResponse {
  success: boolean;
  scan_id?: string;
  profile_id?: string;
  profile_data?: { name?: string; age?: string };
  source_results?: SourceResult[];
  merged_from?: number;
  pre_profile_url?: string;
  error?: string;
}

function newScanId(): string {
  return crypto.randomUUID();
}

function emptyBrokerState(): Record<BrokerId, BrokerUpload> {
  return {
    fastpeoplesearch: { detailUrl: "", file: null, fileName: null, matchName: "", matchAge: "" },
    anywho: { detailUrl: "", file: null, fileName: null, matchName: "", matchAge: "" },
    zabasearch: { detailUrl: "", file: null, fileName: null, matchName: "", matchAge: "" },
  };
}

async function readHtmlFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export function AdminManualScan() {
  const [scanId, setScanId] = useState(newScanId);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [brokers, setBrokers] = useState(emptyBrokerState);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultJson, setResultJson] = useState<string | null>(null);
  const [sourceResults, setSourceResults] = useState<SourceResult[] | null>(null);

  const updateBroker = useCallback((id: BrokerId, patch: Partial<BrokerUpload>) => {
    setBrokers((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }, []);

  const handleFile = useCallback((id: BrokerId, file: File | null) => {
    if (!file) {
      updateBroker(id, { file: null, fileName: null });
      return;
    }
    updateBroker(id, { file, fileName: file.name });
    setError(null);
  }, [updateBroker]);

  const handleNewScan = useCallback(() => {
    setScanId(newScanId());
    setBrokers(emptyBrokerState());
    setError(null);
    setResultJson(null);
    setSourceResults(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!firstName.trim() || !lastName.trim()) {
      setError("First and last name are required for the scan record.");
      return;
    }

    const uploads = BROKERS.filter((b) => brokers[b.id].file);
    if (uploads.length === 0) {
      setError("Upload at least one broker HTML file.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResultJson(null);
    setSourceResults(null);

    try {
      const sources: Array<{ site_name: string; detail_url?: string; html: string }> = [];

      for (const broker of uploads) {
        const entry = brokers[broker.id];
        if (!entry.file) continue;
        const html = await readHtmlFile(entry.file);
        const sourcePayload: {
          site_name: string;
          detail_url?: string;
          html: string;
          selected_profile?: { name?: string; age?: string };
        } = {
          site_name: broker.id,
          detail_url: entry.detailUrl.trim() || undefined,
          html,
        };

        if (broker.id === "zabasearch" && (entry.matchName.trim() || entry.matchAge.trim())) {
          sourcePayload.selected_profile = {
            name: entry.matchName.trim() || undefined,
            age: entry.matchAge.trim() || undefined,
          };
        }

        sources.push(sourcePayload);
      }

      const { data, error: invokeError } = await supabase.functions.invoke<BatchParseResponse>(
        "admin-parse-html",
        {
          body: {
            scan_id: scanId,
            search_input: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              email: email.trim() || undefined,
              city: city.trim() || undefined,
              state: state.trim() || undefined,
            },
            sources,
            save_to_db: true,
          },
        },
      );

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      if (!data?.success) {
        setSourceResults(data?.source_results ?? null);
        throw new Error(data?.error ?? "Parse failed");
      }

      if (data.source_results) setSourceResults(data.source_results);

      // Pre-profile loads merged profile_data from quick_scans by scan id.
      sessionStorage.removeItem("selectedProfile");
      if (data.profile_id) {
        sessionStorage.setItem("pendingProfileId", data.profile_id);
        sessionStorage.setItem("pendingScanId", data.scan_id ?? scanId);
      }

      setResultJson(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  }, [brokers, city, email, firstName, lastName, scanId, state]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider text-amber-400">Dev admin</p>
          <h1 className="mt-1 text-2xl font-semibold">Manual QuickScan HTML</h1>
          <p className="mt-2 text-sm text-slate-400">
            One scan, up to three broker detail pages. Upload saved HTML plus each page&apos;s URL;
            we parse and merge into a single <code className="rounded bg-slate-800 px-1">profile_data</code> JSONB row.
          </p>
        </div>

        <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Scan ID (auto-generated)</p>
                <code className="mt-1 block font-mono text-sm text-emerald-300">{scanId}</code>
              </div>
              <button
                type="button"
                onClick={handleNewScan}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              >
                New scan
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">First name</span>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">Last name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block text-slate-400">Email (optional)</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="claire@example.com"
                autoComplete="email"
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
              <span className="mt-1 block text-xs text-slate-500">
                Creates a pending user profile (signup step) with this email when provided.
              </span>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">City (optional)</span>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block text-slate-400">State (optional)</span>
              <input
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
              />
            </label>
          </div>

          <div className="space-y-4">
            {BROKERS.map((broker) => {
              const entry = brokers[broker.id];
              return (
                <div
                  key={broker.id}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3"
                >
                  <h2 className="text-sm font-semibold text-amber-400/90">{broker.label}</h2>
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-400">Detail page URL</span>
                    <input
                      type="url"
                      value={entry.detailUrl}
                      onChange={(e) => updateBroker(broker.id, { detailUrl: e.target.value })}
                      placeholder={broker.urlPlaceholder}
                      className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs"
                    />
                  </label>
                  {broker.id === "zabasearch" && (
                    <div className="grid gap-3 rounded-lg border border-slate-700/60 bg-slate-900/50 p-3 sm:grid-cols-2">
                      <p className="text-xs text-slate-500 sm:col-span-2">
                        Zabasearch often shows multiple people on one page. Match by name only — listing ages are often wrong.
                        Use Match age or the Age field above for the correct value.
                      </p>
                      <label className="block text-sm">
                        <span className="mb-1 block text-slate-400">Match name</span>
                        <input
                          value={entry.matchName}
                          onChange={(e) => updateBroker(broker.id, { matchName: e.target.value })}
                          placeholder="Claire Inman"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                        />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-1 block text-slate-400">Match age</span>
                        <input
                          value={entry.matchAge}
                          onChange={(e) => updateBroker(broker.id, { matchAge: e.target.value })}
                          placeholder="33"
                          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                        />
                      </label>
                    </div>
                  )}
                  <label className="block text-sm">
                    <span className="mb-1 block text-slate-400">Saved HTML file</span>
                    <input
                      type="file"
                      accept=".html,.htm,text/html"
                      onChange={(e) => handleFile(broker.id, e.target.files?.[0] ?? null)}
                      className="w-full text-sm text-slate-400 file:mr-4 file:rounded file:border-0 file:bg-amber-500/90 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-950"
                    />
                    {entry.fileName && (
                      <span className="mt-1 block text-xs text-emerald-400/80">{entry.fileName}</span>
                    )}
                  </label>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-500">
            Skip any broker you don&apos;t have. Uploaded sources are merged (phones, addresses, relatives, etc.).
          </p>

          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          {sourceResults && sourceResults.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-400">
              {sourceResults.map((r) => (
                <li key={r.site_name}>
                  <span className={r.success ? "text-emerald-400" : "text-red-400"}>
                    {r.site_name}: {r.success ? "ok" : r.error ?? "failed"}
                  </span>
                  {r.fields && r.success && (
                    <span className="text-slate-500">
                      {" "}
                      — {r.fields.phones} phones, {r.fields.addresses} addresses, {r.fields.relatives} relatives
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={isLoading}
            className="w-full rounded-lg bg-amber-500 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
          >
            {isLoading ? "Parsing & merging…" : "Parse all & save to DB"}
          </button>

          {!error && resultJson && (
            <div className="text-sm space-y-2">
              <Link
                to={`/quick-scan/pre-profile/${scanId}`}
                className="inline-block text-amber-400 underline"
              >
                Open pre-profile →
              </Link>
              <pre className="max-h-64 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300">
                {resultJson}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
