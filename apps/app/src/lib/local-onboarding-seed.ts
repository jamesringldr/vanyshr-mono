import { allowLocalRouteBypass } from "@/lib/env";
import { loadConsolidatedProfile } from "@/pages/pilot-scan/consolidated-profile";

export type LocalOnboardingSeed = {
  firstName: string;
  lastName: string;
  fullName: string;
  emails: string[];
  phones: string[];
  aliases: string[];
  addresses: string[];
};

/** Scan results already in this browser — used when local Vite has no auth session. */
export function loadLocalOnboardingSeed(): LocalOnboardingSeed | null {
  if (!allowLocalRouteBypass()) return null;
  const { data } = loadConsolidatedProfile();
  if (!data?.profile) return null;

  const fullName = (data.profile.full_name ?? "").trim();
  const parts = fullName.split(/\s+/).filter(Boolean);
  const addresses = [
    data.profile.primary_address,
    ...(data.profile.previous_addresses ?? []),
  ].filter((v): v is string => Boolean(v && v.trim()));

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
    fullName,
    emails: data.profile.emails ?? [],
    phones: data.profile.phones ?? [],
    aliases: data.profile.aliases ?? [],
    addresses,
  };
}
