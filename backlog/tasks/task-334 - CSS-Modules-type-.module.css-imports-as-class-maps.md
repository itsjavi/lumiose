---
id: TASK-334
title: 'CSS Modules: type *.module.css imports as class maps'
status: Done
assignee:
  - '@Beacon'
created_date: '2026-10-15 04:11'
updated_date: '2026-10-15 05:28'
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
- [x] #1 In .stsx and .tsx files, `import styles from "./x.module.css"` types `styles` as a read-only class map under `lumiose check`, tsgo and the language server, with `lumiose/env` alone or together with `vite/client` in either order
- [x] #2 Plain `.css` side-effect imports and the `?url`, `?inline` and `?raw` patterns keep their current types
- [x] #3 Tests cover `class={styles.button}` and `class={[styles.a, cond && styles.b, props.class]}`; the dev server and a production SSR build render the same hashed class names on server and client (no hydration mismatch)
- [x] #4 reference/jsx.md and concepts/styles.md describe CSS Modules as supported; docs:gen, docs:check and the docs tests pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Beacon (batch 2): started.

Done. Cause confirmed: TypeScript picks the first declared of equal-prefix patterns, and lumiose/env's *.css came first. Fix in packages/lumiose/src/jsx/css-modules.d.ts: declare module "*module.css" (a read-only class map, compatible with vite/client's CSSModuleClasses) before *.css. The pattern omits the dot on purpose: a second *.module.css merges with vite/client's into a duplicate default export (TS2300) when skipLibCheck is off; ./*.module.css is not allowed (TS2436, relative ambient name). Side effect: a file named xmodule.css would also get the class-map type (documented). Verified all 6 combinations (lumiose/env alone, with vite/client before and after; skipLibCheck on and off). Tests: jsx-types.test.ts (three types orders, skipLibCheck off, .tsx with class={styles.x} and class={[styles.a, cond && styles.b, props.class]}, ?url/?inline/?raw and side-effect imports unchanged, read-only and string checks); language-server server.test.ts (a .stsx buffer with a CSS module: no diagnostics, hover shows the class map); cli.test.ts (lumiose check clean; build: prerendered HTML classes equal the client chunks and CSS; preview: a server-rendered page has the same classes; dev: the page and the module the browser imports agree). Browser check: an island using a CSS module hydrates without mismatch warnings in dev and preview, and toggles its class. Docs: reference/jsx.md (env declaration and explanation) and concepts/styles.md (CSS Modules supported, a type-checked .stsx example, when to prefer style blocks). No new public names.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
*.module.css imports are typed as read-only class maps (lumiose/env alone or with vite/client in either order, library checks on); tests cover types, the language server, and identical hashed classes on server and client in dev and builds; docs describe CSS Modules as supported.
<!-- SECTION:FINAL_SUMMARY:END -->
