---
id: TASK-495
title: 'SSR: <style> and <script> text inside <svg> or <math> can break out (Medium)'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-20 23:55'
updated_date: '2026-10-21 00:26'
labels:
  - security
dependencies: []
priority: high
ordinal: 491000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Delta security review for 0.5.0 (Prism, 2026-10-21), finding C1, introduced by TASK-472 L7. The server codegen uses self.namespace() without html::root_namespace (crates/lumiose_compiler/src/codegen/client/ssr.rs:279-282; the client's build_element at element.rs:176 calls it), and rawText (packages/lumiose/src/server/node.ts:121) only neutralizes </tag and <!--. A component such as function Layer(p){ return <g><style>{p.css}</style></g> } rendered in <svg>, with css = '<img src=x onerror=…>', writes <svg><g><style><img …></style>, and the browser parses the <img> as HTML: script runs (also for a component whose root is <style>/<script>, or one passed as children, under <svg>/<math>). A strict CSP mitigates it; it also causes a hydration mismatch. Blocks the 0.5.0 release.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The server codegen picks the element namespace with html::root_namespace, as the client does
- [x] #2 rawText is safe in foreign content too: in style and script text, a < before [A-Za-z!/?] is rewritten losslessly (\3c in CSS, \u003c-style escape in script)
- [x] #3 Tests: the payload above under <svg> and <math> stays text in Chromium's parse (or an equivalent parser check), and <svg><Comp/> hydrates without mismatch
- [x] #4 security.md and jsx.md state the raw-text guarantee precisely
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (2026-10-21), commits c989112d, 2636b51d, d23f8d7f:
- Server codegen: ssr_element takes the element namespace; roots use html::root_namespace and fragment items the namespace of their first element as a root, as the client compile_element_root and compile_fragment_items do. A <style>/<script> under <g>, <mi>, <svg> or <math> is foreign: escaped text, decoded by the parser.
- rawText and html::raw_text (kept identical): deviation from the proposed escape of the < itself (\3c / \x3C). The character after a < that could open a tag is escaped instead: a letter as \u00XX in a script and \XX (plus a space) in a style; !, /, ? as \!, \/, \?. Reason: \x3C breaks every i<n comparison in script code (minified inline scripts) and \3c breaks CSS media ranges such as (400px<width). The chosen escape reads back in JS strings, template literals, regular expressions and identifiers and in CSS strings, identifiers and URLs, and keeps < as an operator. Remaining lossy cases, documented in security.md: < right before a keyword or ! in script code, String.raw, <! in a u/v regex, a CSS <!--. It applies in every namespace, since the server cannot know where a component rooted at <style> ends up.
- Server Dynamic: script/style children, innerHTML and textContent go through rawText, as the client sets them as text (innerHTML was written raw before and could end the element).
- Evidence: parse5 properties in server/url.property.test.ts (script and style text in HTML, SVG and MathML opens no element or comment; JSON strings read back); dom/hydrate.test.ts case <svg><Sheet/><Layer/></svg> and <math><mi/><Code/></math> (parse5: no img, foreign namespaces, texts; hydrates with no warning); compiler golden raw-text; one-off check in Chromium, Firefox and WebKit: no injected element, CSS content and media range and JS string, template, regex and comparison read back.
- Validation: cargo test -p lumiose_compiler, cargo fmt --check, cargo clippy -p lumiose_compiler -D warnings, pnpm build:compiler, vitest packages/lumiose/src/server and dom (439 tests), CLI docs tests, docs:gen and docs:check, pnpm typecheck, pnpm lint (no new warnings).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Server and client agree on the namespace of <style>/<script> (root_namespace on the server too), so SVG and MathML ones get escaped text; rawText (and the compiler static raw text) escapes the character after any < that could open a tag, so a root <style>/<script> rendered inside <svg>/<math> cannot open one either, losslessly for JS and CSS strings. Server Dynamic writes script/style content as raw text. Docs (security.md, jsx.md, head.md, components.md) state the guarantee and its exact limits.
<!-- SECTION:FINAL_SUMMARY:END -->
