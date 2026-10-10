# `lumiose`: server rendering

> `renderToStream` and `renderToString` render components to HTML under the `node` entry of `lumiose`; `lumiose/server` is the server half of the compiler-runtime contract.

Most apps never call these directly: the request handler (and `lumiose dev` / `lumiose build`) does.
Use them for custom servers, tests and tools. Concepts:
[Rendering modes](../concepts/rendering-modes.md).

## renderToStream

```ts
function renderToStream(
  root: () => unknown,
  options?: RenderToStreamOptions,
): Promise<RenderedShell>;

interface RenderToStreamOptions {
  /** Aborts the render: rejects a pending shell, ends the stream and aborts getAbortSignal(). */
  signal?: AbortSignal;
  /** SSG/prerender: render every Suspense boundary into the shell; no fallbacks, no stream. */
  resolveAll?: boolean;
  /** CSP nonce for the $swap scripts and strict-mode <style> rules. */
  nonce?: string;
  /** CSP strict mode: style props become nonce'd <style> rules. */
  strictStyles?: boolean;
  /** Maps an island module specifier to its URL for modulepreload hints. */
  islandUrl?: (specifier: string) => string;
  /**
   * URL of the island loader (lumiose/dom/loader). A page with islands gets it once, as
   * <script type="module" async>: in `head` when the shell has islands, else in the first
   * streamed chunk with island records. Default: none (islands render but do not hydrate).
   */
  loaderUrl?: string;
  /** Errors of streamed boundaries that no ErrorBoundary handled. Default: console.error. */
  onError?: (error: unknown) => void;
}

interface RenderedShell {
  /** Collected <Title>/<Meta>/<Head> HTML, modulepreload hints and strict-mode styles. */
  head: string;
  /** The shell HTML, followed by the shell's island records. */
  body: string;
  /** Streamed boundary chunks to append inside <body>; null when nothing is pending. */
  stream: ReadableStream<string> | null;
}
```

Renders `root` shell-first (decision-19): resolves once everything outside `<Suspense>` is ready,
and rejects with the first error thrown while rendering the shell (so the caller can render an
error page with the right status). The stream then delivers each boundary as it resolves, out of
order.

## renderToString

```ts
function renderToString(
  root: () => unknown,
  options?: Omit<RenderToStreamOptions, "resolveAll">,
): Promise<string>;
```

Renders everything resolved (no fallbacks, no stream) and returns the body HTML. Used for
prerendering and tests.

Both are server-only: in the browser build of `lumiose` they throw `LUM4003`.

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
