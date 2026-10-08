---
id: TASK-107
title: Bundle relative asset URLs in .md and .html imports
status: To Do
assignee:
  - '@Halo'
created_date: '2026-10-08 22:31'
labels: []
dependencies:
  - TASK-69
priority: low
ordinal: 107000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-69. Relative URLs in the markup of imported .md/.html files (<img src="./photo.jpg">, ![alt](./photo.jpg), <video>/<source>/<a href> to local files) resolve against the page URL, not the file, and are not bundled. Turn them into imports (asset URLs from Vite, hashed in builds), as Astro does for Markdown images, keeping absolute URLs and fragments as they are.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Relative src/href/srcset of img, source, video, audio, a (to non-page files) in .md/.html become Vite asset imports; absolute, protocol and #fragment URLs are untouched
- [ ] #2 Works in dev and builds, client and server targets; tests; docs/concepts/content.md updated (remove the status caveat)
<!-- AC:END -->
