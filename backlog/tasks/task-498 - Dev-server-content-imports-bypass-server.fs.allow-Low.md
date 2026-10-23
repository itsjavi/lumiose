---
id: TASK-498
title: 'Dev server: content imports bypass server.fs.allow (Low)'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-23 08:49'
labels:
  - security
dependencies: []
priority: medium
ordinal: 494000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding S2, older than this delta (dev only): packages/vite/src/content.ts:107 (#kind) and the load hook at 194-245 read any .md/.html on disk; Vite 8 checks fs.allow only when no plugin loads the id. With --host, GET /@fs/<outside>/notes.md.stsx?import returned the file, and /@fs/<outside>/page.html?import&lumiose-script&index=0&lang.js its inline script. TASK-283 now emits such /@fs URLs itself. Fix: in serve mode refuse files that fail isFileLoadingAllowed(config, file).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In dev, a content import outside server.fs.allow gets 403, as Vite's own files do; a test covers .md and .html
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-23): new packages/vite/src/fs-access.ts assertLoadingAllowed(environment, file): in the dev server client environment, a file that fails Vite isFileLoadingAllowed throws Vite own ERR_DENIED_ID error, which the transform middleware answers with its 403 (file and allow list). Server environments and builds are not checked, as in Vite (its in-process server transport skips fs checks). Content (content.ts) checks the source .md/.html in the module, frontmatter and script loads; content files that an app module imports (resolveId with an importer) stay loadable outside fs.allow, as Vite safeModulePaths does for imported modules (a linked package). The style-module load in index.ts (`?lumiose&type=style&lang.css`) had the same gap for .stsx and content modules and is checked too. Test: content.test.ts requests 7 URLs outside fs.allow (md module, frontmatter, md CSS, html module, html scripts, inline script, .stsx CSS) and gets 403 without the content (red before the fix: 200); an imported file outside still loads (200) and SSR still reads it. Docs: concepts/content.md status note.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In dev, content imports (.md/.html modules, frontmatter, scripts) and style modules outside server.fs.allow now get Vite 403, unless the app imports them, as for Vite own files. Builds and server environments are unchanged. Tested in content.test.ts; docs in concepts/content.md.
<!-- SECTION:FINAL_SUMMARY:END -->
