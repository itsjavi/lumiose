---
id: TASK-402
title: >-
  Selector hoisting evaluates a comparison of a list row in a branch that never
  runs
status: To Do
assignee: []
created_date: '2026-10-15 22:02'
labels:
  - compiler
  - ssr
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
