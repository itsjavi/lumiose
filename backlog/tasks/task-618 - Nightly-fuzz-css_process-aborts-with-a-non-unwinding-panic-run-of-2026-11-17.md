---
id: TASK-618
title: >-
  Nightly fuzz: css_process aborts with a non-unwinding panic (run of
  2026-11-17)
status: To Do
assignee:
  - '@Halo'
created_date: '2026-11-17T17:37:00Z'
labels: []
dependencies: []
references:
  - https://github.com/itsjavi/lumiose/actions/runs/44079590552
ordinal: 610000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The scheduled Fuzz run of 2026-11-17 (commit e2ca19d4, before the redesign commits) failed in the css_process target after about 133,000 executions: "thread caused non-unwinding panic. aborting", libFuzzer deadly signal, exit status 77. The log has no panic message. The input is in the run artifact fuzz-crash-css_process (crash-06df1645a8bbe4fd779aa1ce6d857ce5ad8ecbc6, 439 bytes). TASK-599 fixed an earlier css_process panic; this is a new input.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The crash is reproduced locally from the artifact and minimised
- [ ] #2 The cause is identified: Lumiose code in lumiose_css, or the CSS dependency (then reported upstream and guarded, as TASK-600 did for OXC)
- [ ] #3 The input is added to the fuzz corpus or a regression test, and the css_process target passes a 10 minute run
<!-- AC:END -->
