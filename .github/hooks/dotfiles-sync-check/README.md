---
name: 'Dotfiles Sync Check'
description: 'Diffs this project''s .github/{agents,skills,hooks} against the canonical ~/ai-dotfiles versions at session start, so the agent knows whether local copies are fresh or stale before relying on them.'
tags: ['dotfiles', 'sync', 'governance', 'session-start']
---

# Dotfiles Sync Check Hook

Runs at session start and prints a short freshness report comparing this
project's `.github/agents`, `.github/skills`, and `.github/hooks` against the
canonical versions in `~/ai-dotfiles`.

## Why this exists

Project `.github/{agents,skills,hooks}` are **copies**, made once by
`provision_project.py` from the canonical `~/ai-dotfiles` catalog. Nothing
keeps them in sync automatically — `~/ai-dotfiles` keeps evolving (new
agents, fixed skills, renamed hooks) while a project's local copies sit
frozen at whatever they were when last provisioned.

Without this check, an agent working in the project has no way to know
whether its local `.github/agents/some-agent.md` is still an accurate
description of that agent, or a stale snapshot from months ago. This hook
makes that visible every session, automatically.

See the "Project vs. Profile — Precedence Rule" section in
`~/ai-dotfiles/docs/AGENT_ROUTING.md` for the full policy this hook supports:
**`~/ai-dotfiles` is always the source of truth for agent/skill/hook
definitions and workflow routing; a project's local copies are a
convenience cache, not authoritative.**

## What it reports

- ✅ **In sync** — local file/folder content hash matches canonical exactly.
- ⚠️ **Stale** — a locally-provisioned item's content differs from canonical
  (someone edited the local copy, or canonical was updated since). Treat
  `~/ai-dotfiles` as authoritative for *how it works*; re-provision to
  refresh the local copy if you want it updated:
  ```bash
  python3 ~/ai-dotfiles/scripts/provision_project.py <project_dir> \
    --agents <names...> --skills <names...> --hooks <names...>
  ```
- ℹ️ **Project-only** — a local item with no canonical counterpart by that
  name. Usually intentional (a project-specific agent/skill/hook that isn't
  part of the general catalog) — just worth a quick glance to confirm it's
  not an accidental leftover or an unintentional name collision with an
  unrelated canonical item.

Items that exist in `~/ai-dotfiles` but were never provisioned into this
project are **not** reported — projects intentionally use a curated subset
of the full catalog (135 agents / 126 skills), so reporting every
non-provisioned item would be pure noise.

## Installation

Already installed if you're reading this from a project's
`.github/hooks/dotfiles-sync-check/` — it was provisioned via:
```bash
python3 ~/ai-dotfiles/scripts/provision_project.py <project_dir> --hooks dotfiles-sync-check
```

To add manually elsewhere:
```bash
cp -r ~/ai-dotfiles/copilot-hooks/dotfiles-sync-check .github/hooks/
```

## Requirements

- `~/ai-dotfiles` cloned locally (checks are skipped harmlessly if absent —
  e.g. on a CI runner or a fresh machine that hasn't set up dotfiles yet).
- `python3` on `PATH`.
