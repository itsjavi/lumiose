---
id: TASK-479
title: 'Compiler: script and style text children are raw text, not escaped HTML'
status: To Do
assignee: []
created_date: '2026-10-17 00:29'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 475000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Nova in TASK-472 (L7). In server output, the text children of <script> (and <style>) are escaped as HTML text, but the HTML parser reads these elements as raw text: entities stay literal. A static child is folded at compile time: <script>{"var a = 1 < 2;"}</script> compiles to 'var a = 1 &lt; 2;' (a syntax error in the browser), and a dynamic one goes through insertText(), so <script type="application/ld+json">{JSON.stringify(data)}</script> writes &lt; and &amp; into the JSON. Raw text needs its own serialization: written as it is, except that '</script' (case-insensitive) and '<!--' must not appear; for JSON types (application/json, application/ld+json, importmap, speculationrules), '<' as \u003c is lossless. innerHTML on such a script is spliced in raw, so '</script>' in a JSON value breaks out (security review L7). Owner: crates/lumiose_compiler (codegen/client/ssr.rs) plus a lumiose/server helper. Until then, security.md documents innerHTML with JSON.stringify(data).replace(/</g, '\\u003c').
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A static or dynamic text child of <script>/<style> renders as raw text that the browser reads back unchanged
- [ ] #2 JSON-typed scripts serialize children and innerHTML with < as \u003c, so a value cannot close the element
- [ ] #3 security.md's JSON-LD example uses the simpler form once it is safe
<!-- AC:END -->
