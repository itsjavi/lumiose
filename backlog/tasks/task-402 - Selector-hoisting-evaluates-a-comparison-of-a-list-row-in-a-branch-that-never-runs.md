---
id: TASK-402
title: >-
  Selector hoisting evaluates a comparison of a list row in a branch that never
  runs
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 22:02'
updated_date: '2026-10-15 23:38'
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
- [ ] #1 A selector's source is not evaluated before a row reaches the comparison, or an error there does not escape untaken branches
- [ ] #2 A compiler or SSR test covers the repro
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-10-16 (Lux, orchestrator): assigned to Photon (compiler), in M12, where it was found.

2026-10-16 (Lux, orchestrator): reassigned to Beacon for batch 6. New sessions cannot start from an automated turn, so the idle Beacon session takes it; it may edit the files the fix needs.
<!-- SECTION:NOTES:END -->
