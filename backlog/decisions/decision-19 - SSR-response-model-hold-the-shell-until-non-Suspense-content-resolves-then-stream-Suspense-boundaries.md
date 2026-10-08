---
id: decision-19
title: >-
  SSR response model: hold the shell until non-Suspense content resolves, then
  stream Suspense boundaries
date: '2026-10-08 12:13'
status: accepted
---
## Context

Prism's review of spec v0.2 found a conflict:
- Pure in-order streaming flushes the layout before an async page has decided its status, redirects, cookies, `<Title>`, or its error page.
- Once headers are sent, none of these can be changed.

React, SvelteKit and SolidStart all solve this with a "shell".

## Decision

**Shell first.** The SSR response begins only after everything outside `<Suspense>` boundaries has resolved: layouts, the page, and any async components that aren't wrapped in a boundary. Until then:
- the status code can still be set;
- `redirect()`, `notFound()` and `error()` still work;
- cookies and headers can still be written;
- `<Head>`, `<Title>` and `<Meta>` are still collected;
- a failure renders `_error` with the right status.

**Then stream.** After the shell is sent, `<Suspense>` boundaries stream out of order. Delivery uses native declarative partial updates (`<template for>`) where supported, or the shared swap-script fallback.
- Errors inside a boundary render its `<ErrorBoundary>` fallback in place.
- `<Head>`, `redirect()` and status changes inside a boundary are dev-time errors (LUM5004).

**SSG and prerendering** always render fully resolved: no fallbacks and no swap script.

**Request accessors.** Nested server components use `request()`, `locals()`, `cookies()` and `url()`, which are scoped to the current render.

## Consequences

- Time to first byte depends on the shell's async work. Authors move slow work into `<Suspense>` to stream it.
- Status codes, redirects and head management are always correct.
- Static output contains no streaming artifacts.
