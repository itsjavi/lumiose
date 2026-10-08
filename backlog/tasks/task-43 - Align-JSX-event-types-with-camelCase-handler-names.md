---
id: TASK-43
title: Align JSX event types with camelCase handler names
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:49'
updated_date: '2026-10-08 12:56'
labels: []
milestone: m-1
dependencies:
  - TASK-42
priority: high
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user approved React-style camelCase delegated handlers (decision-17 amendment), but TASK-42 typed handlers as on + Capitalize<eventname> (onKeydown).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Delegated handler props use an explicit camelCase table covering HTMLElementEventMap and SVG events (onKeyDown, onMouseEnter, onPointerDown, onDblClick, onFocusIn, …), where each name lowercases to a real DOM event name; exact-case forms like onKeydown are rejected
- [x] #2 Native on:x props keep exact DOM names and allow custom event names
- [x] #3 ref<T>() typing hole fixed or documented: a ref for the wrong element type is rejected
- [x] #4 Type tests updated and passing on TS 7
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add src/jsx/events.ts: documented const object DelegatedEvents (camelCase suffix -> DOM event name) covering HTMLElementEventMap + SVGElementEventMap names; types derived from it.
2. jsx-runtime.ts: replace on${Capitalize<event>} with mapped props from the table (event type from the element's event map, typed currentTarget); exact-case forms (onKeydown) rejected; keep on:x exact names + on:${string} custom fallback.
3. Fix ref<T>() hole: make ref accept only callbacks whose parameter accepts the element (reject Ref<OtherElement>) or document if TS cannot express it.
4. Update fixtures (accepted + rejected) and a table-consistency check (every value is a key of the DOM event maps, lowercase(key) === value).
5. Validate: jsx type tests, pnpm test, pnpm lint, pnpm typecheck (note unrelated failures).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented (Beacon):
- src/jsx/events.ts: exported const object `delegatedEvents` (`as const satisfies Record<string, keyof HTMLElementEventMap>`), camelCase suffix → DOM event type (`KeyDown: "keydown"`, `DblClick: "dblclick"`, `MouseEnter`, `PointerDown`, `FocusIn`, `BeforeInput`, `ContextMenu`, `AnimationEnd`, `TransitionEnd`, …), 104 entries grouped by kind; header documents the rule (value = key lowercased), consumers (types, compiler mirror, LSP/lint) and exclusions. Also exports DelegatedEventTable / DelegatedEventSuffix / DelegatedEventType types. Covers every event of lib.dom HTMLElementEventMap = SVGElementEventMap = MathMLElementEventMap (TS 7.0.2) except deprecated webkit* aliases (still usable as on:webkit…).
- jsx-runtime.ts: onX props are mapped from the table (`on${K}`), event type looked up in the element's event map, currentTarget typed via JSX.EventHandler. onKeydown/onclick/onDoubleClick/onWebkitAnimationEnd are excess props (TS suggests the camelCase name). on:x unchanged (exact names + on:${string} custom fallback).
- ref hole fixed: new JSX.Ref<T> (also in global JSX via lumen/env) = overloads (element: T): void and (): T | undefined plus a type-only "~element" marker; the ref prop is ((el: T) => void) & { "~element"?: (el: T) => void }, so ref<HTMLInputElement>() on a div or an SVG ref on an HTML element is rejected, while ref<HTMLElement>() on an input and plain callbacks still pass. Contract for Spark: ref<T>() must return JSX.Ref<T> (import type from lumen/jsx-runtime); a plain intersection of the two signatures reopens the hole.
- Tests: .fixtures/events.tsx rewritten (type-level asserts: values are lowercased keys, the three maps match, table covers the maps minus webkit*; accepted camelCase cases with typed events/currentTarget on HTML/SVG/MathML; 16 rejected cases incl. onKeydown/onMouseenter/onDblclick/onPointerdown/onDoubleClick/SVG onKeydown); elements.tsx gains ref cases (accepted Ref<HTMLElement> on input, SVG ref on circle, inputRef() read; rejected inputRef on div, circle ref on div, read is T | undefined); __tests__/events.test.ts checks the runtime object (PascalCase keys, value === key.toLowerCase(), unique). Consumer-project test uses onKeyDown. Every expected error verified (directives stripped) to fire for its reason; mutations of the table (wrong value, missing entry) fail the asserts.
- Open question for Lux/Photon: the table (and the amendment) include non-bubbling events (MouseEnter, Focus, Blur, Scroll, PointerEnter, media events…). Decision-17's body says non-bubbling onX get a compiler diagnostic suggesting on:x; the amendment lists onMouseEnter as a delegated name. Types accept them all; the compiler/runtime must pick capture-phase delegation, direct listeners, or a diagnostic. Not changed here.
- Known limit: element-specific event maps (HTMLMediaElementEventMap encrypted/waitingforkey, video PiP events, body window events) are not onX props; on:x for them falls back to the custom (e: Event) handler.

Validation: TS 7.0.2 fixtures clean; vitest src/jsx 2 files / 4 tests pass; pnpm test 21 files / 225 tests pass; pnpm lint: no findings in src/jsx (only pre-existing warnings in core/app/server); oxfmt --check src/jsx clean; pnpm typecheck passes (packages/lumen Done).
<!-- SECTION:NOTES:END -->
