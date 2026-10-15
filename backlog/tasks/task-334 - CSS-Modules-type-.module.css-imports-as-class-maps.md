---
id: TASK-334
title: 'CSS Modules: type *.module.css imports as class maps'
status: To Do
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:11'
labels:
  - css
  - typescript
milestone: m-11
dependencies: []
references:
  - packages/lumiose/src/jsx/css-modules.d.ts
  - packages/lumiose/docs/reference/jsx.md
priority: medium
ordinal: 336000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agreed with the user on 2026-10-15: Lumiose stays compatible with CSS Modules, next to scoped `<style>` blocks. Vite already processes `*.module.css` imports (hashed class names, a class map as the default export), but the types are wrong: `lumiose/env` (packages/lumiose/src/jsx/css-modules.d.ts) declares `*.css` as a side-effect-only module, and with `lumiose/env` loaded before `vite/client` it also matches `*.module.css`, so `import styles from "./x.module.css"` has no default export type (docs/reference/jsx.md says so and that style blocks replace CSS Modules).

Likely cause: `*.css` and `*.module.css` have the same (empty) prefix, and TypeScript picks the first declared pattern on a tie. Declaring `*.module.css` (a read-only class map, compatible with `vite/client`'s `CSSModuleClasses`) before `*.css` should fix it; verify with both load orders. Preprocessor module extensions (`.module.scss` and others) are out of scope.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 In .stsx and .tsx files, `import styles from "./x.module.css"` types `styles` as a read-only class map under `lumiose check`, tsgo and the language server, with `lumiose/env` alone or together with `vite/client` in either order
- [ ] #2 Plain `.css` side-effect imports and the `?url`, `?inline` and `?raw` patterns keep their current types
- [ ] #3 Tests cover `class={styles.button}` and `class={[styles.a, cond && styles.b, props.class]}`; the dev server and a production SSR build render the same hashed class names on server and client (no hydration mismatch)
- [ ] #4 reference/jsx.md and concepts/styles.md describe CSS Modules as supported; docs:gen, docs:check and the docs tests pass
<!-- AC:END -->
