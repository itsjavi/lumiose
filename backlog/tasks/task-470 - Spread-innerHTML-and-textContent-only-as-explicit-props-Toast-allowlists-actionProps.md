---
id: TASK-470
title: >-
  Spread: innerHTML and textContent only as explicit props; Toast allowlists
  actionProps
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 23:46'
updated_date: '2026-10-17 00:44'
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
- [x] #1 The client spread skips innerHTML and textContent, as the server spread does, with a test
- [x] #2 Toast's actionProps only pass allowlisted keys, with a test
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-17 (Lux, orchestrator): Beacon's in unattended batch 2. For TASK-470 it may edit packages/lumiose/src/dom (no Spark session is running).

2026-10-17 (Beacon): done.
- packages/lumiose/src/dom/spread.ts: a spread never writes innerHTML or textContent (neither property nor attribute), the same two keys the server's spreadAttrs skips. Test in dom/component.test.ts (a JSON payload with innerHTML, then textContent): fails without the fix.
- Dynamic (dom/public.ts): its props are the element's written props, as the server's element() treats them, so it now applies innerHTML and textContent itself; server/parity.test.ts caught it. Documented: do not spread an untrusted object into Dynamic (reference/components.md, security.md).
- Toast: actionProps pass only children, onClick, class, disabled and aria-* (Prism's list). Server test (toast.test.tsx) and a happy-dom test (toast.dom.test.tsx), both fail without it. The public type stays JSX.IntrinsicElements["button"]; narrowing it to the allowlist is a public-type change, proposed to Lux for doc-10.
- Docs: jsx.md, security.md, web-components.md, reference/jsx.md, toast.md.
- Follow-up: TASK-478. A written innerHTML next to a spread is dropped on both targets, because the compiler routes every prop of an element with a spread through the spread.
Checks: pnpm check, pack smoke, ui-e2e Chromium (1006 passed) and Firefox/WebKit (1018 passed), apps/web (179 passed).
<!-- SECTION:NOTES:END -->
