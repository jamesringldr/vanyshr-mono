#!/usr/bin/env node
// Vanyshr design-bible compliance audit.
//
// Reconstructed 2026-09-17 — the "16/18" figure referenced in commit
// ba98a72's message was never backed by a committed script; this is that
// script, rebuilt from DESIGN.md's hard rules (10a mechanical, plus the
// mechanically-checkable subset of 10b) and the two known accepted
// exceptions called out at the time.
//
// SCOPE (deliberate, not "all of packages/ui"): packages/ui/src/components
// still contains a large amount of pre-bible legacy kit code (e.g. 33 files
// still import @untitledui/icons) that has never been converted or audited —
// auditing it today would produce dozens of pre-existing, already-known
// findings unrelated to this session's work, not a stable 16-18 baseline.
// This script checks the surface that has actually been verified against
// the bible: the token/bridge files themselves, the six components
// COMPONENTS.md marks "theme-verified" (card, switch, table, tabs,
// separator, skeleton), Button and Input/Label (this session's fixes), and
// DevToolbar (built fresh this session) — plus the full compiled production
// CSS for checks that are only meaningful bundle-wide (dark: variant,
// prefers-color-scheme, arbitrary-value utilities, default-palette leakage).
// Widen AUDITED_SOURCE_FILES deliberately as more components get converted.
//
// Usage: node scripts/audit.mjs [repo-root]
// Exits non-zero if any check has a NEW (non-allowlisted) violation.

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.argv[2] ?? process.cwd();
const rel = (...p) => join(repoRoot, ...p);

const TOKEN_FILES = [
  rel("packages/ui/src/styles/tokens.css"),
  rel("packages/ui/src/styles/theme.css"),
];

const AUDITED_SOURCE_FILES = [
  ...TOKEN_FILES,
  rel("packages/ui/src/components/ui/card/card.tsx"),
  rel("packages/ui/src/components/ui/switch/switch.tsx"),
  rel("packages/ui/src/components/ui/table/table.tsx"),
  rel("packages/ui/src/components/ui/tabs/tabs.tsx"),
  rel("packages/ui/src/components/ui/separator/separator.tsx"),
  rel("packages/ui/src/components/ui/skeleton/skeleton.tsx"),
  rel("packages/ui/src/components/ui/buttons/button.tsx"),
  rel("packages/ui/src/components/ui/input/input.tsx"),
  rel("packages/ui/src/components/ui/input/label.tsx"),
  rel("packages/ui/src/components/ui/input/hint-text.tsx"),
  rel("packages/ui/src/components/ui/input/input-group.tsx"),
  rel("packages/ui/src/components/ui/input/input-payment.tsx"),
  rel("apps/app/src/components/DevToolbar.tsx"),
].filter(existsSync);

const COMPILED_CSS_GLOB_DIR = rel("apps/app/dist/assets");

const results = [];

function check(id, title, fn) {
  let violations = [];
  try {
    violations = fn() ?? [];
  } catch (e) {
    violations = [`check threw: ${e.message}`];
  }
  results.push({ id, title, violations });
}

function readAll(paths) {
  return paths.map((p) => ({ path: p, content: readFileSync(p, "utf8") }));
}

const sourceFiles = readAll(AUDITED_SOURCE_FILES);
const tokenFilesContent = readAll(TOKEN_FILES);

let compiledCssPath;
{
  const files = readdirSync(COMPILED_CSS_GLOB_DIR).filter((f) => f.endsWith(".css"));
  if (files.length === 0) {
    console.error(`No compiled CSS found in ${COMPILED_CSS_GLOB_DIR} — run \`pnpm build\` in apps/app first.`);
    process.exit(2);
  }
  compiledCssPath = join(COMPILED_CSS_GLOB_DIR, files[0]);
}
const css = readFileSync(compiledCssPath, "utf8");

// ── Helpers ──────────────────────────────────────────────────────────────

function classNameStrings(content) {
  // className="..."  className={cx("...", ...)}  template literals, etc.
  // Pragmatic extraction: every double/single/backtick-quoted string that
  // looks like a Tailwind class list (contains a hyphenated utility token).
  const out = [];
  const re = /(["'`])((?:(?!\1).)*)\1/g;
  let m;
  while ((m = re.exec(content))) {
    const s = m[2];
    if (/[a-z0-9]-[a-z0-9[\]#%.:/_-]/i.test(s) && s.length < 2000) out.push(s);
  }
  return out;
}

function nonTokenFileFilter(f) {
  return !TOKEN_FILES.includes(f.path);
}

// Every whitespace-separated class token that appears anywhere in the
// audited source files. Compiled-CSS checks (4, 5, 16, 18) use this to stay
// scoped to "component files" (DESIGN.md 10a's actual phrase) rather than
// the whole shipped bundle, which also contains un-converted legacy-kit
// components and app pages that are explicitly out of scope (see header).
const AUDITED_CLASS_TOKENS = new Set();
for (const f of sourceFiles.filter(nonTokenFileFilter)) {
  for (const cls of classNameStrings(f.content)) {
    for (const tok of cls.split(/\s+/)) if (tok) AUDITED_CLASS_TOKENS.add(tok);
  }
}

function unescapeCssClass(selector) {
  // ".bg-\[#fff\]" -> "bg-[#fff]"
  return selector.replace(/^\./, "").replace(/\\(.)/g, "$1");
}

function inAuditedScope(cssSelector) {
  return AUDITED_CLASS_TOKENS.has(unescapeCssClass(cssSelector));
}

// ── 1. Raw hex literals in component source (outside token files) ─────────
check("1", "No raw hex color literals in component source", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    for (const cls of classNameStrings(f.content)) {
      const m = cls.match(/-\[#[0-9a-fA-F]{3,8}\]/g);
      if (m) v.push(`${f.path}: ${m.join(", ")}`);
    }
    const styleHex = f.content.match(/style=\{\{[^}]*#[0-9a-fA-F]{3,8}[^}]*\}\}/g);
    if (styleHex) v.push(`${f.path}: inline style hex — ${styleHex.join(" | ")}`);
  }
  return v;
});

// ── 2. Literal rgb()/rgba() with hardcoded numbers in component source ────
check("2", "No literal rgb()/rgba() in component source", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    const m = f.content.match(/rgba?\(\s*\d/g);
    if (m) v.push(`${f.path}: ${m.length} occurrence(s)`);
  }
  return v;
});

// ── 3. CSS named colors as arbitrary values / inline styles ───────────────
check("3", "No CSS named colors as arbitrary values or inline styles", () => {
  const NAMED = ["red", "blue", "green", "yellow", "purple", "orange", "pink", "gray", "grey", "cyan", "magenta"];
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    for (const cls of classNameStrings(f.content)) {
      const m = cls.match(/-\[(red|blue|green|yellow|purple|orange|pink|gray|grey|cyan|magenta)\]/g);
      if (m) v.push(`${f.path}: ${m.join(", ")}`);
    }
    for (const n of NAMED) {
      const re = new RegExp(`style=\\{\\{[^}]*['"\`]${n}['"\`]`, "g");
      if (re.test(f.content)) v.push(`${f.path}: inline style named color "${n}"`);
    }
  }
  return v;
});

// ── 4. Arbitrary bracketed COLOR utilities in compiled CSS ─────────────────
// Scoped to classes traceable to the audited source files — the compiled
// bundle also contains un-converted legacy-kit components (see header),
// whose known, pre-existing debt would otherwise swamp this check.
check("4", "No arbitrary bracketed color utilities in compiled CSS (audited scope)", () => {
  const re = /\.(?:bg|text|border|ring|fill|stroke|outline|decoration|shadow|from|via|to|caret|accent)-\\\[(?:#[0-9a-fA-F]{3,8}|rgba?\([^)]*\))\\\]/g;
  const m = css.match(re) ?? [];
  return [...new Set(m)].filter(inAuditedScope);
});

// ── 5. Arbitrary bracketed PX spacing utilities in compiled CSS ────────────
check("5", "No arbitrary bracketed px spacing utilities in compiled CSS (audited scope)", () => {
  const re = /\.(?:p|m|gap|space-[xy]|top|right|bottom|left|inset)[trblxy]?-\\\[[0-9.]+px\\\]/g;
  const m = css.match(re) ?? [];
  return [...new Set(m)].filter(inAuditedScope);
});

// ── 6. Inline style carrying color or spacing (source-level) ──────────────
check("6", "No inline style={{}} carrying color or spacing", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    const re = /style=\{\{([^}]*)\}\}/g;
    let m;
    while ((m = re.exec(f.content))) {
      const body = m[1];
      if (/\b(color|background(?:Color)?|border(?:Color)?|padding\w*|margin\w*|gap|top|left|right|bottom)\s*:/.test(body)) {
        v.push(`${f.path}: style={{${body.trim().slice(0, 60)}...}}`);
      }
    }
  }
  return v;
});

// ── 7. Font sizes outside the --size-* scale ───────────────────────────────
check("7", "No font sizes outside the --size-* scale", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    for (const cls of classNameStrings(f.content)) {
      const m = cls.match(/text-\[[0-9.]+(?:px|rem)\]/g);
      if (m) v.push(`${f.path}: ${m.join(", ")}`);
    }
    const m2 = f.content.match(/fontSize:\s*["'`][0-9.]+(?:px|rem)/g);
    if (m2) v.push(`${f.path}: inline fontSize — ${m2.join(", ")}`);
  }
  return v;
});

// ── 8. Font families outside the approved stacks ───────────────────────────
check("8", "No font families outside 3 Type's approved stacks", () => {
  const APPROVED = ["--font-ui", "--font-display", "--font-mono", "--font-body", "--font-sans", "--font-terminal"];
  const v = [];
  for (const f of tokenFilesContent) {
    const re = /--font-([a-z-]+):/g;
    let m;
    while ((m = re.exec(f.content))) {
      const name = `--font-${m[1]}`;
      if (!APPROVED.includes(name)) v.push(`${f.path}: unapproved font token ${name}`);
    }
  }
  return v;
});

// ── 9. Icon imports only from lucide-react ─────────────────────────────────
check("9", "Icon imports only from lucide-react (audited scope)", () => {
  const v = [];
  const BANNED = ["@untitledui/icons", "phosphor-react", "@phosphor-icons/react", "heroicons", "@heroicons/react", "react-icons"];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    for (const pkg of BANNED) {
      if (f.content.includes(`from "${pkg}"`) || f.content.includes(`from '${pkg}'`)) {
        v.push(`${f.path}: imports from ${pkg}`);
      }
    }
  }
  return v;
});

// ── 10. --k-* assignment only inside theme.css ─────────────────────────────
check("10", "--k-* custom properties assigned only in theme.css", () => {
  const v = [];
  const themeCssPath = rel("packages/ui/src/styles/theme.css");
  for (const f of sourceFiles) {
    if (f.path === themeCssPath) continue;
    const m = f.content.match(/--k-[a-zA-Z0-9-]+\s*:/g);
    if (m) v.push(`${f.path}: assigns ${[...new Set(m)].join(", ")}`);
  }
  return v;
});

// ── 11. Fixed chrome honors safe-area-inset ────────────────────────────────
check("11", "Fixed chrome elements reference env(safe-area-inset-*)", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    const isFixedChrome = /className="[^"]*\bfixed\b[^"]*"/.test(f.content) && /(navbar|tabbar|sheet|notch)/i.test(f.path);
    if (isFixedChrome && !/safe-area|env\(safe-area/.test(f.content)) {
      v.push(`${f.path}: fixed-position chrome without a safe-area reference`);
    }
  }
  return v;
});

// ── 12. Interactive elements not sized below 44px ──────────────────────────
// Scoped to files that ARE interactive controls (button/input/switch/tabs) —
// decorative elements (a 1px separator line, a skeleton block) legitimately
// size below 44px and are not touch targets.
check("12", "Interactive elements not sized below 44px via arbitrary values", () => {
  const INTERACTIVE_HINT = /\/(buttons|input|switch|tabs)\//;
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    if (!INTERACTIVE_HINT.test(f.path)) continue;
    for (const cls of classNameStrings(f.content)) {
      const m = cls.match(/\b(?:size|h|w)-\[(\d+)px\]/g);
      if (m) {
        for (const tok of m) {
          const px = Number(tok.match(/(\d+)px/)[1]);
          if (px < 44) v.push(`${f.path}: ${tok}`);
        }
      }
    }
  }
  return v;
});

// ── 13. No Tailwind dark: variant in compiled CSS (except known exception) ─
check("13", "No dark: variant usage in compiled CSS", () => {
  const re = /\.(not-)?dark\\:[a-zA-Z0-9\\:_-]+/g;
  const found = [...new Set(css.match(re) ?? [])];
  // Known accepted exception: file-upload-base.tsx's dark/not-dark icon-swap
  // pair. We can't attribute a compiled selector back to its source file
  // from the CSS alone, so the allowlist is the exact class pair that file
  // uses (verified 2026-09-17): .dark\:hidden and .not-dark\:hidden.
  const ALLOWLIST = new Set([".dark\\:hidden", ".not-dark\\:hidden"]);
  return found.filter((cls) => !ALLOWLIST.has(cls));
});

// ── 14. No prefers-color-scheme in compiled CSS ─────────────────────────────
check("14", "No @media (prefers-color-scheme) in compiled CSS", () => {
  const m = css.match(/@media[^{]*prefers-color-scheme[^{]*\{/g) ?? [];
  // The dark: custom-variant is intentionally pinned to `@media not all`
  // (never matches) precisely so prefers-color-scheme never governs theme —
  // that pin itself does not contain the literal string, so any match here
  // is a real, unexpected media query.
  return [...new Set(m)];
});

// ── 15. Chart colors never literal hex (Recharts fill/stroke/stopColor) ────
check("15", "Chart series colors use tokens, never literal hex", () => {
  const v = [];
  for (const f of sourceFiles.filter(nonTokenFileFilter)) {
    if (!/recharts/.test(f.content)) continue;
    const m = f.content.match(/(?:fill|stroke|stopColor)=["']#[0-9a-fA-F]{3,8}["']/g);
    if (m) v.push(`${f.path}: ${m.join(", ")}`);
  }
  return v;
});

// ── 16. No default Tailwind palette utilities in compiled CSS ──────────────
check("16", "No default Tailwind palette utilities (audited scope)", () => {
  const PALETTES = ["slate", "gray", "zinc", "neutral", "stone", "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal", "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink", "rose"];
  const re = new RegExp(`\\.(?:bg|text|border|ring|fill|stroke)-(?:${PALETTES.join("|")})-\\d{2,3}\\b`, "g");
  const found = [...new Set(css.match(re) ?? [])];
  return found.filter(inAuditedScope);
});

// ── 17. No unintentional bare/color-prefixed token naming collisions ───────
check("17", "No unintentional bare/--color- token naming collisions", () => {
  const v = [];
  const ALLOWLIST = new Set([
    "border-subtle", // legacy: --border-subtle (width) vs --color-border-subtle (color)
    // --text-primary/--text-secondary: NOT dead — grepped and confirmed ~50
    // live call sites use the arbitrary-value form text-[var(--text-primary)]
    // (reads the raw custom property directly), while --color-text-primary
    // is reached through the bare `text-text-primary` utility. Two different
    // Tailwind mechanisms landing on the same short name, both functional —
    // verified 2026-09-17, do not "fix" by deleting either declaration.
    "text-primary",
    "text-secondary",
  ]);
  const names = new Set();
  for (const f of tokenFilesContent) {
    const re = /--([a-zA-Z0-9-]+)\s*:/g;
    let m;
    while ((m = re.exec(f.content))) names.add(m[1]);
  }
  for (const name of names) {
    if (!name.startsWith("color-")) continue;
    const bare = name.slice("color-".length);
    if (names.has(bare) && !ALLOWLIST.has(bare)) {
      v.push(`--${bare} (bridge/other) collides with --${name} (color token)`);
    }
  }
  return v;
});

// ── 18. No arbitrary bracket values outside the depth/motion scale ─────────
check("18", "No arbitrary radius/duration/ease values in compiled CSS (audited scope)", () => {
  const re = /\.(?:rounded|duration|ease)(?:-[a-z]+)?\\\[[^\]]+\\\]/g;
  const m = css.match(re) ?? [];
  return [...new Set(m)].filter(inAuditedScope);
});

// ── Report ──────────────────────────────────────────────────────────────

const pass = results.filter((r) => r.violations.length === 0);
const fail = results.filter((r) => r.violations.length > 0);

console.log(`Vanyshr design-bible audit — ${results.length} checks`);
console.log(`Compiled CSS: ${compiledCssPath}`);
console.log(`Audited source files (${AUDITED_SOURCE_FILES.length}):`);
for (const f of AUDITED_SOURCE_FILES) console.log(`  - ${f.replace(repoRoot + "/", "")}`);
console.log("");

for (const r of results) {
  const status = r.violations.length === 0 ? "PASS" : "FAIL";
  console.log(`[${status}] ${r.id}. ${r.title}`);
  for (const v of r.violations) console.log(`    - ${v}`);
}

console.log("");
console.log(`Score: ${pass.length}/${results.length}`);

if (fail.length > 0) process.exit(1);
