---
id: decision-75
title: Raw-text escaping escapes the character after <
date: '2026-10-21 00:28'
status: accepted
---
## Context

The delta security review for 0.5.0 (TASK-495) found that `<style>` and `<script>` text written as raw text could open a tag when the element landed inside `<svg>` or `<math>`. There the parser reads `<img …>` in that text as markup. The server cannot always know the namespace: a component rooted at `<style>` may end up anywhere.

The obvious fix escapes the `<` itself (`\x3C` in scripts, `\3c ` in styles), but that breaks valid code:
- In script code, `i<n` stops being a comparison, which matters for minified inline scripts.
- In CSS, a media range such as `(400px<width)` stops parsing.

## Decision

Orchestrator decision (Lux, 2026-10-21), from Photon's TASK-495.

When a `<` could open a tag or a comment, `rawText` (server) and `html::raw_text` (compiler) escape the **character after it**, the same way in both, in every namespace:
- **A letter.** It becomes `\u00XX` in a script and `\XX ` in a style, so `<img` becomes `<img` in a script and `<\69 mg` in a style.
- **`!`, `/` and `?`.** They become `\!`, `\/` and `\?`.

The `</tag` and `<!--` guarantees stay. JSON-typed scripts keep their own escaping of `<`.

This reads back unchanged in JS strings, template literals, regular expressions and identifiers, and in CSS strings, identifiers and URLs. It also keeps `<` working as an operator and in media ranges.

## Consequences

- No tag or comment opens from script or style text, in HTML, SVG or MathML. parse5 property tests and checks in Chromium, Firefox and WebKit back this.
- A few rare cases are lossy, and security.md lists them:
  - A `<` right before a keyword or `!` in script code (an escaped keyword is a syntax error).
  - `String.raw`.
  - `<!` in a regular expression with the `u` or `v` flag.
  - A CSS `<!--`.
- On the server, Dynamic writes script and style content through `rawText` too.
