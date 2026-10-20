---
id: TASK-497
title: 'Strict styles: the url( detection can be bypassed (Low)'
status: To Do
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
labels:
  - security
dependencies: []
priority: medium
ordinal: 493000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta review finding S1 (TASK-472 L5 not closed): packages/lumiose/src/server/attrs.ts:168 closeOpen() treats url( as a url token whenever the previous char isn't [\w-], but the CSS tokenizer reads éurl( or \7b url( as an ordinary function. With csp:'strict', a dynamic style value éurl(/* or {url(( gets only ) appended and swallows later [data-l-v] rules in that <style> (no selector injection). Fix: tokenize identifiers as CSS does (non-ASCII and \hex escapes), or give each strict rule its own <style>.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 éurl(/* and {url(( cannot affect another element's rule (render.test.ts)
<!-- AC:END -->
