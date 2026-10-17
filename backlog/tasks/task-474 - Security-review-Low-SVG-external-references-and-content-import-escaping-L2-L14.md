---
id: TASK-474
title: >-
  Security review, Low: SVG external references and content-import escaping (L2,
  L14)
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:10'
labels:
  - security
milestone: m-12
dependencies: []
priority: medium
ordinal: 472000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

- **L2. SVG keeps external resource references.** `<use>`/`<image>`/`<feImage>` `href` with http(s)/data, and `<style>` `@import`/`url()`, survive. A third-party icon then beacons viewers to an external host; outbound requests were observed, no script ran.
  - Fix: decide a policy (same-origin or no external refs for imported icons), or document it and recommend a CSP.
  - Task: "SVG: policy for external resource references in imported icons"

- **L14. Defence in depth in content imports.** `crates/lumiose_content/src/emit.rs` (around 244) escapes only `</` in an SVG `<style>` inside an HTML import, unlike lumiose_svg (`<` and `&`). Content imports are trusted author files by design (raw HTML and `on*` are kept), so this matters only for untrusted content.
  - Fix: match lumiose_svg's escaping; state prominently in content.md that `.md`/`.html` imports must never carry end-user content (there is no runtime sanitizer).

Lux (2026-10-17), a technical decision: imported SVG icons drop external references (http(s) and data `href`s on use, image and feImage, and `@import`/`url()` with an external target in `<style>`). Fragment references (`#id`) are kept. The change is documented in svg.md and security.md and recorded in decision-69, with the reason.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Imported SVGs drop external references and keep fragment references, documented, with tests
- [x] #2 lumiose_content escapes SVG <style> like lumiose_svg, and content.md states that imports must never carry end-user content
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-17): decision-69 implemented, fail closed. An href that is not a fragment is dropped on every element but <a> (use, image, feImage, gradients, patterns, filters, textPath, mpath; relative paths and protocol-relative URLs too, not only http(s) and data); a link's href stays. In CSS (<style>, style and presentation attributes, animation values) a url()/src() whose target is not a fragment becomes none, also behind an escape (\75 rl()); an image-set()/-webkit-image-set() holding a string, url, src, var, env or attr becomes none; @import rules are removed at any level, with or without their ';'. @namespace keeps its URL (it loads nothing). Fragment references keep their prefix. The rewrite lives in prefix.rs (edits instead of insertions). L14: lumiose_content escapes an inline SVG's <style> text like lumiose_svg (< and & as CSS escapes); its new test (crates/lumiose_content/tests/svg.rs) fails on the old code. Docs: svg.md (References outside the file), security.md (SVG imports load nothing; Markdown and HTML imports are trusted author files), content.md (a Trusted files only callout: never end-user content, no runtime sanitizer).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Imported SVGs drop every reference outside the file (non-fragment hrefs but a link's, external url()/src(), image-set() with URLs, @import) and keep #id fragments, per decision-69; lumiose_content escapes SVG <style> text like lumiose_svg; svg.md, security.md and content.md updated, with tests.
<!-- SECTION:FINAL_SUMMARY:END -->
