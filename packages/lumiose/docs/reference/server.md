# `lumiose`: server rendering

> `renderToStream` and `renderToString` render components to HTML on the server.

Most apps never call these directly: the request handler (and `lumiose dev` / `lumiose build`) does.
Use them for custom servers, tests and tools. Concepts:
[Rendering modes](../concepts/rendering-modes.md).

## renderToStream

Renders `root` to HTML shell-first and streams the rest.

It resolves once everything outside `<Suspense>` is ready (decision-19), and rejects with the first
error thrown while rendering the shell (so the caller can render an error page with the right
status). The stream then delivers each boundary as it resolves, out of order.

```ts
function renderToStream(
  root: () => unknown,
  options?: RenderToStreamOptions,
): Promise<RenderedShell>;
```

```tsx check
import { renderToStream } from "lumiose";

function App() {
  return <h1>Hello</h1>;
}

const shell = await renderToStream(() => <App />);
console.log(shell.head, shell.body, shell.stream === null);
```

| Name             | Type                            | Default         | Description                                                                                                                                                                                                                                                      |
| ---------------- | ------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `root`           | `() => unknown`                 | —               | Returns the tree to render.                                                                                                                                                                                                                                      |
| `signal`         | `AbortSignal`                   | —               | Aborts the render: rejects a pending shell, ends the stream and aborts `getAbortSignal()`.                                                                                                                                                                       |
| `resolveAll`     | `boolean`                       | `false`         | SSG/prerender: render every Suspense boundary into the shell; no fallbacks, no stream.                                                                                                                                                                           |
| `nonce`          | `string`                        | —               | CSP nonce for the `$swap` scripts and strict-mode `<style>` rules.                                                                                                                                                                                               |
| `strictStyles`   | `boolean`                       | `false`         | CSP strict mode: `style` props become nonce'd `<style>` rules.                                                                                                                                                                                                   |
| `islandUrl`      | `(specifier: string) => string` | unchanged       | Maps an island module specifier to its URL for `modulepreload` hints.                                                                                                                                                                                            |
| `loaderUrl`      | `string`                        | —               | URL of the island loader (`lumiose/dom/loader`). A page with islands gets it once, as `<script type="module" async>`: in `head` when the shell has islands, else in the first streamed chunk with island records. Without it, islands render but do not hydrate. |
| `onError`        | `(error: unknown) => void`      | `console.error` | Receives errors of streamed boundaries that no `<ErrorBoundary>` handled.                                                                                                                                                                                        |
| `sanitizeErrors` | `boolean`                       | `false`         | Production: an `<ErrorBoundary>` fallback receives a generic error with a short `digest` instead of an error that is not an `HttpError`, and the original error goes to `onError` with the same `digest`. When false, the fallback gets the error itself.        |
| `idPrefix`       | `string`                        | `""`            | Prepended to every `useId()` of the render, its islands included (they reuse it when they hydrate). Keeps the ids of several renders or apps on one page apart.                                                                                                  |

### RenderedShell

What `renderToStream` resolves with: the parts of the page, for the caller to put in a document.

```ts
interface RenderedShell {
  head: string;
  body: string;
  stream: ReadableStream<string> | null;
}
```

| Name     | Type                             | Default | Description                                                                             |
| -------- | -------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `head`   | `string`                         | —       | Collected `<Title>`/`<Meta>`/`<Head>` HTML, modulepreload hints and strict-mode styles. |
| `body`   | `string`                         | —       | The shell HTML, followed by the shell's island records.                                 |
| `stream` | `ReadableStream<string> \| null` | —       | Streamed boundary chunks to append inside `<body>`; null when nothing is pending.       |

## renderToString

Renders everything resolved (no fallbacks, no stream) and returns the body HTML. Used for
prerendering and tests. It takes the options of [`renderToStream`](#rendertostream), except
`resolveAll`.

Both are server-only: in the browser build of `lumiose` they throw `LUM4003`. With `idPrefix`, the
island records carry the prefix, so [`useId()`](reactivity.md#useid) returns the same ids after
hydration.

```ts
function renderToString(
  root: () => unknown,
  options?: Omit<RenderToStreamOptions, "resolveAll">,
): Promise<string>;
```

```tsx check
import { renderToString } from "lumiose";

function Hello(props: { name: string }) {
  return <h1>Hello {props.name}</h1>;
}

export const html = await renderToString(() => <Hello name="Ada" />);
```

## `lumiose/server`

The server runtime that compiled server code imports (`ssr`, `escape`, `insert`, `list`, `branch`,
`branchArm`, `createComponent`, `island`, `$await`, …). It is the compiler-runtime contract, not an
application API: its members may change between versions without notice. It also re-exports
`renderToStream` and `renderToString`.

## Example

```tsx check
import { renderToStream } from "lumiose";

function App() {
  return <h1>Hello</h1>;
}

export async function handle(request: Request): Promise<Response> {
  const { head, body, stream } = await renderToStream(() => <App />, { signal: request.signal });
  const encoder = new TextEncoderStream();
  const writer = encoder.writable.getWriter();
  void (async () => {
    await writer.write(`<!doctype html><html><head>${head}</head><body>${body}`);
    if (stream) for await (const chunk of stream) await writer.write(chunk);
    await writer.write("</body></html>");
    await writer.close();
  })();
  return new Response(encoder.readable, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
```
