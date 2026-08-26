import { isChallengePage } from "./context-dev-client.ts";

Deno.test("bot-check finalUrl is a challenge", () => {
  const url =
    "https://www.fastpeoplesearch.com/bot-check?redirect=https%3A%2F%2Fwww.fastpeoplesearch.com%2Fname%2Fjames-oehring_cameron-mo&blacklist=1";
  if (!isChallengePage("<html></html>", url)) {
    throw new Error("blacklist=1 finalUrl should be a challenge");
  }
});

Deno.test("Are you human + recaptcha is a challenge", () => {
  const html = `<h1>Are you human?</h1><p>We've noticed some strange activity from your ip address</p> re-captcha`;
  if (!isChallengePage(html)) throw new Error("expected challenge");
});

Deno.test("real FPS results page is not a challenge", () => {
  const html = `<title>James Oehring in Cameron, MO</title>
<script type="application/ld+json">{"@type":"Person","name":"James Oehring"}</script>
<div class="card-block"><span class="larger">James Oehring</span></div>`;
  if (isChallengePage(html, "https://www.fastpeoplesearch.com/name/james-oehring_cameron-mo")) {
    throw new Error("results page should not be a challenge");
  }
});

// FPS emits `"@type": "Person"` with a space after the colon. The probe that
// guarded the "security challenge" branch looked for `@type":"person`, which
// never matched real FPS HTML -- so the branch was unguarded and any page
// carrying that phrase was called a challenge regardless of its Person data.
Deno.test("security challenge phrase + real Person JSON-LD is not a challenge", () => {
  const html = `<p>Our security challenge protects this site.</p>
<script type="application/ld+json">{"@context": "https://schema.org", "@type": "Person", "name": "James Oehring"}</script>`;
  if (isChallengePage(html)) {
    throw new Error("page with real Person JSON-LD should not be a challenge");
  }
});

Deno.test("security challenge phrase + array-form Person @type is not a challenge", () => {
  const html = `<p>security challenge</p>
<script type="application/ld+json">{"@type": ["Person", "Thing"], "name": "James Oehring"}</script>`;
  if (isChallengePage(html)) throw new Error("array-form Person should not be a challenge");
});

Deno.test("security challenge with no Person data is still a challenge", () => {
  const html = `<h1>Security Challenge</h1><p>Verifying your browser.</p>`;
  if (!isChallengePage(html)) throw new Error("expected challenge");
});
