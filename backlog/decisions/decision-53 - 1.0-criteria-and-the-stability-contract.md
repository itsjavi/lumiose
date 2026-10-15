---
id: decision-53
title: 1.0 criteria and the stability contract
date: '2026-10-15 04:01'
status: accepted
---
## Context

A skeptical adopter asks why they should bet on a framework that is days old, has one maintainer, ships breaking minors and, by decision-47, gives no migration paths "until real usage is detected", a trigger nobody had defined. Nothing said what 1.0 means, what it freezes, or which runtimes and browsers Lumiose supports. Agreed with the user in a grilling session on 2026-10-15.

## Decision

User decision, 2026-10-15.

- **Before 1.0**, 0.x may break on any minor release. Decision-47 (no migration paths) ends at the first known external production app or at 1.0, whichever comes first; from then on, breaking changes come with a migration path.
- **An external production app** is an app in production on the opt-in "Used by" list (added through a pull request with its URL) that the Lumiose maintainer does not run; the maintainer's own sites, such as itsjavi.com, do not count. Lumiose never collects telemetry.
- **1.0 criteria:** M9 and M10 done, the API freeze, 3 external production apps, and an external security review (decision-56).
- **The freeze** covers everything public: the exports of lumiose and every lockstep @lumiose/* package, file conventions, config options, CLI commands and flags, and the meaning of each LUM diagnostic code. @lumiose/ui is covered from its own 1.0 (decision-54).
- **After 1.0**, new APIs ship with an `unstable_` prefix until a minor release promotes them (React Router's convention). There are no such markers before 1.0.
- **Runtimes:** Node.js 24 and later (Node 22 reaches end of life in April 2027).
- **Browsers:** those covered by Baseline widely available, re-checked each release; newer platform features need a fallback.
- **Published:** a Stability page with a maintenance statement (who maintains Lumiose, the release cadence, the intent; a second human maintainer is a goal, not a 1.0 gate), and a "When not to use Lumiose" page linked from the stack comparison.
- Rejected: a 1.0 gated on a second maintainer, counting the maintainer's own apps, npm downloads as the usage signal, and Next.js-style experimental config flags.

## Consequences

- Decision-47's open trigger ("real usage") is defined here; decision-47 stays in force until then.
- Tasks: TASK-307 (When not to use), TASK-308 (Stability page and Used by list), TASK-310 (external review).
