---
id: decision-57
title: 'Ecosystem through guides: integrations, testing and editors'
date: '2026-10-15 04:01'
status: accepted
---
## Context

Skeptics compare with Astro's hundreds of integrations, React Testing Library and Storybook, editors other than VS Code, and doubt that agents write Lumiose well when models were trained on React. Most third-party services ship framework-agnostic SDKs, and Vite plugins already cover build-time hooks. Agreed with the user in a grilling session on 2026-10-15.

## Decision

User decision, 2026-10-15.

- **No integrations API before 1.0.** Integrations are guides: one OpenTelemetry guide with sections for OpenObserve, SigNoz and Datadog, and guides for Sentry, PostHog, Stripe and Sanity, built on the instrumentation files (decision-49) where they apply.
- **Testing:** the docs use @testing-library/dom and user-event with `render()` from lumiose/dom, and Playwright for end-to-end tests. No adapter package and no component workshop integration before 1.0.
- **Editors:** documented setups for the language server in Neovim, Zed and Helix next to the VS Code extension. GitHub highlighting comes from the scaffolded `.gitattributes`; the GitHub Linguist submission waits until about 200 repositories use `.stsx`; a JetBrains plugin waits for demand.
- **Debugging:** a proposal for a dev-only in-page inspector comes before any browser extension.
- **Agent claim:** one budgeted, published eval run compares agents on Lumiose and Next.js 16; the budget is approved by the user before anything runs.
- Rejected: an Astro-style `integrations` option, a `@lumiose/testing-library` package, a Storybook renderer, an immediate Linguist submission.

## Consequences

- Tasks: TASK-327 to TASK-331 (guides), TASK-324 (testing docs), TASK-322 (editors), TASK-323 (inspector proposal), TASK-325 (agent eval).
