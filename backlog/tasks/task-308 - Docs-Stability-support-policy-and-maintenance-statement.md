---
id: TASK-308
title: 'Docs: Stability, support policy and maintenance statement'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
updated_date: '2026-10-15 05:17'
labels:
  - docs
milestone: m-11
dependencies: []
priority: high
ordinal: 310000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Publish decision-53 as a page: 0.x may break on any minor release until the first known external production app or 1.0, whichever comes first (the end of decision-47); the 1.0 criteria (M9 and M10 done, the API freeze, 3 external production apps, an external security review); what an external production app is (an app on the opt-in "Used by" list that the Lumiose maintainer does not run; never telemetry); what the freeze covers (exports of lumiose and every lockstep @lumiose/* package, file conventions, config options, CLI commands and flags, the meaning of each LUM code); new APIs after 1.0 ship with an unstable_ prefix; Node.js 24 and later (with the release schedule); browsers covered by Baseline widely available, re-checked each release; and a maintenance statement (who maintains Lumiose, the release cadence, the intent, a second human maintainer as a goal). Add the opt-in "Used by" list with instructions to add an app through a pull request with its URL.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Stability page covers every point of decision-53 listed above
- [x] #2 The Used by list exists on the site with instructions to add an app, and starts empty or with external apps only
- [x] #3 README, the docs index and the site link the Stability page
- [x] #4 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 2): started. Page docs/stability.md under Start here; the Used by list as a section of the site's /showcase page, from apps/web/src/content/used-by.ts (empty), with instructions to add an app by pull request.

Done. docs/stability.md (Start here): before 1.0 (any minor may break; no migration paths until the first external production app or 1.0, then migration paths), external production apps (opt-in Used by list by pull request, not run by the maintainer, never telemetry), the 1.0 criteria (M9 and M10 described by content, the freeze, 3 external apps, an external security review), what the freeze covers (exports of lumiose and the lockstep @lumiose/* packages, file conventions, config options, CLI commands and flags, LUM code meanings; @lumiose/ui from its own 1.0), unstable_ prefix after 1.0, Node.js 24+ with a link to the Node.js release schedule, Baseline widely available re-checked each release, security (links SECURITY.md) and the maintenance statement (Javi Aguilar, itsjavi; no fixed cadence, 0.1 to 0.4 within a week per CHANGELOG; lockstep releases; intent; second maintainer as a goal). Used by: apps/web/src/content/used-by.ts (empty) rendered as the #used-by section of /showcase with PR instructions. Links: docs index (Start here), the CLI reading order, the docs README status note, root README (new Stability section) and packages/lumiose/README.md, site footer (Reference: Stability; See it run: Used by), the landing's stack comparison note. Screenshots: backlog/assets/task-308-stability.png, task-308-used-by.png. Validation: docs:gen, docs:check, docs and site content tests, @lumiose/web lumiose check.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stability page publishing decision-53 (0.x rules, 1.0 criteria, the freeze, runtimes, browsers, maintenance statement) and an opt-in Used by list on /showcase; linked from both READMEs, the docs index and the site.
<!-- SECTION:FINAL_SUMMARY:END -->
