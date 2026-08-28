import { allowLocalRouteBypass } from "@/lib/env";

const USER_KEY = "devUserId";
const PROGRESS_KEY = "devOnboardingProgress";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type DevOnboardingProgress = {
  step: number;
  removalStrategy: string | null;
  notificationTier: string | null;
};

/** Local Vite only: remember ?user= or a UUID as the last path segment. */
export function captureDevUserFromLocation(): string | null {
  if (!allowLocalRouteBypass()) return null;

  const fromQuery = new URLSearchParams(window.location.search).get("user");
  if (fromQuery && UUID_RE.test(fromQuery)) {
    sessionStorage.setItem(USER_KEY, fromQuery);
    return fromQuery;
  }

  const tail = window.location.pathname.split("/").filter(Boolean).pop();
  if (tail && UUID_RE.test(tail)) {
    sessionStorage.setItem(USER_KEY, tail);
    return tail;
  }

  return sessionStorage.getItem(USER_KEY);
}

export function getDevUserId(): string | null {
  if (!allowLocalRouteBypass()) return null;
  return captureDevUserFromLocation();
}

export function getDevProgress(): DevOnboardingProgress {
  try {
    const raw = sessionStorage.getItem(PROGRESS_KEY);
    if (!raw) return { step: 0, removalStrategy: null, notificationTier: null };
    const parsed = JSON.parse(raw) as Partial<DevOnboardingProgress>;
    return {
      step: typeof parsed.step === "number" ? parsed.step : 0,
      removalStrategy: parsed.removalStrategy ?? null,
      notificationTier: parsed.notificationTier ?? null,
    };
  } catch {
    return { step: 0, removalStrategy: null, notificationTier: null };
  }
}

export function patchDevProgress(patch: Partial<DevOnboardingProgress>): void {
  if (!allowLocalRouteBypass()) return;
  const next = { ...getDevProgress(), ...patch };
  sessionStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
}
