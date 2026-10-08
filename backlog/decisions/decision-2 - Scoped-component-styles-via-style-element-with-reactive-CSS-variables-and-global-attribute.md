---
id: decision-2
title: >-
  Scoped component styles via <style> element with reactive CSS variables and
  global attribute
date: '2026-10-08 10:02'
status: superseded by decision-12
---
## Context

Styles must be first-class in Lumen components and must improve on Svelte, Vue and Astro, within the constraint that components are valid TSX (decision-1). Svelte and Vue have shown that component-scoped CSS written as real CSS is the most familiar and portable model for humans and agents. Vue's `v-bind()` in CSS and Svelte's `style:` show the value of reactive values in CSS. A common annoyance in Svelte, Vue and Astro is having to sprinkle `:global(...)` when a block is meant to be global.

The user accepted scoped CSS with reactive variables, with one extra requirement: global styles must be possible without writing `:global` everywhere, through a special attribute on `<style>`.

Alternatives considered:
- StyleX-like typed style objects. Type-safe, but not the CSS people and agents already write.
- Both layers as the default. Too much surface area for v1. Typed design tokens may come later on top of scoped CSS.

## Decision

- Component styles are written as `<style>{css`...`}</style>` anywhere in the component's JSX. A component may have several; the compiler removes them from the rendered output.
- **Scoped by default.** Selectors only match elements rendered by the templates of the module (file) that contains the style. The scope unit is the file, so helper components and JSX helpers in the same file share it (spec §4.4). The compiler stamps a per-component scope token into the static templates at build time, so scoping has no runtime cost. Children passed in from a parent keep the parent's scope.
- **`<style global>`** emits the whole block unscoped. `:global(...)` stays available as a targeted escape inside scoped blocks.
- **`${expr}` interpolations are allowed only in value positions.** Static expressions are inlined at build time. Dynamic expressions compile to per-instance CSS custom properties, which are set on the component's root element(s) through fine-grained signal bindings and inlined as `style` on SSR.
- CSS is extracted at build time into regular CSS assets through the Vite pipeline, with no CSS-in-JS runtime. Nesting, minification and browser targets are handled by Lightning CSS.
- The scoping output technique (hashed class or attribute rewriting versus native `@scope`) follows the TASK-2 research and is specified in the architecture spec.

## Consequences

- Plain `.css` imports, CSS Modules and Tailwind keep working through Vite alongside component styles.
- Editor support for CSS inside `css` templates comes from the Lumen VS Code extension, not from TypeScript.
- The compiler can report unused scoped selectors and invalid interpolation positions as diagnostics.
- Root elements carry the custom properties. A component that has dynamic CSS values but no element root needs a compiler diagnostic and a documented workaround.

