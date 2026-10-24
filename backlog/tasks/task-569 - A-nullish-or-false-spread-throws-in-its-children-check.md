---
id: TASK-569
title: A nullish or false spread throws in its children check
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-24 17:56'
updated_date: '2026-10-24 18:11'
labels:
  - compiler
  - bug
dependencies: []
priority: high
ordinal: 561000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Found by Photon while fixing TASK-568. An element with a spread and no content of its own checks `"children" in <spread>` to render the spread's children (TASK-347), on both targets. A nullish or `false` spread (`{...props.extra}`, `{...props.itemProps?.(item)}`, `{...(open && attrs)}`) is valid JSX, but `in` throws a TypeError on it, so the component fails to render (client) or the page fails (server).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A nullish or false spread on an element without content renders without throwing, on the client and the server, with a test
- [x] #2 A spread object with children still renders them
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon: fixing on worktree branch worktree-agent-ab37387d5e8f193fd together with TASK-568 (same spread codegen); the check becomes `"children" in Object(<spread>)`.

Photon: the client and server children check of an element with a spread (`"children" in <spread>`, TASK-347) is now `"children" in (<spread> || {})` for any spread other than the component's props, its ...rest or merged spreads (mergeProps already skips nullish sources), and the server's spreadAttrs returns "" for a nullish spread (Object.keys threw). The client spread already tolerated it. Tests: golden spread-children (Optional: `{...props.extra}`, `{...(open && attrs)}`), spread-directives Row, execute test rendering Row without itemProps, server parity.test (nullish spread on both sides); the spread-children goldens keep checking children of spread objects. Commits on worktree-agent-ab37387d5e8f193fd (not merged): a0a91af1 (spreadAttrs), 2f260c71 (compiler).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
A nullish or false spread on an element without content no longer throws on either target. Commits a0a91af1 and 2f260c71 on worktree-agent-ab37387d5e8f193fd, for 0.7.1.
<!-- SECTION:FINAL_SUMMARY:END -->
