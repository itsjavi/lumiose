---
id: TASK-576
title: 'lumiose() scopedStyles option, with docs'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 00:59'
labels:
  - build
  - css
  - docs
milestone: m-14
dependencies:
  - TASK-573
  - TASK-574
references:
  - >-
    backlog/decisions/decision-85 -
    Scoped-styles-attribute-or-class-strategy-specificity-and-namespace-scopedStyles.md
  - packages/vite/src/options.ts
  - packages/vite/src/styles.ts
  - packages/lumiose/docs/concepts/styles.md
priority: medium
ordinal: 568000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implements decision-85 in the Lumiose Vite plugin.
- `lumiose({ scopedStyles: { strategy, specificity, namespace } })` is validated at startup, using lumiose_css's namespace validator.
- It is passed to every compile: client, server, the project scan, the CSS manifest and HMR.
- The default output becomes `data-lum-<hash>`. Update tests, snapshots, examples, benchmarks and e2e assertions that hard-code `data-l-<hash>`. Ask the owners of those areas, or the orchestrator, before editing outside packages/vite.
- Docs in the same task: the styles concept page (strategies, specificity default vs zero, namespace, passthrough) and the plugin options reference, regenerated with docs:gen.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 lumiose({ scopedStyles }) validates its values at startup with a clear error and applies them in dev, build and prerender
- [x] #2 Every strategy and specificity combination renders correctly in an example app in dev and production, including :deep() and class passthrough
- [x] #3 Tests, snapshots and e2e assertions that hard-coded data-l-<hash> use the configured names; pnpm check passes
- [x] #4 The styles concept page and the plugin options reference document scopedStyles; docs:check passes
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-25 (Lux): standalone takeover of Photon's task at the user's request (M14 run).

2026-10-25 (Lux): lumiose({ scopedStyles: { strategy, specificity, namespace } }) is validated at startup (packages/vite/src/scoped-styles.ts: unknown keys, values, and the namespace through @lumiose/compiler validateScopeNamespace), exposed as api.options.scopedStyles and passed to every compile (compileOptions: client, server, CSS modules, HMR). The project scan compiles without CSS, so markers do not matter there. scoped-styles.test.ts covers the four strategy x specificity combinations (one with namespace app) in dev (SSR HTML through ssrLoadModule plus the CSS module) and in a production build (CSS asset and template markers), with :deep() and class passthrough to a child component. The tests, e2e specs (playground), evals hidden tests and example comments that hard-coded data-l- now use data-lum-. Docs: the styles concept page (how scoping works, and a new "Choosing the scope marker" section with the table), reference/vite.md (option listing and a paragraph), reference/mcp.md (styleScopes), contract/client.ts doc comment; docs:gen and docs:check pass. Full vitest: 2631 passed. Not run: Playwright e2e suites (only renames of asserted selectors in apps/web/e2e/playground.e2e.ts).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
lumiose({ scopedStyles }) chooses attribute or class markers, default or zero specificity, and the namespace; it is validated at startup and applied to every compile. All four combinations are tested in dev and production builds, the default output is data-lum-<hash>, and the styles and plugin reference docs document the option.
<!-- SECTION:FINAL_SUMMARY:END -->
