---
id: TASK-34
title: Implement the MCP server
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:21'
updated_date: '2026-10-08 22:09'
labels: []
milestone: m-5
dependencies:
  - TASK-28
  - TASK-32
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 34000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agents work best with direct, structured access to docs, diagnostics and project structure (decision-10).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumen mcp exposes docs_search, docs_get, check, routes, components, compile, render, dev_logs
- [x] #2 Tested with an MCP client
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Deps: @modelcontextprotocol/sdk (v1, as instructed) + zod in packages/lumen (deps lock).
2. src/cli/mcp/: index.ts (createLumenMcpServer + mcpCommand on stdio), dev.ts (in-process dev server session for render, Vite logger + console captured for dev_logs), source.ts (compile + components meta with props parameter extraction).
3. Reuse docs/index.ts (loadDocs/resolveTopic/searchDocs), check(), listRoutes(), compileWithModules/ModuleHost, createDevServer (read-only use of Nova's app layer).
4. CheckDiagnostic gains optional fix (line/column edits) from compiler fixes; also in lumen check --format json.
5. Register 'mcp' in cli/main.ts (lazy import).
6. Tests with the SDK client: InMemoryTransport for all tools/resources, StdioClientTransport against the real bin.
7. Docs: reference/mcp.md (+ registration for Claude Code, Codex, .mcp.json, Cursor, VS Code), cli.md, README index/status, AGENTS.md section + skill mention; regen llms.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (checkpoint): claimed and released before any work; nothing changed. Next: add @modelcontextprotocol/sdk to packages/lumen (not installed yet), implement lumen mcp in packages/lumen/src/cli/mcp/ reusing docs/index.ts (loadDocs, resolveTopic, searchDocs), check(), listRoutes() (cli/routes.ts), compile via @lumen/compiler, render via createDevServer; register 'mcp' in cli/main.ts COMMANDS; Vitest with the SDK client.

Beacon: SDK choice: kept @modelcontextprotocol/sdk v1 (as instructed); v2's split @modelcontextprotocol/server is lighter (no express/hono) and could replace it later. render starts createDevServer({ port: 0, host: 127.0.0.1, customLogger }) lazily; console.* of app code is routed to stderr + dev_logs so stdout stays the protocol. In-flight tool calls finish before shutdown on stdin end. Smoke-tested over stdio on examples/ssr-bookshelf (routes + render /: 200).

Evidence: AC1 — lumen mcp registers docs_search, docs_get, check, routes, components, compile, render, dev_logs (+ resources lumen://docs/{+topic}, lumen://routes). AC2 — src/cli/mcp/mcp.test.ts: 10 tests with the SDK Client (InMemoryTransport for every tool/resource incl. check fix edits, components props/islands/scopes, compile client/server/css, render / and an endpoint, dev_logs before/after; StdioClientTransport against the real bin incl. render + console capture). Validation: pnpm typecheck green; pnpm test 1013 passed (the one failure was llms freshness from a concurrent docs edit by another agent; docs:check green afterwards); pnpm lint: only error is in packages/lumen/scripts/size-apps.ts (not mine, untracked).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumen mcp: a stdio MCP server (@modelcontextprotocol/sdk) in packages/lumen/src/cli/mcp. Tools: docs_search/docs_get (the lumen docs lookup), check (lumen check diagnostics; optional files filter with projectSummary; diagnostics now carry fix edits with line/column positions, also in lumen check --format json), routes, components (compiler meta: components with props parameter + same-file props type, islands, style scope attributes), compile (client/server JS + CSS + diagnostics, file or source text, imported $ constants folded), render (lazy in-process dev server on 127.0.0.1:0, status/headers/body, redirects not followed), dev_logs (Vite logs + app console output of that dev server; explains when unavailable). Resources: docs pages and the route manifest. stdout is protocol-only (console routed to stderr + dev_logs); in-flight calls finish before shutdown. Docs: reference/mcp.md (registration for Claude Code, Codex, .mcp.json/Cursor, VS Code), cli.md, README index/status; AGENTS.md section and lumen skill mention the MCP server (used by create-lumen and lumen agents init).
<!-- SECTION:FINAL_SUMMARY:END -->
