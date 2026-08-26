#!/usr/bin/env python3
"""
Detect production functions drifting from main.

For seven months nothing deployed the edge functions, so every deploy was
someone running the CLI by hand — and a hand deploy ships whatever branch is
checked out. On 2026-08-26 production ran matcher code that was on no shipped
branch for several hours, twice, and nothing anywhere reported it.

Two checks:

  behind  main has commits touching supabase/functions/** or config.toml that
          no successful Deploy Functions run has shipped. A deploy was missed.

  ahead   a function was updated more recently than any successful deploy run.
          Something deployed outside CI — a hand deploy, from an unknown source.

Needs SUPABASE_ACCESS_TOKEN, PROJECT_REF, and gh authenticated.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timezone

WATCHED = ("supabase/functions/", "supabase/config.toml")
AHEAD_GRACE_SECONDS = 1800  # a CI deploy finishes well inside 30 min of its run


def sh(*args: str) -> str:
    return subprocess.run(args, capture_output=True, text=True, check=True).stdout.strip()


def api(path: str):
    req = urllib.request.Request(
        f"https://api.supabase.com/v1{path}",
        headers={
            "Authorization": f"Bearer {os.environ['SUPABASE_ACCESS_TOKEN']}",
            "User-Agent": "vanyshr-ci",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def main() -> int:
    ref = os.environ["PROJECT_REF"]
    repo = os.environ.get("GITHUB_REPOSITORY", "jamesringldr/vanyshr-mono")

    main_sha = sh("git", "rev-parse", "origin/main")

    runs = json.loads(
        sh("gh", "api", f"repos/{repo}/actions/workflows/deploy-functions.yml/runs"
                        "?status=success&branch=main&per_page=1")
    )["workflow_runs"]
    if not runs:
        print("::error::No successful Deploy Functions run has ever completed.")
        return 1

    last = runs[0]
    deployed_sha = last["head_sha"]
    deployed_at = datetime.fromisoformat(last["updated_at"].replace("Z", "+00:00")).timestamp()

    print(f"main            {main_sha[:7]}")
    print(f"last deployed   {deployed_sha[:7]}  (run {last['id']}, {last['updated_at']})")

    problems = []

    # --- behind: undeployed function changes sitting on main ----------------
    if deployed_sha != main_sha:
        changed = sh("git", "diff", "--name-only", deployed_sha, main_sha).splitlines()
        relevant = [f for f in changed if f.startswith(WATCHED)]
        if relevant:
            problems.append(
                "PRODUCTION IS BEHIND MAIN — these are committed but never deployed:\n"
                + "\n".join(f"    {f}" for f in relevant[:20])
            )
        else:
            print("  (main has moved, but not in a way that affects functions)")

    # --- ahead: something deployed outside CI -------------------------------
    fns = api(f"/projects/{ref}/functions")
    local = {
        d for d in os.listdir("supabase/functions")
        if os.path.isdir(f"supabase/functions/{d}") and not d.startswith("_")
    }
    rogue = []
    for f in fns:
        if f["slug"] not in local:
            continue  # from vanyshr-admin or hand-deployed; not ours to police
        updated = f["updated_at"] / 1000
        if updated > deployed_at + AHEAD_GRACE_SECONDS:
            mins = int((updated - deployed_at) // 60)
            rogue.append(f"    {f['slug']} (v{f['version']}, {mins} min after the last CI deploy)")
    if rogue:
        problems.append(
            "DEPLOYED OUTSIDE CI — updated after the last successful run, source unknown:\n"
            + "\n".join(rogue)
        )

    if problems:
        print()
        for p in problems:
            print(f"  {p}")
        print("\n  Fix by merging to main (CI deploys) or re-running Deploy Functions.")
        return 1

    print(f"\n✓ no drift — all {len(local)} functions match main")
    return 0


if __name__ == "__main__":
    sys.exit(main())
