---
id: TASK-42
title: 'Implement the JSX types (lumen/jsx-runtime, lumen/env)'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-08 12:28'
labels: []
milestone: m-1
dependencies:
  - TASK-5
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: high
ordinal: 42000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Every Lumen project type-checks with stock TS 7 against Lumen's JSX types. They must encode the accepted syntax: class/style shapes, onX plus on:x events, bind:*, client:*, key, async components, and <style> rejected in .tsx (spec §4.5, §4.7; decisions 7, 9, 13, 17).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lumen/jsx-runtime exports JSX with IntrinsicElements derived from the DOM and SVG tag maps: typed onX (delegated) and on:x (native) handlers with typed currentTarget, class (string | array | record), style (string | kebab-case object incl. --custom), bind:value/bind:checked (writable signal), attach, ref, innerHTML, key; style is omitted; className, htmlFor and camelCase style keys are rejected
- [ ] #2 IntrinsicAttributes add key and client:load|idle|visible|media|only (with value forms); ElementType accepts sync and async components; ElementChildrenAttribute is defined
- [ ] #3 lumen/env declares the global JSX namespace, import.meta.env (PUBLIC_*) types and the Locals interface hook
- [ ] #4 Type tests (tsd-style .test-d.ts or tsc fixtures run in Vitest) prove accepted and rejected cases on TS 7
<!-- AC:END -->
