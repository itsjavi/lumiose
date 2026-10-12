// Public option and result types of `renderToStream()` (./render.ts), in a module of their own so
// the browser entry's stubs (../dom/public.ts) can name them without loading the server renderer,
// which imports Node built-ins.

export interface RenderToStreamOptions {
  /** Aborts the render: rejects a pending shell, ends the stream and aborts `getAbortSignal()`. */
  signal?: AbortSignal;
  /** SSG/prerender: render every Suspense boundary into the shell; no fallbacks, no stream. */
  resolveAll?: boolean;
  /** CSP nonce for the `$swap` scripts and strict-mode `<style>` rules. */
  nonce?: string;
  /** CSP strict mode (spec §7.4): `style` props become nonce'd `<style>` rules. */
  strictStyles?: boolean;
  /** Maps an island module specifier to its URL for `modulepreload` hints. Default: unchanged. */
  islandUrl?: (specifier: string) => string;
  /**
   * URL of the island loader (`lumiose/dom/loader`). A page with islands gets it once, as an async
   * module script: in the head when the shell has islands, else before the first streamed chunk
   * with island records. Default: no loader (islands render but do not hydrate).
   */
  loaderUrl?: string;
  /** Receives errors of streamed boundaries that no `<ErrorBoundary>` handled. Default: console.error. */
  onError?: (error: unknown) => void;
  /**
   * Production (decision-29): an `<ErrorBoundary>` fallback receives a generic error with a short
   * `digest` instead of an error that is not an `HttpError`, and the original error goes to
   * `onError` with the same `digest`. Default: false (the fallback gets the error itself).
   */
  sanitizeErrors?: boolean;
  /**
   * Prepended to every `useId()` of the render, its islands included: keeps the ids of several
   * renders (or apps) on one page apart. Default: "".
   */
  idPrefix?: string;
}

export interface RenderedShell {
  /** Collected `<Title>`/`<Meta>`/`<Head>` HTML, plus modulepreload hints and strict-mode styles. */
  head: string;
  /** The shell's HTML, followed by the island records of the shell. */
  body: string;
  /** Streamed boundary chunks to append inside `<body>`; null when nothing is pending. */
  stream: ReadableStream<string> | null;
}
