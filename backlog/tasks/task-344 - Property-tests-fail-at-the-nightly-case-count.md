---
id: TASK-344
title: Property tests fail at the nightly case count
status: Done
assignee:
  - '@Nova'
created_date: '2026-10-15 08:03'
updated_date: '2026-10-15 08:10'
labels:
  - security
  - fuzzing
  - ci
milestone: m-11
dependencies: []
priority: high
ordinal: 346000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the first manual run of the nightly fuzz workflow (https://github.com/itsjavi/lumiose/actions/runs/38700307868), job "property tests" (pnpm --filter lumiose test:properties 200000). At 200,000 cases: src/app/server/csrf.property.test.ts (3 of 6 failed, including timeouts at Vitest's 5 s default), src/server/url.property.test.ts (3 of 5 failed, including "navigates only to http(s) URLs, and refuses the rest with a TypeError"), and src/app/server/redirect.property.test.ts ("throws a Redirect only to locations that resolve to http(s), and a TypeError otherwise", "Property failed after 5040 tests"). Tell real counterexamples (fix the code, keep the case as a regression test) from test-time limits (the high-count run needs a timeout that scales with the case count).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Every failing property is diagnosed: a code fix with a regression case, or a corrected property with the reason recorded
- [x] #2 test:properties at 200000 cases passes locally with timeouts that scale with the count
- [x] #3 The fast pnpm test run is unchanged
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Nova (2026-10-15): claimed in worktree branch claude/nova-m11-e57655 (M11 follow-ups).

Nova (2026-10-15), diagnosis of the CI run (job "property tests", 200000 cases):
- 7 of 8 failures were test-time limits, not counterexamples: sync properties had no timeout and hit Vitest's 5 s default (csrf x3, url attribute and navigationUrl, redirect()). Fix: the property helper (src/app/server/__fixtures__/property.ts) now sets `vi.setConfig({ testTimeout })` for every test of a file that imports it, max(10 s, 25 ms per case); the per-test TIMEOUT arguments are gone.
- 1 real counterexample, in the test oracle, not in Lumiose: "keeps text intact through the HTML parser" with "javascript:,-->". happy-dom 20.14.5's regex parser emits the text before a stray `-->` (or `--!>`) twice ("a-->" parses as "aa-->"; HTMLParser.js parses the plain text, then falls into the "not a valid tag" branch with the same range). Per the HTML standard `-->` in the data state is plain text, and escapeText() output is correct. Fix: the two escaping properties parse with parse5 8.0.1 (pinned devDependency of packages/lumiose, deps.lock taken; spec tokenizer and tree construction, as browsers), and a regression case keeps the counterexample. Text and attribute checks now also compare the parse tree (only text nodes; exactly the one attribute).
- Validation: `pnpm --filter lumiose test:properties 200000` passes locally, 25 tests in 5 files, 76 s. The fast `pnpm test` run is unchanged (100 cases, about 1.3 s for the property files).
- Not done, needs the user (outward-facing): a happy-dom upstream report. Draft: title "HTMLParser duplicates text before a stray --> outside a comment"; body: `const t = document.createElement("template"); t.innerHTML = "<p>a--></p>"; t.content.firstChild.textContent` returns "aa-->" (expected "a-->", as in browsers and parse5); the `any` read state parses the plain text before the match when match[4] is set, then the else branch parses lastIndex..markupRegExp.lastIndex again.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The property tests pass at 200,000 cases. Seven of the eight CI failures were Vitest's 5 s default timeout: the property helper now gives every test in a property file a timeout that scales with the case count. The eighth was a happy-dom parser bug (text before a stray `-->` emitted twice), not an escaping bug: the escaping properties now parse with parse5 (pinned devDependency), with the counterexample kept as a regression case.
<!-- SECTION:FINAL_SUMMARY:END -->
