---
id: TASK-497
title: 'Strict styles: the url( detection can be bypassed (Low)'
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-23 09:04'
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
- [x] #1 éurl(/* and {url(( cannot affect another element's rule (render.test.ts)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (0.5.1 batch, worktree branch): designed together with TASK-521 in packages/lumiose/src/server/attrs.ts.

Fix (packages/lumiose/src/server/strict-styles.ts, decision-78): closeOpen() treats url( as a url token only when it starts a token in every CSS tokenizer, right after whitespace or punctuation that is always a token by itself. After anything else (identifier characters, #, @, -, escapes such as \7b , non-ASCII, controls), tokenizers may disagree (non-ASCII identifier ranges, WebKit's U+ unicode-range token), so the rule gets a <style> of its own and whatever it leaves open ends with that element. Also fixed: the quote lookahead of url( used JS \s (\v, NBSP), not CSS whitespace, so url(\v")/* swallowed the next rules too. Evidence: a Playwright fuzz of 8,000 adversarial values in Chromium, Firefox and WebKit left no following rule unstyled (1,112 isolated); without the isolation check the same fuzz finds 100 broken.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A strict-CSP style value whose url( follows an identifier character (éurl(, \7b url( from {url(, #url(, -url(, ×url(, U+abcurl() now gets a <style> of its own, so it cannot swallow another element's rule whatever the browser's tokenizer reads; url( after whitespace or punctuation is closed as before, and only CSS whitespace counts before a url("…") quote. Tests: render.test.ts (both AC values and the other vectors, the shared-<style> cases). Docs: concepts/security.md. Decision: decision-78, with TASK-521.
<!-- SECTION:FINAL_SUMMARY:END -->
