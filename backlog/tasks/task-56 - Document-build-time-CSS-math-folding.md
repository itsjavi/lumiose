---
id: TASK-56
title: 'Document JS values in styles, including build-time math'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-08 15:54'
updated_date: '2026-10-08 16:15'
labels: []
milestone: m-5
dependencies:
  - TASK-55
documentation:
  - backlog/docs/architecture/doc-1 - Lumen-architecture-specification.md
priority: medium
ordinal: 56000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The user wants build-time math documented together with the section on using JS values in styles ($name), so readers see in one place what can be used, what can't (e.g. function calls) and what gets precomputed. JS constants are folded by the Lumen compiler; CSS math on concrete values is folded by Lightning CSS (calc/min/max/clamp/trig; custom properties via TASK-55).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 docs/concepts/styles.md has one section "JS values in styles" covering: what $name/$obj.key can reference (top-level and component consts, imported export consts, statically evaluable literals/template literals/arithmetic/as-const objects), what cannot (function calls, let, signals/props, array indexing) with the diagnostics, where values may appear (values and @media/@container/@supports, not selectors, strings, url()), and the style-prop bridge for runtime values
- [x] #2 A "Build-time math" subsection in that section: examples table of what folds and what stays (%, vw, em/rem, var() are context-dependent), custom properties, credit to Lightning CSS
- [x] #3 Reference, common mistakes and llms files updated; examples marked check pass
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Probe the compiler (packages/compiler binding + fresh release build of the working tree for TASK-55) for every claim: what folds, LUM3008/3009/3013 messages, where $ is substituted (values, @media/@container/@supports; not selectors, strings, comments, url()).
2. styles.md: replace the $name/runtime paragraphs with '### JS values in styles' at the end of Concept (concept pages keep the 5 fixed ## sections): can/cannot table with diagnostics and fixes, positions, style-prop bridge; '#### Build-time math' with the verified table, context-dependent units, custom properties (TASK-55), Lightning CSS credit. Update the outdated CSS-pipeline status note (TASK-45 done).
3. API table / Common mistakes / Related diagnostics in styles.md; LUM3008/LUM3009 'Reported by' (now reported); compiler.md, vite.md and README status rows if outdated.
4. pnpm --filter lumen docs:gen; vitest src/cli/docs (examples marked check), docs:check, oxfmt on touched docs.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (session beacon-task56-20261008T160359Z) claimed TASK-56.

## Implementation (Beacon)

**Verification.** Every example and table row was checked against the real compiler: @lumen/compiler (packages/compiler native binding, rebuilt 16:05 UTC, includes TASK-45 + TASK-55; it matched a fresh release build of the working tree byte for byte) with probe files in .local/agents/Beacon/beacon-task56-20261008T160359Z/. Custom-property rows also match the committed lumen_css fixture tests/fixtures/math.out. Lux's lightningcss 1.33 table is confirmed by the compiler's Lightning CSS (crate 1.0.0-alpha.72) for all 7 rows.

**Findings documented.** (1) Lightning CSS reads a bare number in a length property as px (gap: $gap -> 8px; LengthValue::parse 'quirks mode' TODO) but not in number properties or custom properties: docs say not to rely on it. (2) margin: $gap px ships as '8 px' with no diagnostic (common mistake). (3) A declaration with var() is kept whole by Lightning CSS, constant parts included (calc(var(--w) + 8 * 2px)); tip: do the math in JS. (4) <style global> inside a component can read the component's consts. (5) $ in a selector (.size-$md) drops the rule with LUM3015; [href$=...] unaffected. (6) z-index: calc(3 * 2) is not folded (integer property) - not documented, harmless.

**Changes (packages/lumen/docs only).** concepts/styles.md: '### JS values in styles' at the end of Concept (concept pages must keep exactly the five ## sections, docs.test.ts) with can/cannot tables (LUM3008/3009/3013 + fixes), where $ is read, runtime bridge, a checked theme.ts + components/Meter.stsx example with its real CSS output, and '#### Build-time math' (verified table, context-dependent units, var(), custom properties per TASK-55, Lightning CSS credit); API rows, 4 new common mistakes, LUM3014/3015 in related diagnostics; status note updated (TASK-45 done). errors/LUM3008 (now reported; reasons and fixes), LUM3005/3009/3014/3015/3016 'Reported by' (no longer 'once the CSS pipeline lands'), LUM3012 marked planned (TASK-62). README (Styles line, status row), getting-started, concepts/compiler.md, reference/vite.md status. Per Lux: reference/app.md endpoint example declares export const mode = "server" (LUM5005, spec §8 l.605: per-request endpoint using cookies + POST). llms.txt/llms-full.txt regenerated.

**Not done here.** TASK-61 (Halo, in progress) may keep negative calc() results in non-negative properties; that task should add a line to the Build-time math section when it lands. Follow-up TASK-66: lumen check/LSP do not answer moduleRequests, so files importing $ constants get no CSS diagnostics there.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
docs/concepts/styles.md now has one 'JS values in styles' section: what $name/$obj.key can reference (top-level and component consts, imported export consts incl. default/namespace/JSON, literals, template literals, arithmetic, as-const objects), what cannot (calls such as $space(2), let, signals/props, $arr.0, $brand-primary, out-of-scope consts, refs above their const) with LUM3008/3009/3013 and fixes, where $ is read (values and @media/@container/@supports preludes; not selectors, property names, strings, comments, url()), the style-prop/var() bridge, and a checked token-module example with its real compiled CSS. Its 'Build-time math' subsection explains the two steps (JS math by Lumen, CSS math by Lightning CSS) with a verified input/output table, why %, vw/vh, em/rem and var() cannot fold, custom-property folding (TASK-55: 16px, negatives/fractions kept in calc()), and credits Lightning CSS. Also: API table, common mistakes, related diagnostics, outdated CSS-pipeline status notes (styles, README, reference/vite, LUM3005/3008/3009/3012/3014-3016), the LUM5005-failing endpoint example (mode = "server"), llms regenerated. Validation: every example verified with @lumen/compiler output; vitest src/cli/docs 16/16 (checked examples pass), docs:check clean, oxfmt applied. Follow-up: TASK-66.
<!-- SECTION:FINAL_SUMMARY:END -->
