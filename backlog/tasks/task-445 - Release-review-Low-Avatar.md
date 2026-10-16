---
id: TASK-445
title: 'Release review, Low: Avatar'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 10:07'
updated_date: '2026-10-16 13:32'
labels:
  - ui
  - review
milestone: m-12
dependencies:
  - TASK-386
priority: low
ordinal: 443000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's release review of @lumiose/ui (TASK-386, 2026-10-16) on main 949db0a3, before the CSS variable rename (TASK-426), so older `--x` names in the text are now `--lu-x`. The Low findings for Avatar. Fix each, or record why it stays.

**Avatar**
- **L8.** No JS: each avatar is named twice (image alt plus fallback); 6 images instead of 3 in the AX tree. Task: "Avatar fallback hidden from AT until the image fails".
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 L8: Avatar fallback hidden from AT until the image fails
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): Halo's in release-review fix batch 2.

2026-10-16 (Halo): claimed (release-review fix batch 2; branch claude/halo-m12c-4d6b9f).

2026-10-16 (Halo): L8 fixed in avatar.css (lu.core): @media (scripting: none) hides the fallback (visibility: hidden, so also out of the accessibility tree) when the avatar has an image; without JS nothing can tell a failed image from a loaded one, so the image (or the browser's broken-image box, with its alt) is the avatar. With JS the existing rules already expose exactly one (the image while loaded, the fallback while loading or failed). e2e 'each avatar with an image is named once' (3 images in the Reviewers list, not 6; the image-less avatar keeps its fallback) fails without the change in dev, build, Firefox and WebKit. avatar.md updated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Without JavaScript an avatar with an image shows and names the image alone; regression test in all engines.
<!-- SECTION:FINAL_SUMMARY:END -->
