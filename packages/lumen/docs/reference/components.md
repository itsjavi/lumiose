# `lumen`: components

> Signatures and behavior of the built-in components and element helpers exported by `lumen`: `Suspense`, `ErrorBoundary`, `Portal`, `Dynamic`, `ref`, `Head`, `Title` and `Meta`.

All are exported by `lumen` in the browser and on the server. Concepts:
[Components](../concepts/components.md), [Async components](../concepts/async.md),
[Head and document](../concepts/head.md).

## Suspense

```ts
function Suspense(props: SuspenseProps): JSX.Element;
interface SuspenseProps {
  /** Shown while new content below is pending. */
  fallback?: JSX.Element;
  children?: JSX.Element;
}
```

Shows `fallback` while **new** async content below it is pending: the first load, and async
components or resources that a branch mounts later. Re-runs of revealed content keep their stale UI
(`pending()` tells them apart). Hidden content stays alive. A shown fallback counts for `busy()`.
On the server, a boundary marks content that streams after the shell; with prerendering it is
resolved inline.

## ErrorBoundary

```ts
function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element;
interface ErrorBoundaryProps {
  /** Rendered instead of the children after an error. */
  fallback?: JSX.Element | ((error: unknown, retry: () => void) => JSX.Element);
  children?: JSX.Element;
}
```

Renders `fallback` when its children throw while rendering, an effect below throws, or an async
component below rejects. `retry()` disposes the fallback and mounts the children again. On the
server, an error in a streamed boundary renders the nearest `ErrorBoundary` in place.

## Portal

```ts
function Portal(props: PortalProps): JSX.Element;
interface PortalProps {
  /** Where the content goes. Default: document.body. */
  mount?: Node;
  children?: JSX.Element;
}
```

Renders `children` into a `<div>` appended to `mount`, removed with the owner. Delegated events
from the portal's content continue at the portal's position in the component tree.

## Dynamic

```ts
function Dynamic(props: DynamicProps): JSX.Element;
interface DynamicProps {
  /** A component or an intrinsic tag name. Nothing renders while it is nullish or false. */
  component: Component | string | null | undefined | false;
  [prop: string]: unknown;
}
```

Renders `component` with the other props, re-creating it only when `component` changes.

## ref

```ts
function ref<T extends Element>(): JSX.Ref<T>;
```

A callback for the `ref` prop that can also be read like a signal: `input()` is `undefined` until
the element exists. Pass it as `ref={input}`.

## Title

```ts
function Title(props: { children?: JSX.Element }): JSX.Element;
```

Sets the document title. The deepest `<Title>` wins, so a page overrides its layouts.

## Meta

```ts
function Meta(props: Record<string, unknown>): JSX.Element;
```

Adds or updates a `<meta>` in `<head>`, with the given attributes. Metas with the same `charset`,
`name`, `property`, `http-equiv` or `itemprop` dedupe: the deepest wins, and the previous one comes
back when it is removed.

## Head

```ts
function Head(props: { children?: JSX.Element }): JSX.Element;
```

Appends its children to `<head>` and removes them on disposal. Elements equal to one already in
`<head>` (for example rendered by the server) are skipped.

## Example

```tsx check
import { Dynamic, ErrorBoundary, Portal, Suspense, ref, signal } from "lumen";

function Info() {
  return <p>Info</p>;
}

export function Dialog() {
  const open = signal(false);
  const kind = signal<"h2" | "h3">("h2");
  const button = ref<HTMLButtonElement>();

  return (
    <ErrorBoundary fallback={(error, retry) => <button onClick={retry}>{String(error)}</button>}>
      <button ref={button} onClick={() => open.set(true)}>
        Open
      </button>
      {open() && (
        <Portal>
          <div role="dialog">
            <Dynamic component={kind()}>Title</Dynamic>
            <Suspense fallback={<p>Loading…</p>}>
              <Dynamic component={Info} />
            </Suspense>
            <button onClick={() => (open.set(false), button()?.focus())}>Close</button>
          </div>
        </Portal>
      )}
    </ErrorBoundary>
  );
}
```
