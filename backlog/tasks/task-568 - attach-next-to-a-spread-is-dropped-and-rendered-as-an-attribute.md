---
id: TASK-568
title: attach next to a spread is dropped and rendered as an attribute
status: Done
assignee:
  - Photon
created_date: '2026-10-24 17:02'
updated_date: '2026-10-24 18:10'
labels:
  - compiler
  - bug
dependencies: []
priority: high
ordinal: 560000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Halo while building the virtualizer components (TASK-565), on Lumiose 0.7.0. When an element has a spread, the compiler moves its other props into `spread(el, () => mergeProps(rest, { … }))`, and `attach` goes with them: the runtime's spread (packages/lumiose/src/dom/spread.ts) handles `ref` but not `attach`, so the attachment never runs and the element gets an `attach` attribute holding the function's source.

Repro (client output):

```tsx
<li {...props.itemProps?.(item)} data-row={i} attach={[(el) => observe(el)]} />
// renders <li data-row="0" attach="(el) => observe(el)"> and observe never runs
```

Expected: `attach` works next to a spread as without one (the compiler keeps it out of the merged props and emits its `attach` call, or the spread runtime applies it), and it never becomes an attribute. The virtualizer components avoid it by observing their rows from the container (packages/ui/src/virtualizer/virtual.tsx, containerRef).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 An element with a spread and attach={[fn]} runs fn with the element, as without the spread, with a test
- [x] #2 No attach attribute is ever written to the DOM
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon (worktree branch worktree-agent-ab37387d5e8f193fd): claimed; investigating the client and server codegen for spreads next to attach/ref/bind/on/key.

Photon: root cause. With a spread, every attribute except bind: and written content went into spread(el, () => mergeProps(…)), attach included; the runtime spread handled ref but not attach, so setAttr wrote String([fn]), the function's source, and the attachment never ran. The server was safe (spreadAttrs skips attach). Directives checked next to a spread, both orders: attach (broken, fixed), bind:value/bind:checked/bind:x (already taken out and applied after the spread), key and client:* (already dropped by props_expression; the spread runtime also skips key), ref, onX and on:x (props the spread applies, last wins; ref stays so, since packages/ui forwards rest.ref by hand), class/style (spread applies them); class:/style: directives do not exist. Fix: compiler take_written also takes attach (client: its own attach() call after the spread; server: dropped). Runtime (outside Photon's area, scoped by Lux for this bug): spread runs an attach key as attachments (applyAttachments from dom/element.ts; restart on a new list, stop when the key goes away), drops bind:/client: keys like the server's spreadAttrs, and setAttr leaves functions out like the server's attr, so no function source reaches an attribute on either side. Tests: golden spread-directives (both targets), compile_api attach_next_to_a_spread_never_goes_through_it, execute tests (written attach in both orders, ref/bind:value/handlers next to a spread, a spread's own attach forwarded through a component, no attach or function-source attribute anywhere), dom component.test (spread attach lifecycle), server parity.test (attach/bind:/client:/function keys, function attribute values). Docs: concepts/jsx.md (attach, ref and spread rows, functions never attributes), llms-full.txt regenerated. Validation: pnpm check green after the napi rebuild, cargo test/fmt/clippy (-D warnings) green, ui vitest project 619/619, islands-e2e 10/10. Commits on worktree-agent-ab37387d5e8f193fd (not merged): a0a91af1 fix(dom), 2f260c71 fix(compiler). Found and fixed TASK-569 on the way (same branch).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
attach written next to a spread now runs, in either order, on the client and is dropped on the server; a spread's own attach runs too (attachments add up), and no function source is ever written as an attribute (spread or setAttr, matching the server). Commits a0a91af1 and 2f260c71 on worktree-agent-ab37387d5e8f193fd, for 0.7.1.
<!-- SECTION:FINAL_SUMMARY:END -->
