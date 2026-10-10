---
id: TASK-188
title: GitHub link on the website; 'Made with Lumiose' footer link on demo pages
status: Done
assignee:
  - Beacon
created_date: '2026-10-10 02:30'
updated_date: '2026-10-10 02:35'
labels:
  - site
dependencies: []
priority: medium
ordinal: 188000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
User 2026-10-10: add the GitHub repo link (https://github.com/itsjavi/lumiose) on the main site (header and landing), and at the bottom of every published demo page (examples, playground if not already, benchmark viewers, jsfb app) a small footer link back to Lumiose (the site root under the Pages base). Lux authorises edits in the examples and benchmark viewers for this.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GitHub link visible on the landing and header; every published demo has a footer link to the Lumiose site that respects the base path; doesn't clash with each demo's design
- [x] #2 Link crawl clean; screenshots; pushed once at the end
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (2026-10-10): site-kit GitHubLink (icon button matching the theme toggle) in the header actions of apps/web and the playground; GitHub button in the landing hero and in the footer's 'For agents' column. Demos: scripts/site.ts builds each example with PUBLIC_LUMIOSE_SITE=<base>; chiptune (status bar, right end), dotmatrix (its footer's 'Built with Lumiose'), travel journal (footer links) and vite-counter (a small footer) render a 'Made with Lumiose' link only when it is set, styled with each demo's own tokens. Static viewers: the fullstack viewer has a hidden placeholder link that site.ts turns into a link to the base; the jsfb app page links ../../../. Playground already had the site header/footer. Validation: lumiose check on all touched projects, related unit tests (264), build:site --base /lumiose/, crawl 174 URLs 0 broken, Playwright: every demo's link points to /lumiose/ and lands on the site, no page errors. Screenshots: backlog/assets/task-188-{header,landing,chiptune,dotmatrix,journal,counter,fullstack,jsfb-app}.png.
<!-- SECTION:NOTES:END -->
