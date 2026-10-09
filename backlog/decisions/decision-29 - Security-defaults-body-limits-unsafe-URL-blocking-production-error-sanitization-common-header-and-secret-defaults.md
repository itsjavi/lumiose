---
id: decision-29
title: >-
  Security defaults: body limits, unsafe URL blocking, production error
  sanitization, common header and secret defaults
date: '2026-10-09 12:09'
status: accepted
---
## Context

The pre-release security review (TASK-162, Prism) found unbounded request bodies, `javascript:` URLs rendered from dynamic values, raw errors reaching `ErrorBoundary` fallbacks in production SSR, and several defaults with no stated policy. On 2026-10-09 the user chose the first three explicitly and, for the rest, said: "do whatever is common in other frameworks but always give the option to change it to the user."

## Decision

**Chosen by the user**
- **Body limits.** Urlencoded/JSON bodies are capped at 1 MB and multipart at 10 MB; larger requests get 413 (rejected early on `Content-Length`, otherwise while streaming). Configurable globally with `lumen({ limits: { body: "1mb", upload: "10mb" } })` and per route with `export const limits = { … }`. Endpoints get the same limits: the request handler bounds every body, so `request.formData()`, `json()` and `arrayBuffer()` enforce them (no separate helper needed).
- **Unsafe URLs.** Dynamic values for URL attributes (`href`, `src`, `action`, `formaction`, `xlink:href`, `poster`, `data` …) with a `javascript:` (or `vbscript:`/`data:text/html`) scheme render as a harmless placeholder in production, with a LUM dev warning. Static string literals are left alone.
- **Production errors.** During server rendering, `ErrorBoundary` fallbacks receive a generic error with a short digest instead of a non-`HttpError` error; the full error goes to the server log with the same digest. Development keeps the raw error. This matches page-level errors.

**Lux, following common practice with an override each time**
- **Response headers:** `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` by default (as Rails and Django do); override or remove them through `lumen({ headers })`.
- **Signed cookies:** secrets shorter than 32 bytes throw in production (iron-session's rule) and warn in development; an explicit `allowWeakSecret: true` opts out.
- **Static symlinks:** adapter-node keeps following symlinks (as Express `serve-static` and nginx do) but warns at startup when one escapes `dist/client`, never lets one unreadable entry disable static serving, and offers `symlinks: "contain"`.
- **Timeouts:** Node's defaults stay (as Express and Next.js); documented, and tunable through `LumenServer.server`.
- **Public env prefix:** `PUBLIC_` (the documented contract, as SvelteKit and Astro); Vite's `envPrefix` overrides it.
- **Server-only files in dev:** added to Vite's `server.fs.deny`, so the dev server returns 403 for them; the Vite option overrides it.
- **LUM4003** matches on real paths (so case-insensitive file systems and symlinks cannot bypass it) and covers workspace files outside the Vite root (not `node_modules`).

## Consequences

- New public options: `lumen({ limits })`, route `export const limits`, `allowWeakSecret`, adapter-node `symlinks`. Docs: concepts/security.md and the reference pages.
- Tasks: TASK-167 (Nova: limits, headers, secrets, symlinks), TASK-168 (Spark: URLs, ErrorBoundary), TASK-170 (Photon: env prefix, fs.deny, LUM4003).
