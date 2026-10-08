---
id: decision-10
title: Agent-first DX contract
date: '2026-10-08 10:28'
status: proposed
---
## Context

Lumen targets the AI-coding era. Coding agents must find it intuitive. In practice that means:
- They get it right on the first attempt.
- They can find version-correct docs offline.
- They understand failures without a human in the loop.

Frameworks fail agents in predictable ways:
- docs that don't match the installed version;
- several equivalent ways to do one thing;
- silent footguns, such as stale closures or reactivity lost through destructuring;
- prose-only error messages.

## Decision

Lumen commits to an agent-facing contract, which is tested in the same way as the API.

1. **One obvious way.** A small surface of about 25 core exports. Alternatives are lint errors, not documented options.
2. **Docs inside the package.** `lumen/docs/**/*.md` always matches the installed version.
   - `create-lumen` writes `AGENTS.md`, plus a `CLAUDE.md` that references it, pointing agents at the local docs.
   - `lumen docs <topic>` prints them.
   - The website publishes `llms.txt` and `llms-full.txt`.
   - Every concept page follows the same structure: concept, API, minimal example, common mistakes, then related diagnostics.
3. **Stable diagnostics.**
   - Every diagnostic has a permanent `LUMxxxx` code, with a message, span, help text, optional fixes and a docs URL.
   - `lumen explain <code>` prints the long-form explanation.
   - Every CLI command supports `--format json` and returns meaningful exit codes.
4. **MCP server (`lumen mcp`).** Tools: `docs_search`, `docs_get`, `check`, `routes`, `components`, `compile`, `render`, `dev_logs`.
5. **Skill bundle and AGENTS.md snippet.** `lumen agents init` installs both.
6. **Agent eval suite.**
   - A fixed set of tasks is run with real coding agents in CI on every release candidate.
   - Metrics: first-attempt `lumen check` pass rate, task success, and tokens used.
   - A regression blocks the release, the same as a performance regression.
7. **Deterministic output and upgrades.**
   - Hashes and codegen are stable, so diffs stay reviewable.
   - `lumen upgrade` applies codemods for breaking changes.

## Consequences

- Docs, diagnostics and evals are release-blocking work, not afterthoughts. The roadmap gives them owners (Beacon) from the first milestone.
- The docs site and the in-package docs share one source.
- A diagnostic code can never be reused, even after the diagnostic is retired.

