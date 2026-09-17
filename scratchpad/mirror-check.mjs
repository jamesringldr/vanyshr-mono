#!/usr/bin/env node
// Verifies packages/ui/src/styles/tokens.css stays in sync with its docs
// mirrors (DESIGN.md's fenced css block, tokens.json). Read-only, no writes.
// Usage: node mirror-check.mjs <repo-root>

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.argv[2] ?? process.cwd();
const tokensCssPath = join(repoRoot, "packages/ui/src/styles/tokens.css");
const designMdPath = join(repoRoot, "docs/DESIGN.md");
const tokensJsonPath = join(repoRoot, "docs/tokens.json");

function extractBlock(css, selector) {
  const re = new RegExp(`${selector}\\s*\\{`, "g");
  const m = re.exec(css);
  if (!m) return null;
  let depth = 1;
  let i = m.index + m[0].length;
  const start = i;
  while (depth > 0 && i < css.length) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") depth--;
    i++;
  }
  return css.slice(start, i - 1);
}

function extractProps(block) {
  const props = new Map();
  if (!block) return props;
  const re = /--([a-zA-Z0-9-]+):\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block))) {
    props.set(m[1], m[2].trim());
  }
  return props;
}

function extractCssFence(md) {
  const m = md.match(/```css\n([\s\S]*?)\n```/);
  return m ? m[1] : "";
}

let failures = [];
let checks = 0;

const tokensCss = readFileSync(tokensCssPath, "utf8");
const designMd = readFileSync(designMdPath, "utf8");
const tokensJson = JSON.parse(readFileSync(tokensJsonPath, "utf8"));

const cssRoot = extractProps(extractBlock(tokensCss, ":root"));
const cssLight = extractProps(extractBlock(tokensCss, "\\.light"));

const fence = extractCssFence(designMd);
const mdRoot = extractProps(extractBlock(fence, ":root"));
const mdLight = extractProps(extractBlock(fence, "\\.light"));

// 1. Every prop DESIGN.md's mirror declares must match tokens.css's value exactly.
for (const [scopeName, mdProps, cssProps] of [
  ["root", mdRoot, cssRoot],
  ["light", mdLight, cssLight],
]) {
  for (const [name, mdVal] of mdProps) {
    checks++;
    if (!cssProps.has(name)) {
      failures.push(`DESIGN.md ${scopeName} declares --${name} but tokens.css ${scopeName} does not`);
      continue;
    }
    const cssVal = cssProps.get(name);
    if (cssVal !== mdVal) {
      failures.push(`${scopeName} --${name}: tokens.css="${cssVal}" DESIGN.md="${mdVal}"`);
    }
  }
}

// 2. tokens.json color tokens (dark/:root mirror) must match tokens.css :root,
// for direct hex/literal values (skip {color.foo} references).
for (const [name, entry] of Object.entries(tokensJson.color ?? {})) {
  if (typeof entry.$value !== "string" || entry.$value.startsWith("{")) continue;
  checks++;
  const cssName = "color-" + name; // tokens.json color.<name> === tokens.css --color-<name>
  if (!cssRoot.has(cssName)) {
    failures.push(`tokens.json color.${name} has no tokens.css :root --color-${cssName}`);
    continue;
  }
  const cssVal = cssRoot.get(cssName);
  if (cssVal.toLowerCase() !== entry.$value.toLowerCase()) {
    failures.push(`color.${name}: tokens.css="${cssVal}" tokens.json="${entry.$value}"`);
  }
}

const totalTokensJson = Object.values(tokensJson).reduce((n, cat) => n + Object.keys(cat).length, 0);

console.log(`Checked ${checks} cross-file assertions.`);
console.log(`tokens.json: ${Object.keys(tokensJson.color).length} color tokens, ${totalTokensJson} total.`);
console.log(`tokens.css :root: ${cssRoot.size} custom properties. .light: ${cssLight.size} custom properties.`);

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} mismatch(es):`);
  for (const f of failures) console.log("  - " + f);
  process.exit(1);
} else {
  console.log("\nPASS — tokens.css, DESIGN.md, and tokens.json agree.");
}
