---
id: TASK-327
title: 'Guide: OpenTelemetry with OpenObserve, SigNoz and Datadog'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 06:41'
labels:
  - docs
  - guide
milestone: m-11
dependencies:
  - TASK-298
  - TASK-299
priority: medium
ordinal: 329000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: one guide wiring instrumentation.server and instrumentation.client (decision-49) to OpenTelemetry, with exporter sections for OpenObserve, SigNoz and Datadog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide traces requests and client navigations through decision-49's instrumentations
- [x] #2 It has working exporter setups for OpenObserve, SigNoz and Datadog
- [x] #3 Its examples are type-checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 4): started. Pinned devDependencies of @lumiose/cli for the type-checked guide examples (also TASK-328/329), each at least 3 days old: @opentelemetry/api 1.9.1, sdk-node 0.223.0, exporter-trace-otlp-http 0.223.0, resources 2.12.0, semantic-conventions 1.43.0, sdk-trace-web 2.12.0, sdk-trace-base 2.12.0, @sentry/node 10.76.2, @sentry/browser 10.76.2, @sentry/vite-plugin 5.4.1, posthog-js 1.438.7, posthog-node 5.55.2.

Done. docs/guides/opentelemetry.md (Guides): src/instrumentation.server.ts starts the Node SDK in register() (OTLP/HTTP exporter configured by OTEL_EXPORTER_OTLP_* env), a SERVER span per request named after the route pattern (continuing an incoming traceparent), child spans per phase (middleware, action, endpoint, render, stream), errors via onRequestError as spans with phase and digest; src/instrumentation.client.ts registers a WebTracerProvider and spans for navigate, submit, fetch and hydrate plus onError; a route.ts relay endpoint forwards the browser's spans with the server's OTLP settings (skipped by the server instrumentation, 256kb body limit). Backends: OpenObserve (Basic auth header, /api/<org>/v1/traces), SigNoz (self-hosted 4318 without auth; Cloud ingest URL + signoz-ingestion-key), Datadog (Agent OTLP receiver DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT). How it was checked: a scratch Lumiose app with exactly the guide's three files, built with lumiose build and served by lumiose preview, against OpenObserve (Docker, latest image) and self-hosted SigNoz 0.129 (its last Docker Compose release; current SigNoz installs with foundryctl, which I did not run since it installs a binary on the host): server spans nested request > render > stream, /boom produced an ERROR request span with an 'error render' child, a request with a traceparent header joined that trace, and browser hydrate and navigate spans arrived through the relay; queried in OpenObserve's search API and in SigNoz's ClickHouse. SigNoz's collector only accepted data after the first user signed up (noted in the guide). Datadog: not run (needs an account); follows Datadog's OTLP ingestion docs. Browser SDK measured at 58 kB minified / 16 kB brotli. Containers removed afterwards. Type-checked in the docs examples test (new links for the OpenTelemetry packages).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
OpenTelemetry guide: server request and phase spans, client navigation spans, a relay endpoint for browser spans, and OpenObserve, SigNoz and Datadog setups; checked end to end against OpenObserve and SigNoz in Docker.
<!-- SECTION:FINAL_SUMMARY:END -->
