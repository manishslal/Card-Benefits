#!/bin/bash
# dotfiles-sync-check — SessionStart hook.
#
# Diffs this project's .github/{agents,skills,hooks} against the canonical
# versions in ~/ai-dotfiles and prints a short freshness report so the agent
# (and any human watching the terminal) knows whether the local copies are
# still trustworthy or have drifted from the profile-level source of truth.
#
# This is a project-level reinforcement of the same check that already runs
# via the profile-level SessionStart hook (~/.claude/settings.json,
# ~/.copilot/hooks/, ~/.gemini/settings.json -> scripts/session_start.py).
# It exists here too so the check still fires even in tools/setups where the
# profile-level hook isn't wired, and so `git clone` + open-in-any-tool always
# gets the signal without depending on home-directory hook config.

set -euo pipefail

# Hooks receive JSON on stdin; we don't need it, but must consume it.
cat > /dev/null || true

SCRIPT="$HOME/ai-dotfiles/scripts/check_project_sync.py"
if [[ ! -f "$SCRIPT" ]]; then
  # ~/ai-dotfiles not present on this machine (e.g. CI runner, fresh clone
  # without the dotfiles repo set up yet) - nothing to check, exit quietly.
  exit 0
fi

REPORT="$(python3 "$SCRIPT" "$(pwd)" 2>/dev/null || true)"
if [[ -n "$REPORT" ]]; then
  # Emit as Claude/Gemini-style hookSpecificOutput so it's injected as context
  # (not just printed to a terminal nobody's watching in non-interactive runs).
  python3 - "$REPORT" << 'PYEOF'
import json, sys
report = sys.argv[1]
print(json.dumps({"hookSpecificOutput": {"hookEventName": "SessionStart", "additionalContext": report}}))
PYEOF
fi

exit 0
