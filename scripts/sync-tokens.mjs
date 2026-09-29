#!/usr/bin/env node
// Syncs the design bible's canonical files into this repo as a read-only
// mirror. Source of truth: jamesringldr/vanyshrdesignsys. Never hand-edit
// the destination files below — re-run this script against a new commit SHA
// instead, so packages/ui/src/styles/tokens.sync.json always proves which
// designsys commit the mirror came from (enforced by .githooks/pre-commit).
//
// Usage: node scripts/sync-tokens.mjs <designsys-commit-sha>

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "jamesringldr/vanyshrdesignsys";
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const FILES = {
  "tokens.css": "packages/ui/src/styles/tokens.css",
  "DESIGN.md": "docs/DESIGN.md",
  "COMPONENTS.md": "docs/COMPONENTS.md",
  "llms.txt": "docs/llms.txt",
};

const sha = process.argv[2];
if (!sha) {
  console.error("Usage: node scripts/sync-tokens.mjs <designsys-commit-sha>");
  process.exit(1);
}

async function fetchAtSha(path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${sha}/${path}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${path} at ${sha}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

const synced = [];
for (const [sourcePath, destRelPath] of Object.entries(FILES)) {
  const content = await fetchAtSha(sourcePath);
  const destPath = join(repoRoot, destRelPath);
  mkdirSync(dirname(destPath), { recursive: true });
  writeFileSync(destPath, content);
  synced.push(destRelPath);
  console.log(`synced ${sourcePath} -> ${destRelPath}`);
}

const syncRecordPath = join(repoRoot, "packages/ui/src/styles/tokens.sync.json");
writeFileSync(
  syncRecordPath,
  JSON.stringify(
    {
      source: REPO,
      sha,
      syncedAt: new Date().toISOString(),
      files: synced,
    },
    null,
    2,
  ) + "\n",
);
console.log(`wrote ${syncRecordPath}`);
