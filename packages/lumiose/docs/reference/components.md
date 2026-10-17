# `lumiose`: components

> Signatures of the built-in components, from Suspense and error boundaries to portals, head tags and view transitions.

All are exported by `lumiose` in the browser and on the server. Concepts:
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
(`isPending()` tells them apart). Hidden content stays alive. A shown fallback counts for `isBusy()`.
On the server, a boundary marks content that streams after the shell; with prerendering it is
resolved inline.

## ErrorBoundary

```ts
function ErrorBoundary(props: ErrorBoundaryProps): JSX.Element;
interface ErrorBoundaryProps {
  /** Rendered instead of the children after an error. */
  fallback?: JSX.Element | ((error: unknown, reset: () => void) => JSX.Element);
  children?: JSX.Element;
}
```

Renders `fallback` when its children throw while rendering, an effect below throws, or an async
component below rejects. `reset()` disposes the fallback and renders the children again. On the
server, an error in a streamed boundary renders the nearest `ErrorBoundary` in place.

In production server rendering, a fallback receives a generic `Error` with a short `digest`
(`An error occurred while rendering this part of the page (digest 1a2b3c4d).`) instead of an
error that is not an `HttpError`, which could reveal a database message or a file path. The
original error goes to the server log (the request handler's `onError`) with the same `digest`
property, so a user's report can be matched to the log entry. `HttpError`s (`notFound()`,
`error(403, …)`) reach the fallback as they are, development keeps the raw error, and boundaries
that catch in the browser get the error itself (decision-29).

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

Renders `component` with the other props, re-creating it only when `component` changes. With a tag
name, the props are the element's written props, `innerHTML` and `textContent` included: do not
spread an untrusted object (a JSON payload) into `Dynamic`.

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

Sets the document title. The deepest `<Title>` wins, so a page overrides its layouts. It replaces
the `<title>` that `src/document.stsx` writes in `<head>`, which comes back after an SPA navigation to
a page without a `<Title>` ([head defaults](../concepts/head.md)).

## Meta

```ts
function Meta(props: Record<string, unknown>): JSX.Element;
```

Adds or updates a `<meta>` in `<head>`, with the given attributes. Metas with the same `charset`,
`name`, `property`, `http-equiv` or `itemprop` dedupe: the deepest wins, and the previous one comes
back when it is removed. A `<Meta>` replaces the `<meta>` with the same key that the document writes
in `<head>` (`src/document.stsx`, or the default document's `charset` and `viewport`), which comes
back after an SPA navigation to a page without one.

## Head

```ts
function Head(props: { children?: JSX.Element }): JSX.Element;
```

Appends its children to `<head>` and removes them on disposal. Elements equal to one already in
`<head>` (for example rendered by the server) are skipped.

## viewTransition

```ts
function viewTransition(fn: () => void): Promise<void>;
```

Runs `fn`, a state update (signal and store writes), inside
[`document.startViewTransition`](https://developer.mozilla.org/docs/Web/API/Document/startViewTransition),
and flushes, so the DOM shows the new state when the browser captures it: the page cross-fades from
the old state to the new one, and named elements morph. The browser captures the old state first,
so `fn` runs a frame later. The promise resolves when the transition finished, and rejects when
`fn` throws. Without View Transitions support, or when the reader prefers reduced motion, it runs
`fn` and flushes at once. On the server it only runs `fn`.

With [`lumiose({ viewTransitions: true })`](vite.md#lumiose), SPA navigations to another page swap
the page inside `viewTransition()` ([Routing](../concepts/routing.md)).

## ViewTransition

```ts
function ViewTransition(props: ViewTransitionProps): JSX.Element;
interface ViewTransitionProps {
  /** The child's view-transition-name. Default: a useId() id, unique in the page. */
  name?: string;
  /** The child's view-transition-class while it enters in a viewTransition(). */
  enter?: string;
  /** The child's view-transition-class while it exits in a viewTransition(). */
  exit?: string;
  /** A single element. */
  children?: JSX.Element;
}
```

Gives its single child element a `view-transition-name`, so that in a `viewTransition()` it
animates on its own instead of with the page:

- **Moves.** In the old and the new state (a keyed list row that moved, a layout change), it morphs
  from its old position and size to the new ones.
- **Enters.** Rendered by the update (a conditional that turns on, a new row), it fades in, with
  `view-transition-class: <enter>` until the transition finished.
- **Exits.** Removed by the update, it fades out, with `view-transition-class: <exit>`. Every
  `<ViewTransition>` with `exit` gets that class before the browser captures the old state (it is
  not known yet which elements go); the ones that stay lose it again.

Style the animations in a global style block with the
[`::view-transition-*`](https://developer.mozilla.org/docs/Web/CSS/::view-transition-new)
pseudo-elements, by name or by class: `::view-transition-new(.slide-in)` for entering elements,
`::view-transition-old(.slide-out)` for exiting ones. The name is set in the browser, when the
element is created or hydrated; for cross-document transitions between MPA pages, set
`view-transition-name` in CSS ([Routing](../concepts/routing.md)). Anything but one element child
renders unnamed, with a warning in development.

```tsx check
import { signal, viewTransition, ViewTransition } from "lumiose";

export function Notifications() {
  const items = signal([{ id: 1, text: "Welcome" }]);
  let next = 2;
  const add = () =>
    viewTransition(() => items.set([{ id: next, text: `Note ${next++}` }, ...items()]));
  const dismiss = (id: number) =>
    viewTransition(() => items.set(items().filter((item) => item.id !== id)));

  return (
    <section>
      <button onClick={add}>Add</button>
      <ul>
        {items().map((item) => (
          <ViewTransition key={item.id} enter="slide-in" exit="slide-out">
            <li>
              {item.text} <button onClick={() => dismiss(item.id)}>Dismiss</button>
            </li>
          </ViewTransition>
        ))}
      </ul>
    </section>
  );
}
```

```css
/* In a global style block */
::view-transition-new(.slide-in) {
  animation: slide-in 0.25s ease-out;
}
::view-transition-old(.slide-out) {
  animation: slide-out 0.2s ease-in forwards;
}
@keyframes slide-in {
  from {
    transform: translateX(-2rem);
    opacity: 0;
  }
}
@keyframes slide-out {
  to {
    transform: translateX(2rem);
    opacity: 0;
  }
}
```

## Example

```tsx check
import { Dynamic, ErrorBoundary, Portal, Suspense, ref, signal } from "lumiose";

function Info() {
  return <p>Info</p>;
}

export function Dialog() {
  const open = signal(false);
  const kind = signal<"h2" | "h3">("h2");
  const button = ref<HTMLButtonElement>();

  return (
    <ErrorBoundary fallback={(error, reset) => <button onClick={reset}>{String(error)}</button>}>
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
