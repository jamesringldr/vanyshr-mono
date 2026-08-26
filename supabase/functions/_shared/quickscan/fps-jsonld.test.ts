/**
 * FPS summary parse: JSON-LD Person fallback when card-block cards are absent.
 * Run: deno test supabase/functions/_shared/quickscan/fps-jsonld.test.ts
 */
import { parseFpsSummaries } from "./html-scrapers.ts";

function wrapLd(payload: unknown): string {
  return `<!doctype html><html><head>
<script type="application/ld+json">${JSON.stringify(payload)}</script>
</head><body><h1>Are you looking for cards? there are none</h1></body></html>`;
}

const JAMES_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "FastPeopleSearch",
  },
  {
    "@context": "https://schema.org/",
    "@type": "Person",
    "@id": "https://www.fastpeoplesearch.com/james-oehring_id_G3697305023830937972",
    "url": "https://www.fastpeoplesearch.com/james-oehring_id_G3697305023830937972",
    "name": "James Oehring",
    "homeLocation": [
      {
        "@type": "Place",
        "description": "Recent home address for James Oehring",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Cameron",
          "addressRegion": "MO",
          "addressCountry": "US",
        },
      },
      {
        "@type": "Place",
        "description": "Previous address for James Oehring",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Kansas City",
          "addressRegion": "MO",
          "addressCountry": "US",
        },
      },
    ],
    "relatedTo": [
      { "@type": "Person", "name": "Rickilinda Oehring" },
      { "@type": "Person", "name": "Robert Mctarsney" },
      { "@type": "Person", "name": "Albert Mcgee" },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": "James Oehring in Cameron, MO",
  },
];

Deno.test("JSON-LD Person is used when FPS cards are missing", () => {
  const results = parseFpsSummaries(wrapLd(JAMES_LD));
  if (results.length !== 1) throw new Error(`expected 1 person, got ${results.length}`);
  const j = results[0];
  if (j.full_name !== "James Oehring") throw new Error(`name: ${j.full_name}`);
  if (!j.address.includes("Cameron") || !j.address.includes("MO")) {
    throw new Error(`address should be Cameron, MO: ${j.address}`);
  }
  if (!j.profile_url.includes("james-oehring_id_G3697305023830937972")) {
    throw new Error(`profile_url: ${j.profile_url}`);
  }
  if (!(j.relatives || "").includes("Rickilinda Oehring")) {
    throw new Error(`relatives: ${j.relatives}`);
  }
  if (!(j.previous_addresses || "").includes("Kansas City")) {
    throw new Error(`previous_addresses: ${j.previous_addresses}`);
  }
});

Deno.test("Organization / nav JSON-LD without Person yields nothing", () => {
  const results = parseFpsSummaries(wrapLd([
    { "@type": "Organization", "name": "FastPeopleSearch" },
    { "@type": "WebPage", "url": "https://www.fastpeoplesearch.com/name/james-oehring_cameron-mo" },
  ]));
  if (results.length !== 0) throw new Error(`expected 0, got ${results.length}`);
});

Deno.test("bot-check HTML with no JSON-LD Person still yields nothing", () => {
  const html = `<!doctype html><html><head><title>Free People Search</title></head>
<body><h1>Are you human?</h1><p>We've noticed some strange activity from your ip address</p>
<div class="card-block"></div></body></html>`;
  const results = parseFpsSummaries(html);
  if (results.length !== 0) throw new Error(`expected 0, got ${results.length}`);
});
