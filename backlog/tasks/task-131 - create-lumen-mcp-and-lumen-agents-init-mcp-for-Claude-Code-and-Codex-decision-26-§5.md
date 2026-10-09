---
id: TASK-131
title: >-
  create-lumen --mcp and lumen agents init --mcp for Claude Code and Codex
  (decision-26 §5)
status: Done
assignee:
  - Beacon
created_date: '2026-10-09 04:26'
updated_date: '2026-10-09 04:59'
labels:
  - create
  - mcp
  - agents
dependencies: []
priority: low
ordinal: 131000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-26 §5. Verify Codex's current project-level MCP config support from its official docs before choosing the file; otherwise print the codex mcp add command.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 --mcp writes .mcp.json (Claude Code) and the Codex config (or prints the command), using the project's package-manager runner; tests; docs (reference/mcp.md, create docs)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-09): Codex docs (learn.chatgpt.com/docs/extend/mcp, redirected from developers.openai.com/codex/mcp) confirm project-scoped MCP servers in .codex/config.toml as [mcp_servers.<name>] tables (command/args/env/cwd), for trusted projects only. So --mcp writes .mcp.json (mcpServers.lumen, other servers kept) and .codex/config.toml ([mcp_servers.lumen] replaced or appended, subtables included, rest kept), and prints the note that Codex reads it only in trusted projects with the codex mcp add fallback command. Runner: npx lumen mcp / pnpm exec lumen mcp / yarn lumen mcp / bunx lumen mcp; agents init detects it from the lockfile, then package.json packageManager, else npm; create-lumen uses the package manager that ran it. lumen/agents exports mcpCommand, mcpNote, detectPackageManager, PackageManager, MCP_JSON, CODEX_CONFIG. JSON reports carry mcp: { command, args, note }. Tests: agents.test.ts (merge, append, detection, CLI), create.test.ts (--mcp npm/pnpm, none without). Docs: reference/mcp.md (Register it), reference/cli.md, getting-started.md, AGENTS section.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
create-lumen --mcp and lumen agents init --mcp register lumen mcp for Claude Code (.mcp.json) and Codex (.codex/config.toml, trusted projects; codex mcp add fallback printed).
<!-- SECTION:FINAL_SUMMARY:END -->
