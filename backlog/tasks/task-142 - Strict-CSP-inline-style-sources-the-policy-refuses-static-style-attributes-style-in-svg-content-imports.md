---
id: TASK-142
title: >-
  Strict CSP: inline style sources the policy refuses (static style attributes,
  <style> in <svg>, content imports)
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-09 05:12'
updated_date: '2026-10-09 05:44'
labels:
  - security
  - css
  - compiler
dependencies: []
priority: low
ordinal: 142000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found in TASK-138. Under lumen({ csp: "strict" }) (no 'unsafe-inline' for styles) three sources still produce inline styles the browser refuses: (1) style="…" written as a plain string, which the compiler folds into static template HTML (client templates and server static parts), (2) <style> inside <svg> in .stsx (kept as native SVG CSS; spa-chiptune's PixelLogo hit this and moved its CSS to a file-level block), (3) style attributes or <svg><style> inside .md/.html imports. Options: compile static style attributes through styleAttr/setStyle when the project is strict (needs a compile option), lift <svg><style> into the file's block, and/or a warning diagnostic (LUM3xxx) for each source when csp is strict, plus the LS.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each source either works under strict CSP or gets a diagnostic with a fix; docs/concepts/security.md updated
- [x] #2 Per decision-27, JSX-authored <script>/<style> get the nonce automatically in strict mode (explicit nonce wins), hashed on prerendered pages; the travel journal drops its explicit nonce={cspNonce()}; tests and concepts/security.md
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Lux 2026-10-09: decision-27 (user): JSX-authored <script>/<style> rendered on the server get the response nonce automatically in strict mode (explicit nonce prop wins; prerendered pages hash them). Implement it in this task together with the three refusal sources.

Photon (2026-10-09): compile option strictCsp (lumen/vite passes it with lumen({ csp: "strict" }); napi/wasm too). (a) decision-27: JSX <script>/<style> without a nonce prop get the nonce: server nonceAttr() hole (after a spread, whose own nonce wins since the first attribute counts), client setNonce(el) (the page's <meta property="csp-nonce">, set as the nonce property before insertion; survives cloning). Prerendered pages: Halo's hash policy already hashes every inline script/style, so authored ones are covered (tested). (b) static style="..." strings (attribute, literal, or the static keys of a style object): server styleAttr("...") (data-l-v + nonce'd rule), client setStyle/setStyleProperty (CSSOM) instead of baked template attributes; native SVG <style> blocks of .stsx get nonceAttr()/setNonce on the raw node; .md/.html imports go through the same compile (style attributes become JSX strings, SVG style raw blocks), so all three refusal sources work without a diagnostic. Limit: an element only the client creates on a prerendered page has no nonce (documented). New runtime members (contract client.ts setNonce, server.ts nonceAttr; doc-2 wording for Lux). Travel journal dropped nonce={cspNonce()}. Tests: compile_api strict_csp_applies_static_styles_through_the_cssom_and_nonces_inline_elements; app/server/csp.test.ts (authored elements nonce'd, explicit nonce kept, prerendered hashed, no style= left); dom/attributes.test.ts setNonce. Playwright: ssg-travel-journal 17/17 (incl. CSP violation check without the explicit nonce), ssr-bookshelf 15/15, spa-chiptune 20/20. Docs: concepts/security.md, reference/vite.md, options.ts.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Under csp strict, JSX script/style elements get the nonce automatically (explicit nonce wins; prerendered pages hash them), and static style strings, SVG style blocks and content-import styles no longer produce refused inline styles. Travel journal drops its explicit nonce; security docs updated.
<!-- SECTION:FINAL_SUMMARY:END -->
