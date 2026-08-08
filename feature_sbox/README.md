# Feature Sandbox (`feature_sbox/`)

This directory contains work sandboxes—isolated development environments for building features, UI/UX updates, flow variants, or backend changes with complete context for AI agents.

## Structure

Each sandbox is a subdirectory with naming convention `{type}-{name}`:

```
feature_sbox/
├── CLAUDE-app.md                   # ← Holistic app architecture (all sandboxes reference this)
├── README.md                        # ← This file
├── feature-fps-enhanced/           # Backend feature
│   ├── CLAUDE.md                   # Targeted sandbox context (what agent loads)
│   ├── CLAUDE-app.md               # (Reference to ../CLAUDE-app.md)
│   ├── journal.md                  # Decision journal (append-only)
│   ├── feature_roadmap.md          # Work breakdown & integration checklist
│   ├── README.md                   # Sandbox overview
│   ├── src/                        # Implementation
│   ├── tests/                      # Tests
│   └── .gitkeep
├── ui-dark-mode/                   # UI/UX work
│   └── [same structure as above]
├── flow-pilot-quickscan/           # User flow variant
│   └── [same structure as above]
├── backend-convex-migration/       # Infrastructure work
│   └── [same structure as above]
└── ...
```

## Naming Convention

`{type}-{name}` where:
- **type**: `feature` (backend/service), `ui` (page/component), `flow` (user journey variant), `backend` (data/API)
- **name**: slug format describing the specific work

**Examples:**
- `feature-fps-enhanced` — Improve FastPeopleSearch batching
- `ui-dark-mode` — Implement dark theme
- `flow-pilot-quickscan` — Pilot user quickscan flow variant
- `backend-convex-migration` — Convex infrastructure upgrade

## Workflow

### Create a New Sandbox

```bash
/feature-add
```

Prompts for:
- **Type**: `feature`, `ui`, `flow`, or `backend` (inferred from name if not provided)
- **Name**: slug format for the specific work
- **Goal, Rationale, Success Criteria, Integration Scope**: Context for the sandbox

Scaffolds a complete sandbox directory with:
- **CLAUDE.md**: Targeted context for the agent working on this sandbox
- **CLAUDE-app.md**: Reference link to holistic app context
- **journal.md**: Decision log (append as development progresses)
- **feature_roadmap.md**: Task breakdown & integration checklist
- **README.md**: Sandbox overview
- **src/** and **tests/**: Empty directories for implementation

### Develop a Sandbox

1. **`/feature-add` loads context into chat** — CLAUDE.md is automatically printed with full targeted context
2. **Agent reads CLAUDE-app.md**: (Once, for architecture reference) Understands integration points
3. **Implement in `src/`**: Code, components, pages, logic—whatever the sandbox type requires
4. **Test in `tests/`**: Write tests alongside code
5. **Log decisions in `journal.md`**: As you discover constraints or make key decisions
6. **Update `feature_roadmap.md`**: Mark completed tasks, note blockers

### Integrate into Production

When a feature is solid:

1. **Review integration checklist** in `feature_roadmap.md`
2. **Run full tests**: Verify feature tests + app tests pass
3. **Wire into app**: Integrate into `apps/app`, `packages/backend`, etc. per the checklist
4. **End-to-end test**: Test the complete flow in the running app
5. **Merge to staging/main**: Per app workflow (see `../CLAUDE.md`)
6. **Clean up**: Delete the feature directory from `feature_sbox/`

## Key Files for Agents

- **CLAUDE-app.md** (this directory): Holistic app context — read once per sandbox
- **{type}-{name}/CLAUDE.md**: Targeted sandbox context — loaded into chat by `/feature-add`
- **{type}-{name}/journal.md**: Decision history — refer to for context continuity
- **{type}-{name}/feature_roadmap.md**: Task breakdown & progress

## Examples

### Example 1: Backend feature (new scraper integration)

```bash
$ /feature-add
? Sandbox type: feature
? Sandbox name: zaba-integration
? Goal: Integrate ZabaSearch as a fallback scraper source
? Rationale: FPS has rate limits; ZabaSearch provides fallback coverage for 20% more result volume
? Success criteria:
  - Adapter passes unit tests (100% coverage)
  - Integrates into orchestration workflow
  - End-to-end test: search returns results via ZabaSearch when FPS rate-limits
? Integration scope: packages/services/zaba, packages/services/orchestration
```

Creates: `feature_sbox/feature-zaba-integration/` with full context loaded.

### Example 2: UI work (dark mode)

```bash
$ /feature-add
? Sandbox type: ui
? Sandbox name: dark-mode
? Goal: Implement system-aware dark mode across all pages
? Rationale: Users expect dark mode; Tailwind dark: utilities available
? Success criteria:
  - Toggle in header switches theme
  - All pages render correctly in dark mode
  - Preference persists in localStorage
? Integration scope: apps/app/src/components, apps/app/src/pages, apps/app/src/lib
```

Creates: `feature_sbox/ui-dark-mode/` with full context loaded.

### Example 3: Flow variant (pilot user experience)

```bash
$ /feature-add
? Sandbox type: flow
? Sandbox name: pilot-quickscan
? Goal: Create alternate quickscan flow for pilot users (simpler, fewer steps)
? Rationale: Pilot feedback shows current flow is 3-step; simplified 2-step needed for MVP
? Success criteria:
  - Pilot users see simplified flow when logged in
  - All required fields validated
  - Results displayed correctly
  - Toggle in admin panel switches users to pilot flow
? Integration scope: apps/app/src/pages/quick-scan, packages/backend/convex
```

Creates: `feature_sbox/flow-pilot-quickscan/` with full context loaded.

## Notes

- **No separate repos**: All work stays in the monorepo; sandbox is just directory isolation + context scoping
- **Agent context**: `/feature-add` loads the sandbox CLAUDE.md directly into chat; agents don't need to navigate the entire app
- **Type-agnostic**: Same framework works for backend features, UI work, flow variants, and infrastructure—naming tells you what it is
- **Living docs**: journal.md and feature_roadmap.md are updated during dev, not after
- **Integration clarity**: Each sandbox knows exactly which app files it touches (see CLAUDE-app.md)
- **Always ask for type**: If unsure whether something is a feature/ui/flow/backend, `/feature-add` will ask for clarification
