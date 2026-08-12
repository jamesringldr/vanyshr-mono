import { Navigate, useSearchParams } from "react-router";

/**
 * Legacy /invite → pilot-scan entry (preserves ?id= for welcome name).
 */
export function Invite() {
  const [searchParams] = useSearchParams();
  const qs = searchParams.toString();
  return <Navigate to={qs ? `/pilot-scan?${qs}` : "/pilot-scan"} replace />;
}
