import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Mail, Check, Zap, Lock, Shield } from "lucide-react";
import PrimaryIconOutline from "@vanyshr/ui/assets/PrimaryIcon-outline.png";
import { cx } from "@/utils/cx";
import { supabase } from "@/lib/supabase";
import { usePilotScanResult } from "./use-pilot-scan-result";
import { loadConsolidatedProfile } from "./consolidated-profile";

/**
 * Pilot scan conversion screen — email capture and magic link signup.
 *
 * Mirrors the flow at pages/auth/magic-link.tsx, adapted for the pilot scan
 * funnel. Users enter their email, which captures the scan data server-side
 * and sends a magic link to complete signup.
 */
export function PilotStartPage() {
  const navigate = useNavigate();
  const { result } = usePilotScanResult();
  // Fallback to consolidated profile if the scan result hook didn't find it
  // (this handles the case where user navigates from report page to start page)
  const consolidatedData = useMemo(() => loadConsolidatedProfile().data, []);
  const scanId = result?.quick_scan_id || consolidatedData?.quick_scan_id;

  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isValid = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);

  const handleSend = async () => {
    if (!isValid || isSending || !scanId) return;
    setIsSending(true);
    setAuthError(null);

    try {
      // Step 1: Create the pending profile (captures email + scan data in DB).
      let profileId: string | null = null;
      try {
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

        profileId = profileResult.profile_id;
        sessionStorage.setItem("pendingProfileId", profileId);
      } catch (err) {
        console.error("create-pending-profile error:", err);
        throw err;
      }

      // Step 2: Send the magic link with profile_id embedded in the redirect
      // URL and user metadata so the auth callback can link the profile.
      const redirectUrl = new URL(`${window.location.origin}/auth/callback`);
      redirectUrl.searchParams.set("profile_id", profileId);

      const { error } = await supabase.auth.signInWithOtp({
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

      if (error) {
        throw error;
      }

      navigate(`/confirm-email?email=${encodeURIComponent(email.trim())}`);
    } catch (err) {
      console.error("Signup error:", err);
      if (err instanceof Error) {
        setAuthError(err.message);
      } else {
        setAuthError("Something went wrong. Please try again.");
      }
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && isValid && !isSending) {
      handleSend();
    }
  };

  if (!scanId) {
    return (
      <div
        className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-[#022136] px-6 font-ubuntu"
        role="main"
        aria-label="Pilot scan start"
      >
        <img
          src={PrimaryIconOutline}
          alt=""
          className="h-16 w-16 object-contain opacity-95"
        />
        <div className="max-w-sm text-center">
          <h1 className="text-2xl font-bold tracking-tight text-white">No scan found</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#B8C4CC]">
            Please run a scan from the start to create an account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "min-h-screen w-full font-sans transition-colors duration-200",
        "bg-[#F0F4F8] dark:bg-[#022136]",
      )}
      role="main"
      aria-label="Pilot scan signup"
    >
      <div className="mx-auto flex w-full max-w-sm flex-col px-4 pb-10 pt-10">
        {/* Icon */}
        <div className="flex justify-center">
          <img
            src={PrimaryIconOutline}
            alt=""
            className="h-20 w-20"
            aria-hidden
          />
        </div>

        {/* Hero copy */}
        <h1 className="mt-6 text-center text-4xl font-bold tracking-tighter text-[#022136] dark:text-white font-ubuntu">
          Create your account
        </h1>
        <p className="mt-3 text-center text-base text-[#B8C4CC] font-ubuntu">
          Get your full exposure report and stay protected.
        </p>

        {/* Setup time chip */}
        <div className="mt-6 flex justify-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#00BFFF]/10 border border-[#00BFFF]/30 px-3 py-1.5 text-xs font-medium text-[#00BFFF] font-ubuntu">
            <Zap className="w-3.5 h-3.5" aria-hidden />
            2 mins to complete setup
          </span>
        </div>

        {/* Feature bullets */}
        <ul className="mt-5 flex flex-col gap-4 text-left" role="list">
          <li className="flex items-start gap-4">
            <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
              <Check className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[#022136] dark:text-white">Your report is ready</p>
              <p className="mt-0.5 text-sm text-[#7A92A8]">
                See full details of your data breaches and exposed accounts
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
              <Shield className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[#022136] dark:text-white">Privacy first</p>
              <p className="mt-0.5 text-sm text-[#7A92A8]">
                Your data is encrypted and never sold
              </p>
            </div>
          </li>
          <li className="flex items-start gap-4">
            <div className="mt-0.5 flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-[#00D4AA]/10 border border-[#00D4AA]/30">
              <Lock className="w-4 h-4 text-[#00D4AA]" strokeWidth={3} aria-hidden />
            </div>
            <div>
              <p className="font-semibold text-[#022136] dark:text-white">Magic link signup</p>
              <p className="mt-0.5 text-sm text-[#7A92A8]">
                No password to remember — we'll send you a link
              </p>
            </div>
          </li>
        </ul>

        {/* Email input section */}
        <div className="mt-8 flex flex-col gap-4">
          <label htmlFor="email" className="text-sm font-semibold text-[#022136] dark:text-white">
            Email address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-[#7A92A8]" aria-hidden />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="you@example.com"
              disabled={isSending}
              className={cx(
                "w-full rounded-lg border px-4 py-3 pl-11 text-[#022136] dark:text-white",
                "placeholder-[#B8C4CC] dark:placeholder-[#7A92A8]",
                "bg-white dark:bg-[#1A2E42]",
                "border-[#D1D5DB] dark:border-[#2A4A68]",
                "outline-none transition",
                "focus:ring-2 focus:ring-[#00BFFF] focus:ring-offset-0 dark:focus:ring-offset-0",
                "disabled:opacity-50 disabled:cursor-not-allowed",
              )}
            />
          </div>

          {authError && (
            <p className="text-sm text-[#FF8A00]">{authError}</p>
          )}

          <button
            type="button"
            onClick={handleSend}
            disabled={!isValid || isSending}
            className={cx(
              "h-12 rounded-lg font-semibold transition outline-none",
              isValid && !isSending
                ? "bg-[#00BFFF] text-white hover:bg-[#00D4FF] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#00BFFF] focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#022136]"
                : "bg-[#D1D5DB] dark:bg-[#2A4A68] text-[#7A92A8] cursor-not-allowed",
            )}
          >
            {isSending ? "Sending…" : "Send magic link"}
          </button>
        </div>

        {/* Back link */}
        <div className="mt-8 text-center">
          <button
            type="button"
            onClick={() => navigate("/pilot-scan/risk")}
            className="text-sm text-[#7A92A8] hover:text-[#022136] dark:hover:text-white transition outline-none"
          >
            Back to risk summary
          </button>
        </div>
      </div>
    </div>
  );
}
