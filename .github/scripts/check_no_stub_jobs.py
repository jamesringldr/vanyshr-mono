#!/usr/bin/env python3
"""
Fail if any workflow job is a placeholder.

Both of this repo's workflows shipped in the initial commit (2026-01-31) with a
single `echo "Add ... steps"` step, and stayed that way until 2026-08-26. An
echo exits 0, so every merge to main painted a green "Deploy Functions" check
in 8-10 seconds having deployed nothing, while docs/CICD.md described the
pipeline as real. Nothing in the system disagreed for seven months.

A job that cannot yet do its work must fail, so it reads as a red X on day one
rather than a green check in month seven.

A job is a stub when it has at least one `run:` step and every one of those is
only echo/true/:/# — setup actions like checkout don't rescue it.
"""
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("pyyaml is required: pip install pyyaml")

# A run step that does no work: only echoes, `true`, `:`, blank lines, comments.
INERT = re.compile(r"^\s*(echo\b.*|true|:|#.*)?\s*$")


def run_steps_are_inert(steps):
    runs = [s["run"] for s in steps if isinstance(s, dict) and "run" in s]
    if not runs:
        return False  # nothing but actions — not the failure mode this guards
    for script in runs:
        for line in str(script).splitlines():
            if not INERT.match(line):
                return False
    return True


def main() -> int:
    root = Path(__file__).resolve().parents[2] / ".github" / "workflows"
    offenders = []

    for wf in sorted(root.glob("*.y*ml")):
        doc = yaml.safe_load(wf.read_text()) or {}
        for job_id, job in (doc.get("jobs") or {}).items():
            if not isinstance(job, dict):
                continue
            steps = job.get("steps") or []
            if run_steps_are_inert(steps):
                offenders.append(f"{wf.name}: job '{job_id}'")

    if offenders:
        print("Placeholder job(s) found — these would report success without doing anything:\n")
        for o in offenders:
            print(f"  ✗ {o}")
        print(
            "\nA job that isn't implemented yet must fail, not echo. Replace the\n"
            "echo with `exit 1` (or the real steps) so it shows red until it works."
        )
        return 1

    print(f"No placeholder jobs. Checked {len(list(root.glob('*.y*ml')))} workflow file(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
