---
id: TASK-425
title: A form reset clears live <output> text in islands
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-16 05:22'
updated_date: '2026-10-16 05:59'
labels:
  - runtime
  - dom
milestone: m-12
dependencies: []
priority: medium
ordinal: 423000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo in TASK-424 (2026-10-16). In Firefox and WebKit, a form reset replaces the contents of an <output> inside the form with its default value. An island that renders reactive text inside such an <output> loses the text node the runtime updates, so later updates stop showing. Field.Error now restores its own text after a reset; other <output> elements in islands still break. Either the runtime keeps reactive content in a reset <output> working (re-attach after the form's reset event), or the docs warn and @lumiose/ui avoids <output> for reactive text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reactive text in an <output> inside a form keeps updating after a reset in Firefox and WebKit, with a test, or the limit is documented with the reason
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 10 (no Spark session is running).

2026-10-16 (Beacon): Fixed in the runtime. Cause: a form reset sets each <output>'s text to its default value (its text, while no script set `value`); Firefox and WebKit replace the children even when the text is the same (Chromium returns early), so the text node a binding updates leaves the document. Fix: packages/lumiose/src/dom/output.ts `outputTemplate(html, flags?)`, which the compiler emits instead of `template` for a template whose HTML has an `<output>` (crates/lumiose_compiler client/mod.rs). Its first instance installs one capturing `reset` listener on the document: the outputs of the form being reset whose value equals their default value (a reset that would not change their text) get an empty `form` attribute, which names no form, so the reset skips them; a timeout puts their own `form` attribute back. An output whose script-set value differs from its default is still reset. Only modules with an <output> import it: the typical bundle is unchanged (6.17 kB brotli), the whole runtime +0.13 kB. Contract: ClientRuntime and doc-2 (outputTemplate row). Tests: output.test.ts (happy-dom, stubbed default values, since happy-dom has neither form owners from the attribute nor output default values); golden output-templates; ui-e2e /form/island has the live `checks` <output> back (Halo's <p> workaround undone) and a 'Reset login' button, and a new test 'a reset button keeps the output's text node, which goes on updating (TASK-425)'. Without the listener it fails in Firefox and WebKit (and the TASK-424 Error test and the debounce test's reset count fail in WebKit); with it, form.e2e passes in Chromium (45, 1 skipped) and Firefox/WebKit (46). Field.Error's restore-after-reset workaround in field.script.ts is removed: the runtime keeps the island's Error out of the reset, and on server pages the script finds the text node each time. No user docs change: outputs now behave in Firefox and WebKit as in Chromium.
<!-- SECTION:NOTES:END -->
