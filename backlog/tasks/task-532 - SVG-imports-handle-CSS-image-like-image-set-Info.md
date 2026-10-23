---
id: TASK-532
title: 'SVG imports: handle CSS image() like image-set() (Info)'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-23 18:09'
updated_date: '2026-10-23 19:54'
labels:
  - security
dependencies: []
priority: low
ordinal: 525000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.6.0 delta review: crates/lumiose_svg/src/prefix.rs (around 286-293) keeps image("http://…") in CSS. No shipping browser implements image() today, so this is hardening: fail closed like image-set.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An external URL inside image() is removed, with a security test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (session halo-a9eb2b59, 0.6.1 cleanup batch, worktree branch): claimed and started.

Halo: prefix.rs reads image() like image-set()/-webkit-image-set() (is_image_function): one that holds a string, url(), src(), var(), env() or attr() at any depth becomes none; image(red) stays. The reference invariant (tests/support/invariants.rs, shared with the svg_component fuzz target) flags image() with a URL too, and the property test's pieces include image(. New security test image_function_with_a_url_becomes_none (style text and style attribute: a string, IMAGE(ltr ...), var(), nested in cross-fade(), url() in a custom property, and a check that the invariant reports image() with a URL); it fails on the old code. Docs: svg.md, crate docs. Validation as in TASK-533 (same commit).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SVG imports fail closed on CSS image() as on image-set(): an image() holding a URL at any depth becomes none, image(<color>) stays, and the reference invariant checks it. Security test added; svg.md updated. Commit 5f6f238a (with TASK-533).
<!-- SECTION:FINAL_SUMMARY:END -->
