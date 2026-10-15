---
id: TASK-342
title: Follow renamed CSS files from the final build output
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 07:41'
updated_date: '2026-10-15 08:33'
labels:
  - build
  - css
milestone: m-11
dependencies:
  - TASK-335
priority: low
ordinal: 344000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From the TASK-335 StyleX spike, approved by the user on 2026-10-15 as a robustness fix with no new API. Lumiose records each route's CSS files before other plugins finish, so a plugin that renames or rewrites a CSS asset afterwards (StyleX does) leaves pages linking a file that no longer exists. Read each route's CSS from the final build output instead (packages/vite/src/app/production). StyleX stays documented as not supported in .stsx files, and no public option links one stylesheet on every page.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Pages link the CSS files the final build output contains, also when another plugin renamed them
- [x] #2 A test covers a plugin that renames a CSS asset after Lumiose
- [x] #3 concepts/styles.md stays accurate about StyleX
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m11-e57655.

Nova (2026-10-15), implementation (packages/vite/src/app/production, plus BuiltApp in lumiose/src/app/server/app.ts):
- The CSS manifest (@lumiose/vite, Photon area, unchanged) records each stylesheet's CSS assets in the client build's generateBundle. A new plugin of lumioseBuild ("lumiose:css-snapshot", generateBundle order "pre") snapshots the client bundle's CSS (assets with their names, each chunk's viteMetadata.importedCss) before any plugin's generateBundle; the build plugin's new client writeBundle (after every generateBundle) compares it with the final output (css-renames.ts `cssRenames`): a chunk now importing a new file instead (paired in order), else a new asset emitted under the old one's name (StyleX's helper emits with `name` = the old asset's and rewrites importedCss and references, checked in @stylexjs/unplugin 0.19.1 lib/core.js), else the one CSS file added. Pure-CSS entry placeholders are gone by writeBundle (Vite's css-post removes them), so the name rule is what follows Lumiose's stylesheet entries.
- The renames (URLs with base) apply where pages get their CSS: the style tags `lumiose build` computes (merged/inlined files read the renamed sources) and, per request, `BuiltApp.cssRenames` in the server entry (stylesheetLinks maps the CSS manifest's URLs, deduplicated); absent when nothing was renamed. A linked stylesheet the final output lacks (renamed or removed with no evidence) is a build warning.
- The client's hashed-file list (TASK-201) is now collected in writeBundle too, so a file a plugin emitted late gets immutable caching.
- Tests: css-renames.test.ts (per chunk, by name, the single new file, unexplained left out); build.test.ts "links the stylesheets a plugin renamed after Lumiose, as StyleX does": a post-order generateBundle plugin re-emits every CSS asset under its own name (prerendered page: linked shared file + inline style hold the appended rule; server-rendered /live through the server entry), and a second build renames one file under another name without updating chunks (followed as the one new file). Checked that the test fails without the fix (ENOENT on the stale link).
- Not changed: StyleX still documented as not supported (docs/concepts/styles.md updated: renamed files are followed, but the rules sit in one stylesheet so only pages linking it get them; the cssInjectionTarget crash is in Vite's css-post, since the plugin deletes a CSS entry asset before Vite reads it). No public option. Client chunks' own preload lists (Vite's __vitePreload deps) are rewritten by StyleX itself; a plugin that renames without updating chunk code would still leave islands preloading the old name (outside this task).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose build snapshots the client CSS before other plugins' generateBundle hooks and compares it with the written output: a stylesheet another plugin renamed afterwards (StyleX re-emits one under a new hash) is followed by the chunks that import it, the name it was emitted with, or the one new CSS file, in the style tags and per request (BuiltApp.cssRenames); a linked stylesheet the output lacks is a warning. Tested with a StyleX-like renaming plugin; styles.md updated, StyleX still unsupported, no new option.
<!-- SECTION:FINAL_SUMMARY:END -->
