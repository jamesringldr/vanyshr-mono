import { useMemo } from "react";
import { Navigate } from "react-router";
import { signupPath } from "@/lib/pending-scan";

/**
 * Legacy conversion URL. The funnel now uses the canonical /signup page
 * (auth/magic-link.tsx) so scan-id handoff and the existing-user check live
 * in one place. Keep this route so old links still land on signup.
 */
export function PilotStartPage() {
  const to = useMemo(() => signupPath(), []);
  return <Navigate to={to} replace />;
}
