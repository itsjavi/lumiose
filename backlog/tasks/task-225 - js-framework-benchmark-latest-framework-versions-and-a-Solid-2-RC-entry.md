---
id: TASK-225
title: 'js-framework-benchmark: latest framework versions and a Solid 2 RC entry'
status: To Do
assignee:
  - Spark
created_date: '2026-10-11 01:43'
labels:
  - benchmark
milestone: m-8
dependencies: []
priority: medium
ordinal: 227000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-41 (user 2026-10-11): benchmark every framework at its latest stable version. The krausest entries are installed from krausest's lockfiles and are behind: react 19.2.0 (latest 19.3.0), solid-js 1.9.3 (1.9.17), svelte 5.42.1 (5.57.2), and vue 3.6.0-rc.5 for Vue Vapor (latest 3.6.0-rc.11; Vapor only ships in the 3.6 RCs, so it stays on the newest RC). Install each entry at its latest version (remix 3.0.0 is current), with versions pinned in the setup and recorded in RESULTS.md. Add a 'solid-2 (RC)' entry on solid-js@next (2.0.0-rc.14) with its matching compiler preset, labelled as a pre-release, next to stable Solid. krausest's published table measured older versions, so label the 'published factor' row with the versions it used, or drop it for entries that changed. Verify every entry builds and completes a smoke run. The full run waits for the quiet-machine measurement wave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every entry is installed at its latest stable version (Vue Vapor at the newest 3.6 RC), pinned, and listed with its version
- [ ] #2 A solid-2 (RC) entry builds and runs, labelled as a pre-release
- [ ] #3 RESULTS.md is clear about which versions krausest's published factors used
<!-- AC:END -->
