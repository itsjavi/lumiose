---
id: TASK-347
title: Spread props drop children on intrinsic elements
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-15 12:36'
updated_date: '2026-10-16 23:19'
labels:
  - compiler
  - bug
dependencies: []
priority: medium
ordinal: 349000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by the TASK-332 spike (Halo, 2026-10-15) while prototyping @lumiose/ui widgets; details in TASK-332's notes and examples/ui-spike (removed in TASK-363; it remains in the git history). `<button {...props} />` renders no children when props.children is set; React and Solid render them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A spread that carries children renders them on the server and in the client, hydrating without a mismatch
- [x] #2 Compiler and runtime tests cover it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-17 (branch claude/photon-bugs-2c1927). Reproduced on main: `<button {...props} />` compiled to `spread(el, () => props)` alone on the client and `spreadAttrs(props)` on the server; `spread`/`spreadAttrs` skip `children`, so nothing rendered them.
Fix (compiler, element.rs `props_children`, called by build_element and ssr_element): an intrinsic element with a spread or a `children` attribute and no content of its own (JSX whitespace and empty `{}` don't count, as in React) gets a `{….children}` child before either target compiles it, so the server renders it and the client claims it like a written child: `x.children` for a lone `{...x}`, the value of a `children` attribute after every spread, else `mergeProps(…).children`. `children` attributes are taken out (`<div children={x} />` used to set a `children` attribute). Void elements, script, style, textarea, template, noscript and iframe get no child. Runtime unchanged.
Tests: golden spread-children.tsx (client and server); goldens bind-components, spread-defaults, ssr-attributes updated (their childless spread elements now insert children); hydrate.test.ts 'renders the children of a spread on an element without content (TASK-347)' (failed before the fix: the server HTML had empty buttons).
Docs: concepts/jsx.md (elements table), concepts/components.md (children), coming-from/react.md; doc-2 template/server alignment bullet.
Cost: a childless element with a spread now runs one insertText binding (as Solid's spread does). Follow-up TASK-466: LUM2005 does not count this implicit insert.

Revised (Photon, 2026-10-17) after the ui-e2e run: an unconditional children insert broke content that scripts or the browser own in childless spread elements: Combobox.Chips (`<div {...rest} />`, filled by the combobox script before the island hydrates: LUM4006 in dev) and Select.Value (`<selectedcontent {...props} />`, filled by the browser: an empty trigger in build). Spreads alone now insert `children` only when the props object has the key: client `"children" in obj && insert(el, () => obj.children)` with no template node (Op::SpreadChildren), server `"children" in obj ? insert(obj.children) : ""`. Props objects keep their keys once created, so both sides agree; without the key the element's content is left alone (the hydration walk tolerates content of a template element without children). A `children` attribute still compiles to a written child. New hydration test: 'leaves the content of a spread without children to scripts (TASK-347)'. Cost note: an element whose spread has no children key pays one `in` check, nothing else.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
An intrinsic element without content of its own now renders the children its spreads or a children attribute carry, as in React and Solid, on the server and in the browser, and hydrates without LUM4006. Spreads alone insert children only when their props object has the key, so content that scripts or the browser fill (Combobox chips, <selectedcontent>) is left alone. children attributes are never attributes. Compiler goldens, three hydration tests; docs (JSX, components, coming-from React) and doc-2 updated. ui-e2e (976 passed) and apps/web e2e green.
<!-- SECTION:FINAL_SUMMARY:END -->
