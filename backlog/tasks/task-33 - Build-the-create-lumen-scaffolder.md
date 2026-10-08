---
id: TASK-33
title: Build the create-lumen scaffolder
status: In Progress
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 16:53'
labels: []
milestone: m-5
dependencies:
  - TASK-77
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 33000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A new project must start agent-ready: AGENTS.md, CLAUDE.md, a skill and a working tsconfig.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 create-lumen offers templates (minimal, ssr, spa, static) that run out of the box
- [x] #2 Generated AGENTS.md (with the .stsx hint and local-docs pointer), a CLAUDE.md referencing it, and a skill bundle; lumen agents init does the same for existing projects
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Agent files in lumen (src/cli/agents, export lumen/agents): AGENTS.md Lumen section between markers, CLAUDE.md referencing @AGENTS.md, .claude/skills/lumen/SKILL.md, .gitattributes line; merge rules for existing files; lumen agents init command.
2. packages/create (create-lumen): templates/{minimal,static,ssr,spa}/src (+ ssr server.ts); generated package.json, tsconfig (tsconfigTemplate, spec §4.7), vite.config.ts with lumen({ mode }) (decision-21), .gitignore, README; then agentsInit().
3. CLI: create-lumen [dir] -t/--template, --name, -y/--yes, --force, --format json, prompts in a TTY; exit 0/1/2.
4. Verify every template from the bin in a temp dir with linked node_modules: lumen check, fmt --check, build, dev (fetch; ssr also posts the form).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (decision-21): create-lumen templates set lumen({ mode }) explicitly (spa / ssr / static).

Beacon: implemented (standalone worker run).
- packages/create: src/{bin,main,scaffold}.ts, templates/{minimal,static,ssr,spa}; package create-lumen (bin create-lumen; deps lumen workspace:*). Generated package.json: scripts dev/build/preview/check/lint/fmt (+ start for ssr), deps lumen + @lumen/adapter-node (ssr; devDep elsewhere for lumen preview), devDeps vite (lumen's peer range), typescript ^7.0.2, oxlint, oxfmt.
- lumen: src/cli/agents/index.ts (exported as lumen/agents; used by create-lumen and lumen agents init), agents.test.ts; main.ts registers 'agents init'. Docs: getting-started (Create a project section, templates table), reference/cli (lumen agents init).
- Verification: packages/create/src/create.test.ts runs node packages/create/src/bin.ts <tmp>/app --template <t> --format json for each template, links node_modules, then lumen check --format json (ok), lumen fmt --check (0), lumen build --format json (prerendered files), lumen dev --format json (GET / 200 with <title>; ssr: POST /guestbook?/sign with Origin → 303 and /api/entries lists the entry). 16 passed, 4 skipped (below). lumen agents tests 3/3.
- BLOCKER for AC #1 (TASK-77, Photon): the lumen() Vite plugin does not take mode/ssr yet (LumenOptions has none, no api.options). So the templates' lumen({ mode: 'server' | 'spa' }) is ignored (every template runs as static: ssr pages are prerendered, so in preview/production the guestbook shows the build-time page) and is a TS2353 error in editors for vite.config.ts. Everything else runs. Next action: when TASK-77 lands, remove the pluginTakesMode guard in packages/create/src/create.test.ts ('routes use the template's default mode', skipped now), run pnpm vitest packages/create, check AC #1 and mark Done.
- Publishing note (TASK-39): create-lumen depends on lumen for lumen/agents and tsconfigTemplate (single source with lumen agents init); that pulls lumen's deps into pnpm create; vendor them at publish time if the install weight matters.
<!-- SECTION:NOTES:END -->
