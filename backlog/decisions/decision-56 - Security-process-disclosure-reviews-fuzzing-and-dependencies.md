---
id: decision-56
title: 'Security process: disclosure, reviews, fuzzing and dependencies'
date: '2026-10-15 04:01'
status: accepted
---
## Context

Lumiose has strong defaults (decision-29: body limits, the Origin check, unsafe URL blocking, sanitizers, strict CSP as an option) and publishes with npm provenance and trusted publishing, but it had no disclosure channel, no supported-versions statement, no review beyond its authors, no fuzzing of the parsers that read untrusted input, and no dependency update process. A skeptic asks who checks code written mostly by agents. Agreed with the user in a grilling session on 2026-10-15.

## Decision

User decision, 2026-10-15.

- **Disclosure:** SECURITY.md with GitHub private vulnerability reporting; the latest minor is supported until 1.0.
- **Reviews:** an agent security review (the app-security-review skill) of the request handler, actions, the Origin check, body parsing, the sanitizers and SSR escaping before each minor release; an external review by an independent reviewer is a 1.0 criterion (decision-53), with reviewer and budget approved by the user.
- **Fuzzing:** cargo-fuzz targets for the compiler, CSS, SVG and content crates, and property-based tests for request body parsing and URL sanitization, run nightly (a short property run stays in `pnpm test`).
- **Dependencies:** a bot (Renovate) opens one grouped update a week and security updates immediately; `pnpm audit` and `cargo audit` run in CI; exact pins stay.
- **New projects** from `create` enable `csp: "strict"`; the framework default stays off.

## Consequences

- Tasks: TASK-309 (SECURITY.md and the review step), TASK-310 (external review), TASK-311, TASK-312 and TASK-313 (fuzzing and property tests), TASK-314 (dependencies), TASK-315 (CSP in templates).
- Enabling private vulnerability reporting and the Renovate app are repository settings the user changes.
