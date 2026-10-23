---
id: TASK-499
title: 'SVG imports: two bypasses of the external-reference filter (Low)'
status: Done
assignee:
  - '@Halo'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-23 09:24'
labels:
  - security
dependencies: []
priority: medium
ordinal: 495000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding C2 (TASK-474 L2 not closed): (a) crates/lumiose_svg/src/prefix.rs:154 skips nesting beyond MAX_CSS_DEPTH (64), so 70 nested @media all{ blocks keep url(https://…); (b) emit.rs:312 runs style_text after the filter: li{list-style:\&lt;url(https://h/x)} is one ident for cssparser but is emitted as \\3c url(…), a url token for browsers. Chromium, Firefox and WebKit all requested both URLs. Impact: an imported icon can beacon viewers; no script.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both inputs lose their external url() (tests/security.rs and the fuzz invariant)
- [x] #2 At the depth limit the block is dropped or the import fails, as check_depth does
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-23 (Halo): reproduced both inputs of the delta review in crates/lumiose_svg/tests/security.rs (both kept their url()). Fixes: (a) prefix.rs: a block nested past MAX_CSS_DEPTH (64) is emptied, `{…}` becoming `{}` (closed even when the text ends inside it), so what the filter does not read never reaches the page (fail closed); (b) emit.rs: the `<style>` text is escaped first, an escape as one unit (`\<` becomes `\3c `, not `\\3c `), and the filter then reads the escaped text, the one the page gets.

Writing the reference invariant (tests/support/invariants.rs, renamed from animations.rs, shared with the svg_component fuzz target: it reads the emitted component with cssparser) found more fail-open spots, fixed in the same pass: URLs in selectors and at-rule preludes (selectors now read blocks of every kind), bad URLs, a `url("#…")` followed by modifiers, a URL nested in `image-set()` (`cross-fade(url(…))`), and `@namespace` preludes below the top level (only the top-level one is exempt).

Tests: css_nested_past_the_depth_limit_loses_its_content, markup_escapes_cannot_hide_a_url, urls_go_in_every_context_but_a_namespace_prelude, and a property test (4000 random CSS strings in `<style>` and `style=`; 200 000 once in release, green). Golden fixtures unchanged.

Fuzz: the target's #[path] had been stale since TASK-484 moved fuzz/ to crates/fuzz/ (it pointed at crates/crates/…), so svg_component did not build; fixed. The fuzz crate gets cssparser =0.37.0 (lumiose_svg's version); its Cargo.lock also picks up the 0.5.0 versions of the path crates. Not run under cargo-fuzz (no nightly toolchain here): `cargo check` of every fuzz bin on stable, clippy -D warnings of svg_component, and an uninstrumented libFuzzer run over the fixtures and both inputs passed. The nightly fuzz workflow is the real run.

Validation: cargo test -p lumiose_svg, cargo fmt --check (both workspaces), cargo clippy -p lumiose_svg --all-targets -- -D warnings, pnpm build:compiler, lumiose docs:gen and docs:check. Docs: concepts/svg.md, concepts/security.md, crate docs.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
SVG imports fail closed on the two bypasses: CSS nested past 64 levels loses its content, and the external-reference filter reads the `<style>` text as emitted, escapes as one unit. A shared invariant (security tests and the svg_component fuzz target, whose stale path is fixed) checks that no emitted CSS or href loads anything from outside the file; it found and closed URLs in selectors and preludes, bad URLs, url() modifiers and URLs nested in image-set().
<!-- SECTION:FINAL_SUMMARY:END -->
