---
id: decision-27
title: 'CSP nonces: automatic on JSX-authored inline script and style, plus cspNonce()'
date: '2026-10-09 05:24'
status: accepted
---
## Context

`lumen({ csp: "strict" })` (TASK-138, spec §7.4) puts a per-response nonce on every inline script and style Lumen itself emits. App code also writes inline `<script>`/`<style>` (a theme script in `document.stsx`, a JSON-LD block, a third-party snippet), which a strict policy refuses without that nonce. Halo's first version exposed `cspNonce()` and required `<script nonce={cspNonce()}>` by hand, like Next.js. On 2026-10-09 the user chose: automatic nonces plus `cspNonce()`.

## Decision

- In strict mode, every `<script>` and `<style>` element **written in JSX** and rendered on the server gets the response's nonce automatically (server codegen/runtime adds the attribute; an explicit `nonce` prop wins). Elements written in JSX are authored code, so trusting them is safe; strings rendered as text are escaped and never become elements, and raw HTML strings never get a nonce.
- `cspNonce()` is public API from `lumen`: on the server it returns the current response's nonce (or `undefined` without strict CSP); in the browser it reads `<meta property="csp-nonce">`. It is for code that builds markup or headers itself (third-party snippets, custom `Content-Security-Policy` headers, scripts injected at runtime).
- Prerendered pages keep the hash-based `<meta http-equiv>` policy (TASK-138); authored inline scripts and styles are hashed there.

## Consequences

- Apps under strict CSP need no code change for their own inline scripts and styles.
- Remaining refusals (static `style="…"` strings in templates, `<style>` inside `<svg>`, inline styles in `.md`/`.html` imports) are handled in TASK-142.
