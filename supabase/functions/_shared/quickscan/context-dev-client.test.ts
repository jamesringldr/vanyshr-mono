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
