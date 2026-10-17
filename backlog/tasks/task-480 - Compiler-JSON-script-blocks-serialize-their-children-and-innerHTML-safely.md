---
id: TASK-480
title: 'Compiler: JSON script blocks serialize their children and innerHTML safely'
status: To Do
assignee:
  - '@Photon'
created_date: '2026-10-17 00:53'
updated_date: '2026-10-17 00:54'
labels:
  - compiler
  - security
dependencies: []
priority: medium
ordinal: 476000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Security review L7 (TASK-472, decision-56), filed by Nova. In server output, <script type="application/ld+json">{JSON.stringify(data)}</script> goes through insertText(), which escapes it as HTML text: &lt; and &amp; stay literal inside a <script>, so the JSON changes. With innerHTML={JSON.stringify(data)} the value is spliced in raw, and a '</script><script>…' inside a JSON string breaks out of the element (XSS without CSP, injected markup with it). Fix: for a <script> whose static type is a JSON type (application/json, application/ld+json, a type ending in +json, importmap, speculationrules), the server codegen passes dynamic children and innerHTML through a new lumiose/server helper that writes a string with '<' as \u003c (lossless in JSON: outside strings JSON has no '<'), as jsonForScript does for Lumiose's own payloads; a static child or innerHTML gets the same at compile time. Owner: crates/lumiose_compiler (codegen/client/ssr.rs) and packages/lumiose/src/server (the helper). Until then security.md documents innerHTML={JSON.stringify(data).replace(/</g, '\\u003c')}.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A JSON-typed <script> with a text child or innerHTML renders the value with < as \u003c, so the JSON reads back unchanged and a value cannot close the element, with tests
- [ ] #2 security.md's JSON-LD example (Raw HTML, JSON in a script) uses the plain form once it is safe
<!-- AC:END -->
