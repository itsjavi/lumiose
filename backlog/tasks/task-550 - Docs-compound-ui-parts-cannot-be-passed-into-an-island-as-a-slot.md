---
id: TASK-550
title: 'Docs: compound ui parts cannot be passed into an island as a slot'
status: Done
assignee:
  - Halo
created_date: '2026-10-23 22:12'
updated_date: '2026-10-23 22:37'
labels:
  - ui
  - docs
dependencies: []
priority: low
ordinal: 542000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
From a port's forms, actions and auth slice (2026-10-24). An island renders `<Combobox.Root><Combobox.Input/><Combobox.List>{props.options}</Combobox.List></Combobox.Root>` and the page passes `options={items.map((i) => <Combobox.Item value={i}>{i}</Combobox.Item>)}`: SSR throws "Combobox parts must be inside <Combobox.Root>", since slots render in the page's context. Workaround: pass the data as props and render the items inside the island.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The Islands docs (slots) and the ui docs (compound components) say that a part rendered in a slot does not see its Root inside the island, with the props workaround
- [x] #2 The error message points at the slot case when it can
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Halo (2026-10-24): Islands concept page, slots paragraph: a slot renders in the page before the island runs, so compound parts passed as a slot do not see the island's Root; the error quoted, with a throws/works example (data as a prop, parts rendered inside the island). ui docs README, Approach > Parts: a Root and its parts render on the same side of an island boundary (slot case, and an island inside a page-rendered Root), with the props workaround and a link to Islands. Error: one shared helper, packages/ui/src/not-inside.ts (notInside(subject, container)), now used by every 'must be inside' throw (23 files, 26 sites); it keeps the old first sentence, so existing tests still match, and adds: 'If this part looks inside, check for an island in between: a part passed to an island as a slot (children or a JSX prop) renders in the page, not inside the components the island renders around it. Pass the data as props and render the parts inside the island.' The slot cannot be detected from ui without a runtime API (slots render eagerly in the call site's frame, server/island.ts), so the hint is always there. Toast.useToastManager()'s hook error is unchanged. Test: packages/ui/src/not-inside.test.tsx reproduces the report with a real client:idle island (throws with the hint; props workaround renders 2 options). Checks: ui tests 80 files/618 tests green, pnpm typecheck green, lumiose and ui docs:gen + docs:check green, cli docs tests and apps/web content test green, oxlint/oxfmt clean on the changed files.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Islands docs (slots) and the ui README (Parts) now say that a compound part passed to an island as a slot renders in the page and does not see the island's Root, with the props workaround. Every ui 'must be inside <X.Root>' error goes through one helper (packages/ui/src/not-inside.ts) that keeps the old sentence and adds the island-in-between hint; a test reproduces the reported Combobox case with a real island. Done on the Halo worktree branch, for Lux to merge.
<!-- SECTION:FINAL_SUMMARY:END -->
