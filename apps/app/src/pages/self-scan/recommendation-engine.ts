import type { LucideIcon } from "lucide-react";
import { Eraser, Ghost, KeyRound, Lock, MailSearch, MapPinOff, Radar, BookOpen } from "lucide-react";
import type { StoredConsolidatedProfile } from "../pilot-scan/consolidated-profile";

/**
 * Recommendations engine for the self-scan report. Every recommendation is
 * derived from the stored scan (breaches + broker records) and cites its
 * reason in its explainer -- never generic. Pure: no React, no storage.
 */

export type RecommendationId =
  | "secure-accounts"
  | "remove-listings"
  | "freeze-credit"
  | "stale-accounts"
  | "camouflage"
  | "blur-home"
  | "stay-watched"
  | "tighten-settings";

export type Recommendation = {
  id: RecommendationId;
  title: string;
  explainer: string;
  Icon: LucideIcon;
  /** Higher sorts first. */
  score: number;
};

/** Field-label matchers -- same vocabulary as field-chips.tsx's RISK_RANK. */
const SSN = /ssn|social.?sec/i;
const DOB = /dob|birth/i;
const CREDENTIALS = /password|passwd|hash/i;
const ADDRESS = /address/i;
const PHONE = /phone/i;
const EMAIL = /email/i;

/** Maximum recommendations shown before the rest collapse. */
export const TOP_COUNT = 5;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Base priority (1 = most urgent) -> sortable score, so boosts and nudges are additive. */
function scoreFor(basePriority: number, boost = 0, nudge = 0) {
  return (10 - basePriority) * 10 + boost + nudge;
}

export function buildRecommendations(stored: StoredConsolidatedProfile): Recommendation[] {
  const { profile } = stored;
  const brokerCodes = Array.from(new Set(stored.brokers ?? []));
  const brokerFieldLabels = Object.values(stored.brokerFields ?? {}).flat();
  const breachesByEmail = profile.breaches ?? [];

  const breachCount = breachesByEmail.reduce((sum, e) => sum + e.breaches.length, 0);
  const credentialBreachCount = breachesByEmail
    .filter((e) => e.fields_exposed.some((f) => CREDENTIALS.test(f)))
    .reduce((sum, e) => sum + e.breaches.length, 0);
  const brokerCount = brokerCodes.length;

  const exposedLabels = [...brokerFieldLabels, ...breachesByEmail.flatMap((e) => e.fields_exposed)];
  const hasSsn = exposedLabels.some((f) => SSN.test(f));
  const hasDob = exposedLabels.some((f) => DOB.test(f));
  const addressExposed =
    Boolean(profile.primary_address) && (brokerCount > 0 || exposedLabels.some((f) => ADDRESS.test(f)));

  const emailBrokerCount = brokerCodes.filter((code) =>
    (stored.brokerFields?.[code] ?? []).some((f) => EMAIL.test(f)),
  ).length;
  const emailExposureCount = breachCount + emailBrokerCount + (profile.services_found?.length ?? 0);

  const noFindings = breachCount === 0 && brokerCount === 0;
  const recs: Recommendation[] = [];

  if (credentialBreachCount > 0) {
    recs.push({
      id: "secure-accounts",
      title: "Secure your breached accounts",
      explainer: `Your email and password were exposed in ${plural(credentialBreachCount, "breach", "breaches")}. Change these passwords now and turn on two-factor authentication — we'll walk you through it.`,
      Icon: KeyRound,
      score: scoreFor(1, 5), // credentials are a critical field
    });
  }

  if (brokerCount > 0) {
    const phoneOrAddress = brokerFieldLabels.some((f) => PHONE.test(f) || ADDRESS.test(f));
    recs.push({
      id: "remove-listings",
      title: "Remove your broker listings",
      explainer: `We found your info on ${plural(brokerCount, "broker site", "broker sites")}${phoneOrAddress ? ", including your address or phone number where anyone can look it up" : ""}. We'll file a removal request for each one and track it to completion.`,
      Icon: Eraser,
      // Count nudge: a long list of brokers outranks camouflage and the rest.
      score: scoreFor(2, phoneOrAddress ? 2 : 0, Math.min(brokerCount, 5)),
    });
  }

  if (hasSsn || hasDob) {
    const what = hasSsn && hasDob ? "SSN and date of birth were" : hasSsn ? "SSN was" : "date of birth was";
    recs.push({
      id: "freeze-credit",
      title: "Freeze your credit",
      explainer: `Your ${what} exposed — enough to open accounts in your name. A credit freeze takes 10 minutes and blocks new accounts cold.`,
      Icon: Lock,
      // SSN jumps the queue to priority 2; DOB alone stays at 4.
      score: hasSsn ? scoreFor(2, 5) : scoreFor(4, 2),
    });
  }

  if (emailExposureCount > 0) {
    recs.push({
      id: "stale-accounts",
      title: "Clean up stale accounts",
      explainer: `Your email turned up in ${plural(emailExposureCount, "place", "places")}. Old accounts tied to it are unlocked doors — we'll find them all and close the ones you don't use.`,
      Icon: MailSearch,
      score: scoreFor(5),
    });
  }

  if (brokerCount > 0) {
    recs.push({
      id: "camouflage",
      title: "Camouflage your data",
      explainer:
        "Even after removal, brokers rebuild profiles. We seed realistic synthetic data so whatever remains about you can't be trusted.",
      Icon: Ghost,
      score: scoreFor(6),
    });
  }

  if (addressExposed) {
    recs.push({
      id: "blur-home",
      title: "Blur your home on Maps",
      explainer:
        "Your home address is listed publicly. Blurring it on Google Maps and Street View takes one request — here's exactly how.",
      Icon: MapPinOff,
      score: scoreFor(7),
    });
  }

  recs.push({
    id: "stay-watched",
    title: "Stay watched",
    explainer: noFindings
      ? "Good news: no breaches found. Brokers re-list people constantly, so we'll keep watching and re-remove automatically."
      : "Once you're clean, we keep you that way — automatic re-removal the moment you reappear.",
    Icon: Radar,
    // With nothing found, watching is the whole story and leads the list.
    score: noFindings ? scoreFor(0) : scoreFor(8),
  });

  recs.push({
    id: "tighten-settings",
    title: "Tighten your settings",
    explainer:
      "Step-by-step playbooks to lock down your phone, apps, and social accounts — so you stop leaking new data.",
    Icon: BookOpen,
    score: scoreFor(9),
  });

  // Stable: equal scores keep the order above.
  return recs.sort((a, b) => b.score - a.score);
}
