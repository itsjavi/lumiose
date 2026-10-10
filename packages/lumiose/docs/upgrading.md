# Upgrading from 0.1

> The next release renames several APIs to the names React, Solid and Svelte use for the same behavior. The old names are removed, with no aliases: this page lists every rename and how to migrate.

The renames change names only, except context, where `provide()` becomes a provider component.
Type errors point at every place to update: `lumiose check` (or `tsc`) reports each old import as a
missing export.

## Migration table

| 0.1                                                | Now                                                                        | Entry            |
| -------------------------------------------------- | -------------------------------------------------------------------------- | ---------------- |
| `inject(Ctx)`                                      | `useContext(Ctx)`                                                          | `lumiose`        |
| `provide(Ctx, value)`                              | `<Ctx value={value}>…</Ctx>`                                               | `lumiose`        |
| `lifetime()`                                       | `getAbortSignal()`                                                         | `lumiose`        |
| `pending()`                                        | `isPending()`                                                              | `lumiose`        |
| `busy()`                                           | `isBusy()`                                                                 | `lumiose`        |
| `submitting(name?)`                                | `isSubmitting(name?)`                                                      | `lumiose`        |
| `flushSync()`                                      | `flush()`                                                                  | `lumiose`        |
| `navigating()`                                     | `isNavigating()`                                                           | `lumiose/router` |
| `search()`, `search.set()`, `Search`, `SearchInit` | `searchParams()`, `searchParams.set()`, `SearchParams`, `SearchParamsInit` | `lumiose/router` |
| `mount(code, container)`                           | `render(code, container)`                                                  | `lumiose/dom`    |

Signatures and behavior are unchanged, apart from context.

## Context: `provide()` becomes `<Ctx value>`

`createContext()` returns a provider component, as in React 19 and Solid 2. Instead of calling
`provide()` in a component body, wrap the subtree that should see the value:

```tsx
// 0.1
export function Shop() {
  provide(CartContext, createCart());
  return <Products />;
}

// Now
export function Shop() {
  return (
    <CartContext value={createCart()}>
      <Products />
    </CartContext>
  );
}
```

Differences to keep in mind:

- The value reaches the provider's children only. A component that called `provide()` and then
  read the context itself with `inject()` now reads it in a component inside the provider.
- The provider reads `value` once, when it renders, as before: to share changing state, provide a
  signal, a store or an object with getters.
- Islands still start a new context root: a provider in the page does not reach an island
  ([LUM4010](errors/LUM4010.md)).

## Other changes

- **App entries and HMR.** With `@lumiose/vite`, an app entry is detected by its `render` import
  from `lumiose/dom` (it was `mount`). Rename the import and the entry keeps re-rendering on hot
  updates.
- **`ErrorBoundary`.** The docs call the fallback's second argument `reset` (it was `retry`), as
  Solid and react-error-boundary do. It is only a parameter name: existing code keeps working.
- **`url()`, `params()`, `route()`.** Unchanged. Those of `lumiose` read the request and are
  server-only (`LUM4003` in the browser); those of `lumiose/router` are reactive and work in the
  browser too.

See also: [Signals and reactivity](concepts/signals.md), [Sharing state](concepts/state.md),
[`lumiose`: reactivity](reference/reactivity.md).
