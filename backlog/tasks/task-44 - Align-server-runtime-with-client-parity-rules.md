---
id: TASK-44
title: Align server runtime with client parity rules
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-08 13:28'
updated_date: '2026-10-08 13:58'
labels: []
milestone: m-2
dependencies:
  - TASK-13
priority: medium
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The client DOM runtime (TASK-13) settled value-rendering rules that SSR output must match exactly, otherwise hydration mismatches and inconsistent HTML follow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 server text() renders booleans as empty (like client setText)
- [x] #2 server attr() writes aria-* and enumerated attributes (draggable, spellcheck, contenteditable, translate…) as "true"/"false" and removes plain boolean attributes on false (like client setAttr)
- [x] #3 index.server.ts exports server versions of ref, Portal (renders nothing / or into a deferred region: decide and document), and Dynamic
- [x] #4 parity tests compare server output with client DOM serialization for the same inputs
- [x] #5 submit() registers in-flight submissions with the core busy registry (decision-20), once Spark's TASK-17 exposes it
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. server/attrs.ts: attr() writes aria-* and enumerated (Booleanish) attributes as "true"/"false" (duplicated table from dom/attributes.ts BOOLEANISH, guarded by a parity test instead of editing Spark's file); plain boolean attributes keep present/absent. spreadAttrs inherits it; skip property-only indeterminate like client spread.
2. server text(): already renders booleans/nullish as "" (verify with parity test).
3. server/public.ts: server ref() (reads undefined, writes ignored), Portal (renders nothing on the server: content is client-only, rendered when the island mounts/hydrates; children not evaluated), Dynamic (component -> createComponent; string tag -> element with spreadAttrs + children/innerHTML/textContent, void tags self-closing, invalid tag names rejected). Test that lumen and lumen (node) export the same names.
4. server/parity.test.ts (happy-dom): same inputs through server helpers and client writers (setText, setAttr, setClass, setStyle, spread, Dynamic), comparing serialized HTML (server HTML parsed and re-serialized).
5. submit(): register in-flight submissions with core busy registry when TASK-17 exposes it; otherwise leave AC #5 open with a note. Verify decision-20 result semantics (failure resolves, only unexpected errors reject) with tests.
6. pnpm typecheck/test/lint.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (TASK-44 implementation, packages/lumen/src/server + app/actions):
- server/attrs.ts: attr() writes aria-* and enumerated (Booleanish) attributes as "true"/"false"; other booleans stay present/absent. BOOLEANISH is a copy of the client table in dom/attributes.ts (not edited: Spark's file); server/parity.test.ts asserts the client source contains the same regex, so either side changing fails the test. translate/autocapitalize are not in the table on either side (their keywords are yes/no, on/off…), so they behave as plain attributes. classAttr now uses the client token rules (whitespace split, each token once, first-seen order). spreadAttrs: namespaced attributes (xlink:href, xml:lang) are written like the client; only onX/on:/bind:/client: keys are skipped; indeterminate (property-only) is skipped.
- server text()/escape() already rendered booleans and nullish as "": covered by the parity test.
- server/elements.ts, exported from index.server.ts via server/public.ts: ref() reads undefined and ignores writes; Portal renders nothing and does not evaluate its children (DECISION: portal content is client-only; it renders when the enclosing island mounts or hydrates, never in static server output), documented in its JSDoc; Dynamic renders components through createComponent and intrinsic tags as elements (spreadAttrs, innerHTML/textContent then children, void tags without a closing tag, children inside island insert markers, invalid tag names throw). The browser and node entries of lumen now export the same names (Spark's dom/parity.test.ts entry check passes with its pending list removed).
- server/parity.test.ts (happy-dom, 80 tests): the same inputs through the server helpers and the client writers, server HTML parsed and compared as serialized DOM (style normalized to cssText): setText/text/escape (12 values), setAttr/attr (39 names x 11 values), setClass/classAttr (10), setStyle/styleAttr (5), spread/spreadAttrs, DOM properties as initial-state attributes, ref, Portal, Dynamic (component, tag, void, textContent, innerHTML, nothing). Mutation check: dropping draggable from the server table fails 3 tests.
- submit() (decision-20): registers each submission with core beginBusy() (core/internal.ts, landed by Spark in TASK-17) and ends it in finally. Verified result semantics: success/failure resolve, redirects followed, type error rejects with FetchError; FIXED network failures, which rejected with the raw TypeError: now FetchError with status 0 (cause = original error). Aborts via options.signal keep their AbortError (caller-initiated, not unexpected). Tests: busy() true while in flight and false after success and rejection; network/abort cases.
For Spark (not applied): client spread writes innerText as an attribute while the compiler treats it as a property-only name. For TASK-18: the client Dynamic creates intrinsic tags with document.createElement, so the hydrator will not claim the server-rendered element.
Validation: pnpm typecheck OK (3 projects); pnpm test 55 files / 594 tests green; pnpm lint 0 errors, 1 pre-existing warning (app/router/index.ts empty export stub).

Nova: correction: server/parity.test.ts has 78 tests (not 80); ssr.test.ts 19 (+1 booleanish attr test, spread case extended); actions/client.test.ts 17 (+1 network/abort test, busy() assertions).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server runtime aligned with the TASK-13 client parity rules. server/attrs.ts: attr() writes aria-* and enumerated attributes as "true"/"false" (table copied from dom/attributes.ts, guarded by a source-equality parity test) and drops other false booleans; classAttr follows setClass token rules; spreadAttrs keeps namespaced attributes (xlink:href) and skips property-only indeterminate. text()/escape() already rendered booleans as empty. New server/elements.ts exported from index.server.ts: ref() (reads undefined), Portal (renders nothing; portal content is client-only, documented), Dynamic (components and intrinsic tags, void tags, innerHTML/textContent, tag-name validation); browser and node lumen entries now export the same names. server/parity.test.ts (happy-dom, 78 tests) compares server HTML with client DOM serialization for text, attributes (39 names x 11 values), class, style, spread, properties, ref, Portal and Dynamic. submit() registers with core beginBusy() (decision-20) and now rejects network failures with FetchError status 0 (aborts keep AbortError); tests cover busy() and the result semantics. Validation: pnpm typecheck OK, pnpm test 594/594, pnpm lint 0 errors (1 pre-existing warning).
<!-- SECTION:FINAL_SUMMARY:END -->
