---
id: TASK-470
title: >-
  Spread: innerHTML and textContent only as explicit props; Toast allowlists
  actionProps
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-16 23:46'
labels:
  - security
milestone: m-12
dependencies: []
priority: high
ordinal: 468000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Prism's pre-release security review (decision-56, 2026-10-17) on main 1d96433f.

**M2. Client spread writes `innerHTML`/`textContent` from an object; the server spread drops them.**
- **Files:**
  - `packages/lumiose/src/dom/spread.ts:9` and `:62` (`PROPERTIES` includes `innerHTML`, `textContent`);
  - `packages/lumiose/src/server/attrs.ts` (`SKIPPED`);
  - @lumiose/ui `toast/toast.tsx:50,361` (`actionProps` spread onto the action button).
  - Owners: Spark (dom) and Beacon (Toast).
- **Attacker:** whoever controls an object an app spreads, for example a notification or realtime JSON payload passed to `toasts.add()` as is.
- **Repro:**
  - Prism (happy-dom): `spread(el, () => JSON.parse('{"innerHTML":"<img src=x id=pwn>"}'))` → `<div><img src="x" id="pwn"></div>`. The server render of the same spread prints only the children.
  - Helper: a Toast whose `actionProps` carry `innerHTML` inserts the `<img>` in an island, while the server renders the plain label.
  - The other guards held: `formaction` is blocked, a lowercase `onclick` is dropped, and the title is escaped.
- **Impact:** DOM XSS in islands, and a hydration mismatch. TypeScript accepts the key, and lint can't see through spreads. React has the same class of issue with `dangerouslySetInnerHTML`, but a plain `innerHTML` string key is far easier to carry in JSON.
- **Fix:** the client spread skips `innerHTML`/`textContent` (explicit props only), as the server does. Toast allowlists the `actionProps` keys (`children`, `onClick`, `class`, `aria-*`, `disabled`).
- **Confidence:** confirmed (DOM insertion; `onerror` not run in a real browser).
- **Task:** "Spread: innerHTML/textContent only as explicit props, on the client too; allowlist Toast actionProps"
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The client spread skips innerHTML and textContent, as the server spread does, with a test
- [ ] #2 Toast's actionProps only pass allowlisted keys, with a test
<!-- AC:END -->
