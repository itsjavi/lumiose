---
id: TASK-267
title: Numbers in insert regions skip String()
status: To Do
assignee:
  - Spark
created_date: '2026-10-12 22:52'
labels:
  - runtime
  - performance
dependencies: []
priority: low
ordinal: 269000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-245: in Chrome, a JS string made with String(number) and written to a text node stays alive with the node (about 64 bytes each), while a number written as is does not. TASK-245 changed setText (insertText and bind text paths) accordingly: the jsfb app's heap after 1k rows went from 1.868 to 1.804 MB (hand reference 1.764). insert() still converts with String() for static primitives (document.createTextNode(String(value)), src/dom/insert.ts) and for text items in regions (the String(value) calls in the region rendering), e.g. a dynamic {count()} child rendered with insert(). Measure with a heap A/B (benchmarks/js-framework-benchmark: pnpm bench:jsfb:ab --heap, or page.metrics() after a GC) and pass numbers through where it helps; keep the runtime under its size cap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Numeric children rendered by insert() keep no converted JS string alive (heap A/B in Chrome), with the same text as before
<!-- AC:END -->
