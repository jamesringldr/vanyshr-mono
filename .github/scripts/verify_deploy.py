#!/usr/bin/env python3
"""
Assert the deploy actually landed, rather than trusting an exit code.

`supabase functions deploy` exiting 0 is a claim. This reads the project's
function list back and fails unless every function in supabase/functions/ was
updated within FRESH_SECONDS — which is what proves this run redeployed them
and not that they were already there.

Needs SUPABASE_ACCESS_TOKEN and PROJECT_REF in the environment.
"""
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

FRESH_SECONDS = 900  # the deploy step precedes this by well under 15 minutes


def main() -> int:
    ref = os.environ["PROJECT_REF"]
    token = os.environ["SUPABASE_ACCESS_TOKEN"]

    req = urllib.request.Request(
        f"https://api.supabase.com/v1/projects/{ref}/functions",
        headers={"Authorization": f"Bearer {token}", "User-Agent": "vanyshr-ci"},
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        deployed = {f["slug"]: f for f in json.load(r)}

    root = Path("supabase/functions")
    local = sorted(d.name for d in root.iterdir() if d.is_dir() and not d.name.startswith("_"))

    now = time.time()
    missing, stale = [], []
    for slug in local:
        fn = deployed.get(slug)
        if not fn:
            missing.append(slug)
            continue
        age = now - fn["updated_at"] / 1000
        if age > FRESH_SECONDS:
            stale.append((slug, int(age // 60)))

    print(f"{len(local)} function(s) in supabase/functions/")
    if missing:
        print("\nNever reached the project:")
        for s in missing:
            print(f"  ✗ {s}")
    if stale:
        print("\nNot updated by this run — the deploy reported success but skipped them:")
        for s, mins in stale:
            print(f"  ✗ {s} (last updated {mins} min ago)")

    if missing or stale:
        return 1

    print(f"✓ all {len(local)} redeployed by this run")
    # Not pruned, and deliberately so — these come from vanyshr-admin or were
    # deployed by hand, and the deploy step omits --prune to avoid deleting them.
    extra = sorted(set(deployed) - set(local))
    if extra:
        print(f"  ({len(extra)} function(s) in the project but not this repo, left alone: {', '.join(extra)})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
