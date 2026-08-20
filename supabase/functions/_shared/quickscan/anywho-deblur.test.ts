/**
 * AnyWho de-blur tests.
 * Run: deno test supabase/functions/_shared/quickscan/anywho-deblur.test.ts
 *
 * Every fixture below is markup copied verbatim from a saved AnyWho
 * full-profile page (Lucas W Clark, Kansas City MO, 2026-08-20). AnyWho hides
 * data with CSS rather than redacting it, so these values are recoverable --
 * and they are the pipeline's primary email source.
 */
import { deblurAnywhoHtml } from "./detail-scrapers.ts";

const strip = (html: string) => html.replace(/<[^>]+>/g, "");

function eq(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("email: hidden local part is restored", () => {
  const real =
    '<span><span>w</span><span data-content="elctola" class="blur-sm before:content-[attr(data-content)]"></span><span>@aol.com</span></span>';
  eq(strip(real), "w@aol.com", "before (what the parser saw)");
  eq(strip(deblurAnywhoHtml(real)), "welctola@aol.com", "after");
});

Deno.test("phone: hidden last four digits are restored", () => {
  const real =
    '<span><span>816263</span><span data-content="0393" class="blur-sm before:content-[attr(data-content)]"></span></span>';
  eq(strip(real), "816263", "before");
  eq(strip(deblurAnywhoHtml(real)), "8162630393", "after");
});

Deno.test("address: hidden street number is restored", () => {
  const real =
    '<span><span data-content="7935" class="blur-sm before:content-[attr(data-content)]"></span><span> Holmes Rd</span></span>, Kansas City, MO, 64131';
  eq(strip(deblurAnywhoHtml(real)), "7935 Holmes Rd, Kansas City, MO, 64131", "after");
});

Deno.test("two hidden fragments in one value", () => {
  const real =
    '<span><span data-content="400" class="blur-sm before:content-[attr(data-content)]"></span><span> E 20th St, Apt </span><span data-content="2117" class="blur-sm before:content-[attr(data-content)]"></span></span>, Kansas City, MO, 64108';
  eq(strip(deblurAnywhoHtml(real)), "400 E 20th St, Apt 2117, Kansas City, MO, 64108", "after");
});

Deno.test("all six emails from the real page survive", () => {
  const cards = [
    ['m', 'onkey1631', '@aol.com'],
    ['w', 'elctola', '@aol.com'],
    ['l', 'clark', '@ntst.com'],
    ['l', 'ucasclark', '@ehawksolutions.com'],
    ['l', 'clark', '@civicplus.com'],
    ['c', 'larkl', '@civicplus.com'],
  ].map(([head, hidden, tail]) =>
    `<span><span>${head}</span><span data-content="${hidden}" class="blur-sm before:content-[attr(data-content)]"></span><span>${tail}</span></span>`
  ).join("");

  const out = strip(deblurAnywhoHtml(cards));
  for (const expected of [
    "monkey1631@aol.com", "welctola@aol.com", "lclark@ntst.com",
    "lucasclark@ehawksolutions.com", "lclark@civicplus.com", "clarkl@civicplus.com",
  ]) {
    if (!out.includes(expected)) throw new Error(`lost ${expected} — got ${out}`);
  }
});

Deno.test("leaves ordinary markup untouched", () => {
  const plain = '<div class="x"><span>Lucas W Clark</span></div>';
  eq(deblurAnywhoHtml(plain), plain, "unchanged");
});

Deno.test("a non-empty span keeps its own text (attribute is decorative there)", () => {
  // Only EMPTY spans carry hidden text; one with content must not be clobbered.
  const withText = '<span data-content="ignored" class="blur-sm">visible</span>';
  eq(strip(deblurAnywhoHtml(withText)), "visible", "kept");
});

Deno.test("empty and malformed input do not throw", () => {
  eq(deblurAnywhoHtml(""), "", "empty");
  eq(deblurAnywhoHtml("<span data-content="), "<span data-content=", "malformed");
});

// ---------------------------------------------------------------------------
// Extractor regressions
//
// The de-blur substitution removes the data-content spans, and parseAnywhoDetail
// USED to reach for those spans directly when reading phones. Adding the
// substitution without updating that loop silently returned zero phones on a
// page that has eight. These pin both halves.
// ---------------------------------------------------------------------------
import { parseAnywhoDetail } from "./detail-scrapers.ts";

const page = (body: string) =>
  `<html><body><h1>Lucas W Clark, 34</h1>${body}</body></html>`;

const blur = (hidden: string) =>
  `<span data-content="${hidden}" class="blur-sm before:content-[attr(data-content)]"></span>`;

Deno.test("phones survive de-blur (the regression this nearly shipped)", () => {
  const html = page(`<div id="phones">
    <div class="show-more-item"><span>816263</span>${blur("0393")}<span>Odessa, MO</span></div>
    <div class="show-more-item"><span>816315</span>${blur("7002")}<span>Kansas City, MO</span></div>
  </div>`);
  const got = parseAnywhoDetail(html).phoneNumbers ?? [];
  if (got.length !== 2) throw new Error(`expected 2 phones, got ${got.length}: ${JSON.stringify(got)}`);
  if (!got.includes("816-263-0393")) throw new Error(`hidden digits lost: ${JSON.stringify(got)}`);
});

Deno.test("email does not absorb the provider label from the next node", () => {
  // textOf() joins adjacent nodes with no separator, so reading the whole card
  // yields "monkey1631@aol.comaol" -- plausible-looking and wrong.
  const html = page(`<div id="emails">
    <div class="show-more-item">
      <div class="text-body-lg font-bold break-all"><span>m</span>${blur("onkey1631")}<span>@aol.com</span></div>
      <div class="text-body-sm"><span>aol</span><span>2 Profiles</span></div>
    </div>
  </div>`);
  const got = parseAnywhoDetail(html).emails ?? [];
  if (!got.includes("monkey1631@aol.com")) {
    throw new Error(`expected monkey1631@aol.com, got ${JSON.stringify(got)}`);
  }
});

Deno.test("every email card is read, not just the first", () => {
  const card = (head: string, hidden: string, tail: string) =>
    `<div class="show-more-item">
       <div><span>${head}</span>${blur(hidden)}<span>${tail}</span></div>
       <div><span>aol</span></div>
     </div>`;
  const html = page(`<div id="emails">
    ${card("m", "onkey1631", "@aol.com")}
    ${card("w", "elctola", "@aol.com")}
    ${card("l", "clark", "@ntst.com")}
  </div>`);
  const got = parseAnywhoDetail(html).emails ?? [];
  if (got.length !== 3) throw new Error(`expected 3, got ${got.length}: ${JSON.stringify(got)}`);
});
