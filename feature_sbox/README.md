# Feature Sandbox (`feature_sbox/`)

This directory contains feature sandboxes—isolated development environments for building features with complete context for AI agents.

## Structure

Each feature is a subdirectory:

```
feature_sbox/
├── CLAUDE-app.md               # ← Holistic app architecture (all features reference this)
├── README.md                    # ← This file
├── feature-{name}/
│   ├── CLAUDE.md               # Targeted feature context (what agent loads)
│   ├── CLAUDE-app.md           # (Symlink to ../CLAUDE-app.md)
│   ├── journal.md              # Decision journal (append-only)
│   ├── feature_roadmap.md      # Work breakdown & integration checklist
│   ├── README.md               # Feature overview
│   ├── src/                    # Feature implementation
│   ├── tests/                  # Feature tests
│   └── .gitkeep
└── ...
```

## Workflow

### Create a New Feature

```bash
/feature-add
```

This scaffolds a complete feature directory with:
- **CLAUDE.md**: Targeted context for the agent working on this feature
- **CLAUDE-app.md**: Reference link to holistic app context
- **journal.md**: Decision log (append as development progresses)
- **feature_roadmap.md**: Task breakdown & integration checklist
- **README.md**: Feature overview
- **src/** and **tests/**: Empty directories for implementation

### Develop a Feature

1. **Start a new chat** with context: "I'm working on feature `{name}`. Load `feature_sbox/feature-{name}/CLAUDE.md`."
2. **Agent reads CLAUDE.md**: Understands the feature's goal, scope, and success criteria
3. **Agent reads CLAUDE-app.md**: (Once, for architecture reference) Understands integration points
4. **Implement in `src/`**: Code goes here
5. **Test in `tests/`**: Write tests alongside code
6. **Log decisions in `journal.md`**: As you discover constraints or make key decisions
7. **Update `feature_roadmap.md`**: Mark completed tasks, note blockers

### Integrate into Production

When a feature is solid:

1. **Review integration checklist** in `feature_roadmap.md`
2. **Run full tests**: Verify feature tests + app tests pass
3. **Wire into app**: Integrate into `apps/app`, `packages/backend`, etc. per the checklist
4. **End-to-end test**: Test the complete flow in the running app
5. **Merge to staging/main**: Per app workflow (see `../CLAUDE.md`)
6. **Clean up**: Delete the feature directory from `feature_sbox/`

## Key Files for Agents

- **CLAUDE-app.md** (this directory): Holistic app context — read once per feature
- **feature/{name}/CLAUDE.md**: Targeted feature context — primary context for agent
- **feature/{name}/journal.md**: Decision history — refer to for context continuity
- **feature/{name}/feature_roadmap.md**: Task breakdown & progress

## Examples

### Example: Launching a new scraper integration

```bash
$ /feature-add
? Feature name: zaba-integration
? Feature goal: Integrate ZabaSearch as a fallback scraper source
? Feature rationale: FPS has rate limits; ZabaSearch provides fallback coverage for 20% more result volume
? Success criteria:
  - Adapter passes unit tests (100% coverage)
  - Integrates into orchestration workflow
  - End-to-end test: search returns results via ZabaSearch when FPS rate-limits
? Integration scope: packages/services/zaba, packages/services/orchestration
```

Agent now reads:
- `feature_sbox/feature-zaba-integration/CLAUDE.md` (why, how, success criteria)
- `feature_sbox/CLAUDE-app.md` (once, to understand service structure)
- Implements in `feature_sbox/feature-zaba-integration/src/`
- Tests in `feature_sbox/feature-zaba-integration/tests/`
- When ready, integrates into `packages/services/`

## Notes

- **No separate repos**: Features stay in the monorepo; sandbox is just directory isolation
- **Agent context**: Each feature has its own CLAUDE.md; agents don't need to navigate the entire app
- **Living docs**: journal.md and feature_roadmap.md are updated during dev, not after
- **Integration clarity**: Each feature knows exactly which app files it touches (see CLAUDE-app.md)
