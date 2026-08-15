# pilot-scan Flow — Decision Journal

## Entries (newest first)

### [2026-08-15] — 5173 "no picker / empty risk summary" was local-only; shipped to prod
**What**: James ran himself from the 5173 instance. Profile selector never opened. Risk summary showed "Failed to send a request to the Edge Function" and empty areas. Two stacked causes:

1. **CORS** — `supabase/functions/_shared/cors.ts` allowed `http://localhost:5173` but not `http://127.0.0.1:5173`. supabase-js reports that as a failed Edge Function request. Fixed by adding `127.0.0.1:5173` / `:4173` and `Access-Control-Allow-Methods: POST, OPTIONS`. Redeployed `pilot-scan` + `run-quick-scan`.
2. **Dummy Vite env (the real 5173 killer)** — this worktree has no `apps/app/.env.local`. An earlier agent started Vite as `VITE_SUPABASE_URL=https://example.supabase.co` with a dummy anon key. Even after CORS was live, 5173 still could not hit Vanyshr Production (`skhejbzrfptrusskuqoy`). Vercel/prod already had real keys.

Picker was also never wired on `loading.tsx` (scan error → `picker: none` → auto-nav to empty summary). Wired `QSResultSingleModal` / `QSResultMultipleModal` after animation + settle; `selectGroup` promotes the pick. Risk summary now reads `sessionStorage.pilotScanResult` via `scan-result.ts` (`buildAreas`, Property section, `splitSemi` for previous addresses). `pilot-scan` now returns full member fields (phone/email/aliases/relatives/previous_addresses/profile_url), not just name/address/age.

**Why**: Empty summary looked like a prod data bug. It was the local dummy client + missing picker, not scraper-lab or the hex UI. User confirmed: if local-only, deploy.

**Impact**:
- Shipped: `dev/pilot-scan-ui` → `staging` (`84d68db`) → `main` (`8f73263`, Vercel production success). Live: https://app.vanyshr.com/pilot-scan
- Edge Functions already on prod project from this session. `/` and `/quick-scan` redirect to `/pilot-scan`.
- 5173 still broken until someone copies `Vanyshr-mono/apps/app/.env.local` into this worktree and restarts Vite **without** dummy keys. Do not restart with `example.supabase.co`.
- Lab vs mono stay separate remotes. Path A (lab HTTP on serv-01 Funnel) is live; do not git-merge lab into mono. Token was pasted in chat — rotate later.
- Local dummy Vite (5173) and `RUN_QUICKSCAN_SERVICE.sh` uvicorn killed on 2026-08-15 leave.

Related commits: `09e0b0d` vanishing PII intro, `7605e9f` restore Phase1 types, `d851e97` wire scraper-lab, `04dab5e` picker + live risk-summary.

---

### [2026-08-08] — Sandbox Created
**What**: Initialized `flow-pilot-scan` feature sandbox
**Why**: Establish isolated development context for pilot flow variant
**Impact**: Ready to begin implementation; context loaded for agent work

---

## Template for new entries:
```
### {ISO8601 date} — {Decision/Finding}
**What**: 
**Why**: 
**Impact**: 
```

**How to log**:
1. Append entries here as development progresses
2. Include decision rationale and impact on scope/timeline
3. Link related findings (cross-reference other entries or sandbox files)
4. Keep entries concise (2-3 sentences each)
