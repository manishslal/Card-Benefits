# Copilot Instructions — Card Benefits

> Profile-level agent/skill routing already applies (see `~/ai-dotfiles/docs/AGENT_ROUTING.md`,
> the source of truth for agent/skill/hook definitions). This file covers only what's specific
> to **this** project. A `dotfiles-sync-check` hook runs at session start and flags if this
> project's local `.github/{agents,skills,hooks}` have drifted from canonical.

Next.js (App Router) · TypeScript · Prisma · PostgreSQL · Vitest (unit) · Playwright (e2e) ·
credit-card benefit tracker with an admin dashboard and a cron-driven benefit engine.

## Commands

```bash
npm run dev              # next dev
npm run build            # prisma generate && next build
npm run lint              npm run type-check   # tsc --noEmit
npm run test              npm run test:coverage
npm run test:e2e          npm run test:all      # unit + e2e
npm run prisma:migrate    npm run prisma:studio
npm run db:push           npm run db:reset       # destructive — confirm before running
```

## Agents, skills, hooks

`.github/agents/` (37 agents), `.github/skills/` (frontend-design, theme-factory,
web-artifacts-builder, web-coder, web-design-reviewer, webapp-testing), `.github/hooks/`
(governance-audit, secrets-scanner, session-auto-commit, session-logger, plus
**`pre-commit-secrets`** — a project-specific addition beyond the standard profile hook set,
do not remove it). Full agent/skill routing guidance and decision tree (shared across all
projects): `~/.copilot/copilot-instructions.md`.

For Next.js/React/TypeScript work reach for `expert-react-frontend-engineer.md` or
`next.js-expert.md`; for Prisma/PostgreSQL reach for `postgresql-dba`/`sql-optimization`
(add via `~/ai-dotfiles/scripts/provision_project.py` if not already present locally);
for accessibility, `accessibility.agent.md`; for e2e, `playwright-tester`.

## 🚨 Verify code was actually written, not just specified

This codebase has a documented history (see `.github/specs/archive/`) of agents producing
markdown specifications instead of working `.tsx`/`.ts` implementations, most notably during
"Phase 6C" — a 965-line frontend spec was generated with **zero** corresponding React
components. Before accepting any feature as done:

```
❌ DO NOT ACCEPT: a spec/plan file, TS interfaces with no implementation, "outline" components
✅ VERIFY: the .tsx/.ts files exist and contain real logic · npm run build → 0 errors ·
   npm run test && npm run test:e2e pass · git diff shows actual code, not just docs
```

## Quality gates

- Lint/type-check clean (`npm run lint`, `npm run type-check`)
- Tests pass (`npm run test:all`); no TODO/FIXME in core logic
- Accessibility: WCAG 2.1 AA, keyboard nav, screen-reader compatible (frontend changes)
- Security: no hardcoded secrets (enforced by `pre-commit-secrets` + `secrets-scanner` hooks),
  no OWASP Top 10 issues, dependency audit clean
- DB changes: run `scripts/validate-db-connection.js`-gated commands, never `db:reset`/`db:push
  --force-reset` against anything but a scratch DB

## Branch / commit conventions

```
feature/[type]-[description]   fix/[issue]-[description]   docs/[description]
feat(scope): ...   fix(scope): ...   docs(scope): ...   test(scope): ...   ops(scope): ...
```

## Docs

`README.md`, `DEPLOYMENT_GUIDE.md`, `RUNBOOK.md`, `OPERATIONS_GUIDE.md`,
`ENVIRONMENT_CONFIGURATION.md`, `DATABASE_SAFETY.md`, `CRON_JOB_SETUP.md`,
`MONITORING_SETUP.md`, `SECRETS.md`, `APP_DOCUMENTATION.md` at repo root — kept because they're
current, user-facing, or deployment-relevant. Historical phase-by-phase implementation/QA/
delivery docs (~640 files across the old repo root and `.github/specs/`) have been archived to
`.github/specs/archive/{root-docs,legacy-specs,github-phase-docs,legacy-instructions}/` —
preserved via `git mv` (full history intact), just moved out of the way so they don't clutter
active development or get mistaken for current guidance. `.github/specs/workflows/` has one real
workflow reference file (`feature-standard-pipeline.md`); the modular per-domain workflow files
it used to reference (frontend/backend/database/security/etc.) never actually existed on disk —
use the profile-level routing doc instead of recreating them.
