import { useState, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cx } from "@/utils/cx";

/**
 * Simple scan entry — Grok Bot-inspired minimal form.
 * Just first name, last name, zip. Clean, conversational, lots of air.
 */
export function SimpleScanEntry() {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);

  const canSubmit = firstName.trim() && lastName.trim() && zipCode.trim().length === 5;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit || isScanning) return;

    setIsScanning(true);
    sessionStorage.removeItem("pilotScanResult");
    sessionStorage.removeItem("pilotScanError");

    try {
      const sessionId = `simple-scan-${Date.now()}`;
      
      const { data, error } = await supabase.functions.invoke("intro-scan", {
        body: {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          zipCode: zipCode.trim(),
          city: "", // Will be resolved by backend
          state: "", // Will be resolved by backend
        },
      });

      if (error || data?.error || !data?.id) {
        throw new Error(error?.message || data?.error || "Could not start scan");
      }

      sessionStorage.setItem("pendingScanId", data.id);
      sessionStorage.setItem("pilotScanFields", JSON.stringify({ firstName, lastName, zipCode }));
      
      navigate("/simple/scan/loading");
    } catch (err) {
      console.error("Scan error:", err);
      alert("Something went wrong. Please try again.");
      setIsScanning(false);
    }
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-16">
        <form onSubmit={handleSubmit} className="space-y-12">
          {/* Headline */}
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-semibold leading-tight text-gray-900">
              See what's out there
            </h1>
            <p className="text-lg text-gray-600">
              We'll search hundreds of data broker sites to show you what they know about you.
            </p>
          </div>

          {/* Form fields */}
          <div className="space-y-6">
            <div>
              <label htmlFor="firstName" className="mb-2 block text-sm font-medium text-gray-700">
                First name
              </label>
              <input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                disabled={isScanning}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="lastName" className="mb-2 block text-sm font-medium text-gray-700">
                Last name
              </label>
              <input
                id="lastName"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                disabled={isScanning}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>

            <div>
              <label htmlFor="zipCode" className="mb-2 block text-sm font-medium text-gray-700">
                ZIP code
              </label>
              <input
                id="zipCode"
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                placeholder="94102"
                maxLength={5}
                disabled={isScanning}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
              />
            </div>
          </div>

          {/* Trust badge */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-center text-sm text-blue-800">
              We don't save your info from this scan.
              <br />
              No signup required to see results.
            </p>
          </div>
        </form>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleSubmit}
            disabled={!canSubmit || isScanning}
            className={cx(
              "flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors",
              canSubmit && !isScanning
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-300",
            )}
          >
            {isScanning ? "Scanning..." : "Run scan"}
            {!isScanning && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="mt-3 text-center text-xs text-gray-500">Takes about 3 minutes</p>
        </div>
      </div>
    </div>
  );
}
