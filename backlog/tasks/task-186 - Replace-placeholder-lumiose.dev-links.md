---
id: TASK-186
title: Replace placeholder lumiose.dev links
status: To Do
assignee:
  - Beacon
created_date: '2026-10-10 02:29'
updated_date: '2026-10-12 21:45'
labels:
  - docs
dependencies: []
priority: low
ordinal: 186000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Error messages, the contract and docs point to https://lumiose.dev/errors/… as a placeholder. Waiting for the user: keep if they will own lumiose.dev, otherwise point to the GitHub Pages docs (https://itsjavi.com/lumiose/docs/errors/…).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All lumiose.dev references resolve to a live URL
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-12: user decided: point every lumiose.dev link to the GitHub Pages docs (https://itsjavi.com/lumiose/docs/…); switch later if a domain is bought. Beacon owns it across the repo (TS and Rust diagnostics, contract, docs) with Lux's permission.
<!-- SECTION:NOTES:END -->
