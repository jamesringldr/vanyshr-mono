/**
 * Progressive identification order for the picker.
 *
 * FPS first (highest target-match rate on the lab set). Empty / blocked /
 * failed / timeout on a broker is the same as the user rejecting that list:
 * walk to the next. NPD is last — ~30% hit, never exclusive in lab or prod.
 *
 * Keep this list in sync with IDENTIFY_ORDER in
 * apps/app/src/pages/pilot-scan/loading.tsx.
 */
export const IDENTIFY_ORDER = ["fps", "anywho", "zaba", "npd"] as const;
export type IdentifyBroker = (typeof IDENTIFY_ORDER)[number];
export const FIRST_IDENTIFY_BROKER: IdentifyBroker = IDENTIFY_ORDER[0];

export function isIdentifyBroker(value: string): value is IdentifyBroker {
  return (IDENTIFY_ORDER as readonly string[]).includes(value);
}

export function nextIdentifyBroker(current: IdentifyBroker): IdentifyBroker | null {
  const i = IDENTIFY_ORDER.indexOf(current);
  return i >= 0 ? (IDENTIFY_ORDER[i + 1] ?? null) : null;
}

/**
 * Only a genuine empty result list walks to the next picker broker.
 * blocked / failed / timeout mean we never saw the page — that is not
 * "this person isn't on FPS", and falling through shows the wrong people
 * (Jillian Pfaff 2026-08-26: FPS bot-check → AnyWho PA/WA/WV).
 */
export function shouldWalkNextIdentifyBroker(status: string): boolean {
  return status === "no_results";
}

/**
 * First non-empty picker list in identify order.
 *
 * If FPS (the awaited broker) is empty and the others are still in flight,
 * return notReady rather than falling through — the caller should wait.
 * blocked / failed / no_results all look like an empty list here.
 */
export function firstNonEmptyIdentifyList<T>(
  lists: Partial<Record<IdentifyBroker, T[]>>,
  backgroundComplete: boolean,
): { broker: IdentifyBroker; candidates: T[]; notReady?: boolean } {
  const first = lists[FIRST_IDENTIFY_BROKER] ?? [];
  if (first.length) return { broker: FIRST_IDENTIFY_BROKER, candidates: first };
  if (!backgroundComplete) {
    return { broker: FIRST_IDENTIFY_BROKER, candidates: [], notReady: true };
  }
  for (const broker of IDENTIFY_ORDER) {
    const candidates = lists[broker] ?? [];
    if (candidates.length) return { broker, candidates };
  }
  return { broker: FIRST_IDENTIFY_BROKER, candidates: [] };
}
