---
id: TASK-326
title: 'Web components: Custom Elements Everywhere and a guide'
status: Done
assignee:
  - '@Spark'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 05:25'
labels:
  - ecosystem
milestone: m-11
dependencies: []
priority: medium
ordinal: 328000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-54, web components are Lumiose's interop path. Run the Custom Elements Everywhere suite against Lumiose (properties versus attributes, events, server rendering), fix the gaps, publish the score, and write a guide for using web-component libraries: typing custom elements in JSX, events with on:, properties, and server rendering.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The suite runs against Lumiose and its gaps are fixed or tracked as tasks
- [x] #2 The score is published next to the guide
- [x] #3 The guide shows a typed custom element with properties and events, server-rendered
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Spark started 2026-10-15 (batch 2).

Implementation (Spark):
- Suite: new workspace package benchmarks/custom-elements-everywhere (@lumiose/bench-cee; a new directory outside the AGENTS.md ownership table, flagged to Lux). It mirrors an upstream libraries/<name> folder: src/components.tsx (Lumiose port of the components), src/basic-tests.tsx and src/advanced-tests.tsx (upstream's assertions and weights; elements found by id; flush() where React's suite uses act()), fixtures/webcomponents (upstream's shared elements, byte-identical, Apache-2.0 headers kept; under fixtures/ so oxfmt/oxlint leave them alone). src/mocha.ts and src/chai.ts implement the subset the suites use (no Karma, mocha or chai dependency). Playwright runs a production build in Chromium, Firefox and WebKit (e2e/cee.e2e.ts fails on any failing test); scripts/score.ts applies upstream's custom-json reporter formula (weighted over Chrome + Firefox) into results/summary.json. Upstream revision 2e5eea09 (2025-08-10). Installed Playwright 1.63's Firefox and WebKit builds locally (playwright install) to run it.
- Score before: 83 (basic 16/16, advanced 10/16: array, object and camelCase-named object props arrived as attributes). After: 100 in Chrome + Firefox (basic 16/16, advanced 16/16) and 100 in WebKit.
- Fix (packages/lumiose/src/dom): setAttr() sends a custom element's prop to the property when the element defines one and it is not an HTMLElement.prototype property (React 19's rule; strings keep safeAttrValue's URL check), else to the attribute; spread uses setAttr, so it follows. template() imports (document.importNode) instead of cloning templates that contain a custom-element tag, so defined elements are upgraded before bindings run; without it real browsers still failed the 3 property tests (happy-dom upgrades clones, so only the browser suite shows it).
- No new syntax: no prop:/attr: namespaces. An element defined after its component runs gets attributes (as in React 19); the guide says to load definitions first.
- Size (pnpm --filter lumiose size): core + dom every export 9.93 -> 9.98 kB (hard cap 10 kB; 20 B left), typical imports 6.05 -> 6.13 kB, islands 9.16 -> 9.22 kB.
- Gap tracked: server HTML writes arrays and objects of custom elements as text attributes until hydration (React 19 omits them); needs the compiler to mark custom-element props: TASK-337 (assigned to Lux for routing to Photon and Nova).
- Tests: dom/attributes.test.ts (property vs attribute rule, URL check, undefined elements), dom/hydrate.test.ts (server attributes, then properties and on: events after hydration), and the browser suite.
- Docs: new guides/web-components.md (score, defining elements in the browser with a guarded import, a typed custom element with properties and events, the property/attribute rule, events, server rendering, :not(:defined)); concepts/jsx.md row; reference/jsx.md custom elements; docs README index; llms regenerated. Publishing to custom-elements-everywhere.com is an upstream pull request: parked for the user.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Lumiose scores 100 on Custom Elements Everywhere (was 83) in Chrome, Firefox and WebKit: custom-element props go to defined properties (React 19's rule) and templates with custom elements are imported so elements upgrade before bindings. Suite in benchmarks/custom-elements-everywhere, guide in docs/guides/web-components.md; the SSR object/array gap is TASK-337; the upstream submission is parked for the user.
<!-- SECTION:FINAL_SUMMARY:END -->
