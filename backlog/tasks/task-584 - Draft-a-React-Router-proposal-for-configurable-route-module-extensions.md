---
id: TASK-584
title: Draft a React Router proposal for configurable route module extensions
status: To Do
assignee:
  - '@Lux'
created_date: '2026-10-25 00:31'
updated_date: '2026-10-25 00:40'
labels:
  - proposal
  - stsx
milestone: m-14
dependencies: []
references:
  - >-
    backlog/decisions/decision-86 -
    .stsx-in-other-JSX-frameworks-through-lumiose-stsx.md
  - >-
    backlog/tasks/task-571 -
    Spike-.stsx-in-React-React-Router-and-Solid-through-lumiose-stsx.md
priority: low
ordinal: 576000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
React Router 8.4 hard-codes `.[jt]sx?` in its route-module transforms (refresh, route exports) and matches module ids against routes.ts paths, so `.stsx` route modules cannot work (TASK-571). Draft the issue or RFC text in this task. Nothing is posted until the user has reviewed it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The task notes hold a draft that describes the problem, the transforms involved and a minimal API proposal
- [ ] #2 The user has reviewed the draft before anything is posted
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Draft for the user's review (Lux, 2026-10-25). Nothing has been posted; per the user's rule, nothing goes to another project's repository without their review.

---
Title: Route modules whose extension another Vite plugin compiles (such as `.stsx`)

**Context.** Vite plugins that compile a custom file type to TSX work for components that route modules import. A route module itself cannot use such an extension. The motivating case is @lumiose/stsx: `.stsx` is TSX plus raw-CSS `<style>` blocks. The same applies to any extension compiled to TSX.

**What happens in 8.4.0** (`@react-router/dev/vite`)
1. **Route-module transforms never match.** `react-router:route-exports` (server-export removal and `withComponentProps`) finds route modules through `getRoute(config, id)`, which compares the module id with the routes.ts path. Other plugins and Vite's oxc transform only accept `.[jt]sx?`, so a compiling plugin serves `about.stsx` under a different id (`about.stsx.tsx`). That id never matches, with two consequences:
   - In dev, the client module keeps `loader` and `action`, together with their imports.
   - The route component gets no `loaderData`, so SSR fails.
2. **Keeping the real `.stsx` id fails the extension filters instead.** `react-router:react-refresh-babel` accepts only `/\.(jsx?|tsx?|mdx?)$/`, and Vite's oxc transform only `.[jt]sx`.
3. **`compileRouteFile` already works.** It reads the route file from disk and transforms it under the resolved id, so a plugin that emits in `transform` is supported.

**Proposal (no new option)**
1. Match route modules by resolved id as well. Resolve each routes.ts file once through the plugin container, and treat a module as that route when its id is the file path or the resolved id. `react-router:route-exports`, `withComponentProps`, the HMR route metadata and the build manifest lookups would then work for any plugin that serves a route file under another id.
2. Let the refresh transform run on route modules found that way, whatever their extension. It already checks for the JSX dev runtime in the code.

**Alternative.** A `routeModuleExtensions` option in react-router.config.ts, applied to every extension filter of the plugin.

**Repro.** A minimal repository with a `.tsx` route and a `.stsx` route, to create when posting.
---
<!-- SECTION:NOTES:END -->
