# Session Recap Log

## 2026-08-15 17:07 CDT

**Focus:** Diagnose empty risk-summary / missing profile picker on local 5173, then ship the live pilot-scan flow to production.

**Context for next agent:** Pilot-scan UI is on production (`main` `8f73263` → https://app.vanyshr.com/pilot-scan). This worktree is `dev/pilot-scan-ui` at `04dab5e` plus the local journal/recap commit. The 5173 failure James hit was **not** a prod data bug. Two causes: CORS missing `127.0.0.1:5173`, and a dummy-env Vite (`VITE_SUPABASE_URL=https://example.supabase.co`) because this worktree has no `apps/app/.env.local`. Dummy Vite + local lab uvicorn were killed on leave. Do not restart 5173 with dummy keys.

**Key decisions / outcomes:**
- Path A stayed: lab owns scrape HTTP (`POST {SCRAPER_LAB_URL}/api/quickscan`, raw `SequenceOutput` not `to_dict()`); mono owns drawer/orchestrator/secrets/deploy. Do not merge lab remotes into mono. Do not delete Camoufox/old scrapers.
- CORS allowlist now includes `127.0.0.1:5173/4173` + `Allow-Methods: POST, OPTIONS`. Prod origin `https://app.vanyshr.com` and `vanyshr-*.vercel.app` were already allowed.
- Profile picker lives on `loading.tsx` after animation + scan settle (`QSResultSingleModal` / `QSResultMultipleModal`). `selectGroup` promotes the picked `dedup_groups` entry.
- Risk summary is live from `sessionStorage.pilotScanResult` via `scan-result.ts` (`buildAreas`, Property category, `splitSemi` so address commas do not explode).
- `pilot-scan` Edge Function returns full member fields (phone, email, aliases, relatives, previous_addresses, profile_url, age_conflict). Redeployed `--no-verify-jwt --use-api` to project `skhejbzrfptrusskuqoy`.
- User: local 5173 only → trust and deploy. Then explicit "push to production." Merged `dev/pilot-scan-ui` → `staging` (`84d68db`) → `main` (`8f73263`). Vercel Production success.
- `/` and `/quick-scan` now route to `/pilot-scan`. Old QuickScan entry inactivated, code not deleted.

**Files touched:**
- `apps/app/src/pages/pilot-scan/loading.tsx` — invoke `pilot-scan`, show picker, persist selected group
- `apps/app/src/pages/pilot-scan/scan-result.ts` — parse payload, `groupToSummary`, `selectGroup`, `buildAreas`
- `apps/app/src/pages/pilot-scan/risk-summary.tsx` — hex + drawers from live findings, Property + Other matches
- `apps/app/src/pages/pilot-scan/entry.tsx` — vanishing PII field → ghost beat → lift drawer (~1.5s)
- `supabase/functions/_shared/cors.ts` — 127.0.0.1 origins + Allow-Methods
- `supabase/functions/pilot-scan/index.ts` — lastName/city/state + full member payload
- `supabase/functions/_shared/quickscan/phase1-orchestrator.ts` — `tryScraperLab`; fail() if URL set but HTTP/timeout; null only if unset
- `feature_sbox/flow-pilot-scan/journal.md` — this issue
- Restored from `f513db3` (not an ancestor of main): `DedupEngine.ts`, `quickscan-phase1-phase2-models.ts`

**Open questions / blockers:**
- 5173 will fail again until `.env.local` is copied from `Vanyshr-mono/apps/app/.env.local` and Vite is restarted with real `VITE_SUPABASE_*`.
- Scraper-lab token was pasted in chat — rotate later.
- `scan()` / `select_profile()` + full-profile HTTP and Phase 2 FPS house specs are not wired.
- Lab Funnel (`https://serv-01.tail7e9bab.ts.net`) dropped once during lab deploy; they restored. FPS Camoufox still via `/v1/fps/search` on serv-01.

**Next steps:**
- If local 5173 is needed: copy `.env.local` (gitignored), restart Vite without dummy env, hard-refresh, re-run a self scan and confirm picker + filled summary.
- Optional: rotate the leaked lab token; persist selected group beyond sessionStorage; Path B (port scrapers into Edge) only if asked.
- Do not merge `staging`→`main` again unless asked. Do not commit `.env.local` or `pnpm-lock.yaml`.

---
