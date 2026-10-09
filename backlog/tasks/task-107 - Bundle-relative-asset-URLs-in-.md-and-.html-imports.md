---
id: TASK-107
title: Bundle relative asset URLs in .md and .html imports
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-08 22:31'
updated_date: '2026-10-09 04:21'
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
- [x] #1 Relative src/href/srcset of img, source, video, audio, a (to non-page files) in .md/.html become Vite asset imports; absolute, protocol and #fragment URLs are untouched
- [x] #2 Works in dev and builds, client and server targets; tests; docs/concepts/content.md updated (remove the status caveat)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-09): lumen_content/src/assets.rs rewrites relative URLs of img src/srcset, source src/srcset, video src/poster, audio src, track src and a href (to files: an extension other than html/htm/xhtml/md) into `import lumenAssetN from "./file?url"` (percent-decoded, deduplicated; fragments appended; srcset parsed per the HTML spec). Absolute, scheme, //, #fragment, ?query URLs, page links, <template> content and SVG are kept. ?url keeps .svg files URLs (not components) and gives the same URL in client and server targets. Tests: unit tests in assets.rs, fixtures assets.md/media.html, vite content.test.ts (dev SSR render resolves /content/photo.png; client and SSR builds emit assets/photo-[hash].png and reference it). No changes outside Halo's area except packages/lumen/src/vite/content.test.ts. Found a general build gap (not specific to content): lumen build does not write assets imported only by server-rendered modules (.stsx too) to dist/client; the HTML has the right fingerprinted URL but the file is missing. Recorded as TASK-126 (Nova).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Relative asset URLs in .md/.html imports (images, srcset, media, track, links to files) are bundled as ?url imports: served by Vite in dev, fingerprinted in builds, for client and server targets, like a .stsx asset import. Docs: concepts/content.md (status caveat removed). Caveat shared with .stsx imports: assets used only by server-rendered pages are not yet copied to dist/client by lumen build (TASK-126).
<!-- SECTION:FINAL_SUMMARY:END -->
