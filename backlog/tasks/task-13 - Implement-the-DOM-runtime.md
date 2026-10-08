---
id: TASK-13
title: Implement the DOM runtime
status: In Progress
assignee:
  - '@Spark'
created_date: '2026-10-08 12:20'
updated_date: '2026-10-08 13:04'
labels: []
milestone: m-1
dependencies:
  - TASK-6
  - TASK-7
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Compiled client code needs the runtime half of the contract: templates, inserts, attributes, events, lists and branches (spec §6.3).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 template/insert/attribute/class/style/bind/attach/ref helpers implement the contract
- [ ] #2 Document-level event delegation per decision-17, with data slots and island/app boundary walking
- [ ] #3 The keyed list implements prefix/suffix trim, append/remove/clear/swap fast paths and LIS; selector() is O(1); branches are memoised; Portal and Dynamic
- [ ] #4 Unit tests in a DOM environment cover every contract function; the core+dom size budget is checked
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. core: nested lazy owners (components inside lazy rows stay lazy), unwatched hook on trigger nodes (selector key cleanup).
2. dom/hydration.ts: nullable module-level Hydrator hook (template claim + region adoption) for TASK-18.
3. dom/template.ts, writers (attr/prop/class/style), insert regions (text/node/array reconciliation, nested functions), list (trim, append/remove/clear/swap, LIS, lazy row owners, index signals only when render.length > 1), branch, selector, components/props (createComponent, restProps, mergeProps, spread, applyScope), events (document delegation, data slots, boundaries, cancelBubble, batching), bindValue/bindChecked/attach/useRef; async stubs for TASK-17.
4. dom/public.ts: Portal, Dynamic, ref<T>().
5. Tests (happy-dom): every contract function, list property test vs expected order and node identity, delegation, class/style diffing, binds, attach, Portal/Dynamic; contract.test.ts satisfies ClientRuntime.
6. Size script (vite build --lib, min+brotli) and record vs 4.5 kB.
7. pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux (from TASK-42 review):
1. setAttr: for aria-* and enumerated attributes (spellcheck, draggable, contenteditable, translate, autocapitalize?), a boolean false must write "false" rather than remove the attribute. Plain boolean attributes keep the remove-on-false behaviour.
2. bindValue with a number signal (input type=number|range) reads valueAsNumber and writes number values.
3. Event names come from React-style camelCase props lowercased by the compiler (decision-17 amendment).

Lux (from TASK-43): ref<T>() must return JSX.Ref<T> (defined in src/jsx/jsx-runtime.ts, a callable with a type-only marker). The ref prop type checks it.
<!-- SECTION:NOTES:END -->
