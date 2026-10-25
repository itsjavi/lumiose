---
id: TASK-588
title: stsx dev server serves .stsx files outside server.fs.allow (Low)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 03:02'
updated_date: '2026-10-25 03:14'
labels:
  - security
  - stsx
milestone: m-14
dependencies: []
priority: high
ordinal: 580000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
0.8.0 delta security review finding S1 (dev only, new in @lumiose/stsx; same root cause as TASK-498). Vite 8 checks a dev request's file against server.fs.allow and server.fs.deny only when no plugin loads its id (loadAndTransform). The stsx plugin's resolveId accepts browser and /@fs/ URLs for the virtual `X.stsx.tsx` and `X.stsx.css` ids (packages/stsx/src/index.ts:231-240), and its load hook reads `X.stsx` with readFile and returns the compiled TSX (index.ts:255-275), so nothing checks the file. The dev middleware also rewrites a plain `/…/X.stsx` request to the virtual id (index.ts:221-229).

Attacker: anyone who can reach the dev server (with --host or server.host, on the network). Impact: the compiled source of any `.stsx` file on disk that the developer can read, outside the project and the workspace. Only files ending in `.stsx` are reachable: the virtual id maps back to a `.stsx` path.

Reproduced locally (2026-10-25) with examples/stsx-react's dev server and a file outside the workspace: GET /@fs/<outside>/Secret.stsx returned 200 with the component's code, while /@fs/<outside>/Plain.tsx next to it got Vite's 403. @lumiose/vite's own `.stsx` and style-module URLs got 403 for the same file (TASK-498's assertLoadingAllowed).

Fix: check the file in the dev server's client environment before reading it in load (both virtual ids), as @lumiose/vite's fs-access.ts does: throw Vite's ERR_DENIED_ID so the transform middleware answers 403. Keep `.stsx` files that app modules import (a linked package) loadable, as TASK-498 does, and leave builds and server environments unchecked.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 In dev, a .stsx file outside server.fs.allow gets Vite's 403 for X.stsx, X.stsx.tsx and X.stsx.css URLs, with a test (red before the fix)
- [x] #2 A .stsx file that an app module imports from outside fs.allow still loads, and builds and SSR are unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): taken in the standalone run at the user's request, before the 0.8.0 release (solo takeover of Photon's task).

2026-10-25 (Lux): new packages/stsx/src/fs-access.ts, a copy of @lumiose/vite's TASK-498 guard (the package does not depend on @lumiose/vite): in the dev server's client environment, a file that fails Vite's isFileLoadingAllowed throws Vite's ERR_DENIED_ID, which the transform middleware answers with its 403. The load hook checks the .stsx file of both virtual ids (X.stsx.tsx, X.stsx.css) unless an app module imported it: resolveId records the .stsx files it resolves for an importer, as TASK-498 does for content files. Builds and server environments are unchanged. Test: src/fs-access.test.ts requests X.stsx, ?import, ?raw, X.stsx.tsx, X.stsx.css and ?direct outside fs.allow (403, no content; 200 before the fix), loads App.stsx inside, a linked file the app imports with its CSS (200), and the SSR transform of an outside file. Docs: packages/stsx/docs/installation.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
In dev, the stsx plugin answers Vite's 403 for .stsx files outside server.fs.allow, unless the app imports them, as Vite does for its own files. Builds and SSR are unchanged. Tested in packages/stsx/src/fs-access.test.ts; documented in the STSX installation page.
<!-- SECTION:FINAL_SUMMARY:END -->
