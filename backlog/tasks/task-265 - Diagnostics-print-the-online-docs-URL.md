---
id: TASK-265
title: Diagnostics print the online docs URL
status: To Do
assignee: []
created_date: '2026-10-12 22:03'
labels:
  - diagnostics
  - dx
dependencies: []
priority: low
ordinal: 267000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Proposal from Beacon (TASK-186), needs the user's OK (message shape/DX). app/diagnostics.ts says messages point to 'lumiose docs <code>' until the docs site is online (TASK-122); the site is now online at https://itsjavi.com/lumiose/docs/errors/LUMxxxx (all 50 pages 200). Option: compiler/CLI diagnostics (not the browser runtime, to keep its size) also print the URL. Runtime size cap applies if any browser message changes.
<!-- SECTION:DESCRIPTION:END -->
