---
id: TASK-330
title: 'Guide: Stripe'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:03'
updated_date: '2026-10-15 05:58'
labels:
  - docs
  - guide
milestone: m-11
dependencies: []
priority: medium
ordinal: 332000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15 (grilling session on adoption by developers used to React, Next.js, React Router and Astro). Per decision-57: Stripe Checkout started from a form action, and webhooks received by a route.ts endpoint with signature verification.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The guide covers Checkout from a form action and verified webhooks in an endpoint
- [x] #2 Its examples are type-checked
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 3): started.

Done. docs/guides/stripe.md (Guides): the stripe client created lazily in src/server/stripe.server.ts with a server-side plan/price allowlist; a /pricing page whose checkout form action creates a Checkout Session (subscription, success_url with {CHECKOUT_SESSION_ID}, cancel_url, client_reference_id, metadata) and redirects 303 to session.url; a return page that retrieves the session to show its status (not to fulfill); a route.ts webhook endpoint (mode server) that reads the raw body with request.text(), verifies with webhooks.constructEventAsync (Web Crypto, works on every adapter), switches on checkout.session.completed / async_payment_succeeded / async_payment_failed, and fulfills idempotently via platform.waitUntil; the Stripe CLI for local forwarding; production notes (secrets, ORIGIN behind a proxy, strict CSP unaffected by hosted Checkout); common mistakes. Type-checked against the stripe package 23.0.0 (pinned devDependency of @lumiose/cli, linked into the docs examples project); checked that wrong field names and event types fail the check. Written against Stripe's API reference; not run against a Stripe account (no account can be created here), as the page's status note says.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stripe guide: Checkout from a form action and signature-verified webhooks in a route.ts endpoint, type-checked against stripe 23.
<!-- SECTION:FINAL_SUMMARY:END -->
