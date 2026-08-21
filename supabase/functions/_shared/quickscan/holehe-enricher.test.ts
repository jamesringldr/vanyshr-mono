/**
 * Holehe enricher — high-value allowlist
 * Run: deno test supabase/functions/_shared/quickscan/holehe-enricher.test.ts
 *
 * extractServices()/countCheckedServices() from the earlier version of this
 * test are gone — they parsed a raw HoleheResponse.services map, a shape
 * that only existed because the old code called a REST API directly. The
 * real integration is a hosted service (see holehe-enricher.ts) that
 * returns already-parsed services_found/services_checked, so there's
 * nothing left client-side to extract from a raw response.
 */
import { canonicalServiceName, isHighValueService } from "./holehe-enricher.ts";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

Deno.test("keeps consumer sites under either module or domain keys", () => {
  assert(isHighValueService("twitter"), "twitter");
  assert(isHighValueService("twitter.com"), "twitter.com");
  assert(isHighValueService("en.gravatar.com"), "en.gravatar.com");
  assert(isHighValueService("any.do"), "any.do");
  assert(isHighValueService("last.fm"), "last.fm");
  assert(isHighValueService("github.com"), "github.com");
});

Deno.test("drops niche / adult / CRM / FR-local sites", () => {
  assert(!isHighValueService("dominos.fr"), "dominos.fr");
  assert(!isHighValueService("pornhub.com"), "pornhub.com");
  assert(!isHighValueService("armurerie-auxerre.com"), "armurerie");
  assert(!isHighValueService("pipedrive.com"), "pipedrive");
  assert(!isHighValueService("drachenhort.user.stunet.tu-freiberg.de"), "freiberg");
});

Deno.test("canonical names collapse aliases", () => {
  assert(canonicalServiceName("x.com") === "twitter", "x.com");
  assert(canonicalServiceName("en.gravatar.com") === "gravatar", "gravatar");
  assert(canonicalServiceName("any.do") === "anydo", "any.do");
});
