---
id: TASK-360
title: 'bind: on components and custom elements'
status: Done
assignee:
  - '@Photon'
created_date: '2026-10-15 16:46'
updated_date: '2026-10-15 17:24'
labels:
  - ui
milestone: m-12
dependencies: []
priority: high
ordinal: 361000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Contract: decision-62 (approved by the user on 2026-10-15 from the TASK-332 spike; prototypes in examples/ui-spike, proposal and measurements in TASK-332's notes). Approved syntax: bind:x on a component with an x prop and an onXChange callback (bind:open on Dialog.Root, bind:value on Combobox.Root, bind:checked on Menu.CheckboxItem), and on a custom element with an x property and a change event. The compiler expands it to the prop plus the callback; types come from the component's props.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 bind:x compiles to x and onXChange on components and to the property and change event on custom elements, server and client
- [x] #2 Type errors for a component without x or onXChange
- [x] #3 concepts/jsx.md documents it
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Photon, 2026-10-15. Design and implementation:
- Components: the compiler expands bind:x={signal} in the props object to a getter x (signal(), memoized on the server like any getter prop) and onXChange: (v) => signal.set(v). An onXChange written next to bind:x is composed, not overwritten: (v, ...a) => (signal.set(v), handler?.(v, ...a)). A signal expression that is not a name or member chain (bind:value={useSelection()}) is evaluated once, as an argument of the props object's arrow. crates/lumiose_compiler/src/codegen/client/components.rs.
- Custom elements: client bindProperty(el, "x", signal) (new lumiose/dom contract helper, doc-2 table and contract/client.ts): sets the x property and reads it back on the element's own input, change and xchange (lowercase) events; events whose target is a child are ignored (lu-combobox's inner <input> fires its own change). Server: attr("x", signal(), true), the custom-element attribute rule of TASK-337 (<lu-menu open>, value="apple").
- bind: attributes next to a spread are taken out of the spread and applied after it, on elements (client and server); before, bind:value went through spread() as a "bind:value" attribute.
- Types (packages/lumiose/src/jsx/jsx-runtime.ts, Beacon's file, edited for this task): LibraryManagedAttributes adds ComponentBindings<P> (bind:x for each prop x with an onXChange, typed WritableSource<P[x]>) to the non-island branch, plus RequiredBindings<P> (a union member where bind:x stands in for required x/onXChange; never when none is required, so error messages of other components are unchanged). Island call sites have no bind:. Declared custom elements declare bind:x themselves ("bind:open"?: Signal<boolean>); undeclared ones accept anything.
- Execution contract (language server hovers): bind:x on a component is Tracked Prop via getter; on a custom element Tracked Property via bindProperty.
- Tests: codegen golden bind-components (client and server), compile_api contract test, dom/element.test.ts bindProperty, compiler execute/server tests (compiled output on lumiose/dom and lumiose/server), JSX type fixtures (bindings.tsx: accepted and @ts-expect-error cases).
- Docs: concepts/jsx.md (section and common mistake), reference/jsx.md, guides/web-components.md (Two-way binding), reference/dom.md (contract list), llms regenerated.
- Public names for the user's review: bindProperty (lumiose/dom contract helper, compiler-emitted, not an app API); the custom-element event rule (input, change, xchange); onXChange composition order (signal first, then the handler).
- Found: bindValue, bindChecked and bindProperty miss a write of the previous value made before the next flush (the signal's net value is unchanged, so the render effect does not re-run and the element keeps the user's value). Core/dom issue, recorded as a task for Spark.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
bind:x works on components (x plus onXChange, an onXChange next to it still runs) and custom elements (bindProperty: the x property plus the element's own input, change and xchange events), in client and server output; types come from the component's props (bind:x only for props with onXChange, a type error otherwise, none on islands). Docs: concepts/jsx.md, reference/jsx.md, guides/web-components.md, reference/dom.md. Validation: pnpm check (typecheck, lint, tests, size: core+dom+islands 9.22 kB, whole runtime 13.37 kB brotli), cargo fmt, clippy -D warnings, cargo test, all 15 Playwright suites (7 rerun after port clashes with other worktrees' servers; ssr-bookshelf's HMR test failed once under that load and passed on rerun). Follow-up: TASK-388 (Spark).
<!-- SECTION:FINAL_SUMMARY:END -->
