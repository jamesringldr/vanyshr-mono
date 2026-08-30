import { useState, useMemo, FormEvent } from "react";
import { useNavigate } from "react-router";
import { Shield, ArrowRight } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Simple scan signup — email capture to create account.
 * Clean, minimal, Grok Bot-style.
 */
export function SimpleScanSignup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanId = sessionStorage.getItem("pendingScanId");
  const isValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isValid || isSending || !scanId) return;

    setIsSending(true);
    setError(null);

    try {
      // Create pending profile
      const { data: profileResult, error: profileError } = await supabase.functions.invoke<{
        success: boolean;
        profile_id?: string;
        error?: string;
      }>("create-pending-profile", {
        body: { scan_id: scanId, email: email.trim() },
      });

      if (profileError || !profileResult?.success || !profileResult?.profile_id) {
        throw new Error(profileResult?.error ?? profileError?.message ?? "Failed to create profile");
      }

      const profileId = profileResult.profile_id;
      sessionStorage.setItem("pendingProfileId", profileId);

      // Send magic link
      const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
      redirectUrl.searchParams.set("profile_id", profileId);

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: redirectUrl.toString(),
          shouldCreateUser: true,
          data: {
            profile_id: profileId,
            source_quick_scan_id: scanId,
          },
        },
      });

      if (authError) throw authError;

      navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      console.error("Signup error:", err);
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsSending(false);
    }
  }

  if (!scanId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-gray-600">No scan found.</p>
          <button
            onClick={() => navigate("/simple/scan")}
            className="mt-4 text-blue-600 hover:text-blue-700"
          >
            Start a new scan
          </button>
        </div>
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
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-32 pt-16">
        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Headline */}
          <div className="space-y-4 text-center">
            <h1 className="text-3xl font-semibold leading-tight text-gray-900">
              Get your data removed
            </h1>
            <p className="text-lg text-gray-600">
              Enter your email to create an account. We'll start removing your data from these sites.
            </p>
          </div>

          {/* Email input */}
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={isSending}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-base text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Trust message */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <p className="text-center text-sm text-blue-800">
              We'll send you a magic link to log in. No password needed.
            </p>
          </div>
        </form>
      </main>

      {/* Footer CTA */}
      <div className="fixed bottom-0 left-0 right-0 border-t border-gray-100 bg-white px-4 py-4">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={handleSubmit}
            disabled={!isValid || isSending}
            className={`flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-white transition-colors ${
              isValid && !isSending
                ? "bg-blue-600 hover:bg-blue-700"
                : "cursor-not-allowed bg-gray-300"
            }`}
          >
            {isSending ? "Sending..." : "Continue"}
            {!isSending && <ArrowRight className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
