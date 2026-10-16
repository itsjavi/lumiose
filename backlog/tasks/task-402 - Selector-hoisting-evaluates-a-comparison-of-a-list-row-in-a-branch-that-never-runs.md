---
id: TASK-402
title: >-
  Selector hoisting evaluates a comparison of a list row in a branch that never
  runs
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 22:02'
updated_date: '2026-10-16 00:21'
labels:
  - compiler
  - ssr
milestone: m-12
dependencies: []
priority: high
ordinal: 401000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Beacon on 2026-10-15, while prerendering apps/web after TASK-387. In a `.map` callback, the compiler rewrites `id === expr` into a selector created at the component's top: `const _isSelected = selector(() => expr)`. The selector evaluates `expr` at once, even when the comparison sits in a branch that never runs, so an expression that is only valid inside that branch throws during SSR. Repro (`compile(…, { target: "server" })`):

```tsx
export function Mapped(props) {
  return <div>{["a"].map((id) => (props.on ? <p>{id === boom().id ? <b /> : <i />}</p> : <span>{id}</span>))}</div>;
}
// → const _isSelected = selector(() => boom().id); … list(["a"], (id) => props.on ? … _isSelected(id) … : …)
```

With `props.on` false, `renderToString` throws the error from `boom()`. The same comparison with a flat child (`<p>{boom().id}</p>`) does not. apps/web's DocArticle hit it (`block.demo.id === demos()[0]!.id` on pages without demos) and now reads `first()?.id`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A selector's source is not evaluated before a row reaches the comparison, or an error there does not escape untaken branches
- [x] #2 A compiler or SSR test covers the repro
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Photon (compiler), in M12, where it was found.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 6. New sessions cannot start from an automated turn, so the idle Beacon session takes it; it may edit the files the fix needs.

2026-10-16 (Beacon, branch claude/beacon-m12b-ee0e55, solo takeover in batch 6): fixed in 784d459c, in the runtimes rather than the compiler.

The compiler's output stays the same: `const _isSelected = selector(() => expr)` at the component's top. Hoisting keeps one selector per list, the O(1) selection. What changed is when the source first runs.
- Server (`packages/lumiose/src/server/ssr.ts`): the source is evaluated once, on the first comparison, instead of at creation.
- Client (`packages/lumiose/src/dom/selector.ts`): the selector's render effect is created on the first tracked check, under the owner that was current when the selector was created. So it is disposed with the component, not with the first row that read it. Untracked checks just compare with `untrack(source)`.

Tests (both fail without the fix):
- selector.test.ts: the source does not run before the first tracked check; the effect survives the first reader's disposal and notifies the next one.
- hydrate.test.ts: the task's repro, compiled for both targets, renders and hydrates with `props.on` false, with no warnings and the same HTML.

apps/web: DocArticle drops its workaround and reads `first()!.id` again. The site builds and prerenders every page.

No performance claim: the client adds one boolean check per tracked call, and no A/B was run.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both runtimes' selector() evaluate the source on the first comparison (the client creates its effect on the first tracked check, under the selector's owner), so a comparison in an untaken branch never runs; unit and compiled SSR/hydration regression tests; DocArticle's workaround removed (784d459c). Checks: pnpm check (2295 tests), cargo fmt/clippy/test, pack:check --smoke --skip-npm, ui-e2e 519 passed (15 skipped), apps/web 159 passed (4 skipped).
<!-- SECTION:FINAL_SUMMARY:END -->
