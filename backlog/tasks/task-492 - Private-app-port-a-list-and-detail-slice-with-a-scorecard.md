---
id: TASK-492
title: 'Private app: port a list and detail slice, with a scorecard'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-20 21:23'
updated_date: '2026-10-23 08:22'
labels: []
milestone: m-13
dependencies:
  - TASK-485
priority: medium
ordinal: 488000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
decision-70: port a list and detail slice of one of the author's private React Router and Tailwind apps to Lumiose with scoped CSS, on npm lumiose, in a private folder next to that app (like the itsjavi.com port). The list keeps its search, filters and sort in the URL; React-only libraries are replaced with Lumiose code. Record the scorecard in doc-11 without naming the app or describing its code.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both pages work end to end with the same data and URLs
- [x] #2 doc-11 holds the scorecard (stacks and numbers only); gaps become tasks
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23: Nova took this over from Lux (assigned by Lux as a worker).

Nova (2026-10-23): ported on lumiose 0.5.0 from npm (create-lumiose ssr template) in a private local folder (local git, no remote). Both pages are server routes on the Node adapter, as the original renders them per request (the query picks language, filters, view and sort). The list is one client:load island whose children slot carries the server-rendered results; once hydrated it fetches a JSON endpoint with the list's fields and swaps in a virtual grid or a virtual table. URL state goes through searchParams() with shallow updates. The detail page has one island (two small header controls) and a client:visible gallery dialog; its graph popovers are native popovers. Data comes from the same public data package on the server, as the original's does. Parity: 14 screenshot pairs at 0.03-0.3% (1.4-1.8% on the grouped view), 11/11 behaviour checks. Scorecard in doc-11; new gaps TASK-521 to TASK-525, notes added to TASK-282 and TASK-290. Ready for Lux to review and commit.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A list and detail slice of one of the author's private apps, ported from React Router, Tailwind and a Radix-based kit to Lumiose 0.5.0 from npm in a private local folder: server routes on the Node adapter, one list island with server-rendered results in its slot, URL state through searchParams, native popovers and dialogs, scoped CSS. Parity: 14 screenshot pairs at 0.03-1.8% of pixels, 11/11 behaviour checks. Scorecard in doc-11 (JavaScript per page 390/424 kB -> 22/14 kB, slow-profile interactive 8.4/7.5 s -> 3.6/1.1 s, list interactions about 2x slower). Gaps: TASK-521 to TASK-525.
<!-- SECTION:FINAL_SUMMARY:END -->
