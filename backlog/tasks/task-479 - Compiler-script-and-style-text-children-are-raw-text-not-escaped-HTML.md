---
id: TASK-479
title: 'Compiler: a static text child of <script> or <style> stays raw text'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-17 00:29'
updated_date: '2026-10-17 00:53'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Nova in TASK-472 (L7). The HTML parser reads <script> and <style> content as raw text, where entities stay literal, but the server codegen folds a static text child as escaped HTML: <script>{"var a = 1 < 2;"}</script> compiles to 'var a = 1 &lt; 2;', a syntax error in the browser (the same for & and > ). A static child should be written as it is, except that a '</script' (case-insensitive) or '<!--' in it must not end the element: refuse it at compile time or escape it in a way the language keeps (such as '<\/script' in JS). Owner: crates/lumiose_compiler (codegen/client/ssr.rs). Dynamic children of JSON-typed scripts are TASK-480.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A static text child of <script> or <style> renders as raw text that the browser reads back unchanged
- [ ] #2 A '</script' or '<!--' in a static child cannot end the element, with a test
<!-- AC:END -->
