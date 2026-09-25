#!/usr/bin/env node
// Prompts Connected/Disconnected once per worktree, then launches vite.
// Connected = real Supabase (default). Disconnected = mock client, no
// network calls (see src/lib/mockSupabase.ts). Choice is written to
// apps/app/.env.local, which is gitignored and per-worktree, so a fresh
// worktree prompts again but an existing one just remembers.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.dirname(__dirname);
const envLocalPath = path.join(appDir, ".env.local");
process.chdir(appDir);
const existing = existsSync(envLocalPath) ? readFileSync(envLocalPath, "utf8") : "";

async function promptMode() {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise((resolve) => {
        rl.question("Dev server mode — Connected or Disconnected? [C/d]: ", resolve);
    });
    rl.close();
    return answer.trim().toLowerCase().startsWith("d") ? "disconnected" : "connected";
}

async function ensureDevMode() {
    // Check if VITE_DEV_MODE already exists in .env.local
    if (existing.includes("VITE_DEV_MODE=")) {
        return; // Already set, don't prompt again
    }

    const mode = await promptMode();
    const separator = existing && !existing.endsWith("\n") ? "\n" : "";
    writeFileSync(envLocalPath, `${existing}${separator}VITE_DEV_MODE=${mode}\n`);
    console.log(
        `[dev-gate] Saved VITE_DEV_MODE=${mode} to apps/app/.env.local. ` +
            "Edit that line (or delete it) and restart to change later.",
    );
    return mode;
}

await ensureDevMode();

const vite = spawn("pnpm", ["exec", "vite", ...process.argv.slice(2)], { stdio: "inherit" });
vite.on("exit", (code) => process.exit(code ?? 0));
