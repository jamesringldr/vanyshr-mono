/**
 * Holehe enricher — high-value allowlist
 * Run: deno test supabase/functions/_shared/quickscan/holehe-enricher.test.ts
 */
import {
  canonicalServiceName,
  countCheckedServices,
  extractServices,
  isHighValueService,
} from "./holehe-enricher.ts";

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

Deno.test("extractServices returns only high-value hits, priority first", () => {
  const services = extractServices({
    email: "a@b.com",
    exists: true,
    services: {
      "dominos.fr": true,
      twitter: true,
      github: true,
      pornhub: true,
      wordpress: { url: "https://wordpress.com" },
    },
  });
  assert(JSON.stringify(services) === JSON.stringify(["github", "twitter", "wordpress"]), String(services));
});

Deno.test("countCheckedServices ignores niche keys", () => {
  const n = countCheckedServices({
    email: "a@b.com",
    exists: false,
    services: {
      twitter: false,
      "dominos.fr": false,
      instagram: false,
      pornhub: false,
    },
  });
  assert(n === 2, `checked=${n}`);
});
