---
id: TASK-308
title: 'Docs: Stability, support policy and maintenance statement'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:02'
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
- [ ] #1 The Stability page covers every point of decision-53 listed above
- [ ] #2 The Used by list exists on the site with instructions to add an app, and starts empty or with external apps only
- [ ] #3 README, the docs index and the site link the Stability page
- [ ] #4 docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
