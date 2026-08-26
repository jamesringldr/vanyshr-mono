import { deduplicateEmails, normalizeEmail } from "./email-extractor.ts";

const CYRILLIC_A = "а"; // renders identically to Latin "a"

// The bug: ja_studly@hotmail.com appeared twice in the confirm/pre-profile
// flow. One copy carried a Cyrillic look-alike, so the two strings differed
// while rendering the same.
Deno.test("look-alike characters fold to their Latin equivalent, not stripped", () => {
  const got = normalizeEmail(`j${CYRILLIC_A}_studly@hotmail.com`);
  if (got !== "ja_studly@hotmail.com") {
    throw new Error(`expected ja_studly@hotmail.com, got ${got}`);
  }
});

Deno.test("stripping instead of folding would corrupt the address", () => {
  // Guards the specific regression: strip-first yields j_studly@hotmail.com,
  // a different and wrong address that would then be stored and enriched.
  if (normalizeEmail(`j${CYRILLIC_A}_studly@hotmail.com`) === "j_studly@hotmail.com") {
    throw new Error("look-alike was stripped rather than folded");
  }
});

Deno.test("all renderings of one address collapse to a single entry", () => {
  const out = deduplicateEmails([
    "ja_studly@hotmail.com",
    `j${CYRILLIC_A}_studly@hotmail.com`,
    "JA_Studly@hotmail.com ",
    "mailto:ja_studly@hotmail.com",
  ]);
  if (out.length !== 1 || out[0] !== "ja_studly@hotmail.com") {
    throw new Error(`expected one entry, got ${JSON.stringify(out)}`);
  }
});

Deno.test("entries without a real address shape are dropped", () => {
  const out = deduplicateEmails(["", "not-an-email", "still@nodot", "ok@example.com"]);
  if (out.join(",") !== "ok@example.com") throw new Error(`got ${JSON.stringify(out)}`);
});
