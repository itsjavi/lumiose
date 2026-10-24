// The seam between the request handler and the server runtime (TASK-16, decision-19). The
// handler decides *what* to render (layouts + page, or an error page, inside the custom document)
// and owns the Response; the renderer resolves the shell, collects the head and streams Suspense
// boundaries. `createServerRenderer` adapts lumiose/server's renderToStream; handler tests can also
// use the string renderer fixture.

import type { Component } from "../../contract/client.ts";
import { createComponent } from "../../server/index.ts";
import { SSRHtml } from "../../server/node.ts";
import { renderShell } from "../../server/render.ts";
import type { DocumentProps, RouteParamValues } from "./context.ts";
import { BODY_SLOT, HEAD_SLOT } from "./document.ts";

/** What to render: layouts wrap the page, outermost first. */
export interface PageTree {
  /** Layout components, outermost first. Each receives `{ params, children }`. */
  layouts: readonly Component<any>[];
  /** The page, `not-found` or `error` component. */
  page: Component<any>;
  /** Props for `page`: `{ params }` for pages, `{ status, error }` (+ params) for error pages. */
  props: Record<string, unknown>;
  params: RouteParamValues;
  /**
   * `src/document.stsx`, rendered as the root component around the tree (so it can provide
   * context and set head defaults), with `head` and `body` placeholders the handler fills in.
   */
  document?: Component<DocumentProps>;
}

export interface PageRenderOptions {
  request: Request;
  /** Aborted when the client disconnects. */
  signal: AbortSignal;
  /** Prerender/SSG: resolve every Suspense boundary into the body; no fallbacks or swap scripts. */
  resolveAll: boolean;
  /**
   * Whether the response still streams: `response().setStreaming(false)` resolves every boundary
   * from then on, and those already streaming are inlined (decision-58).
   */
  streaming?: () => boolean;
  /** `lumiose({ streamTimeout })` in milliseconds; undefined when off (decision-58). */
  streamTimeout?: number;
  /**
   * Errors no `<ErrorBoundary>` handled: of streamed boundaries (headers are already sent,
   * `streamed`), or while the render ends.
   */
  onError?: (error: unknown, streamed?: boolean) => void;
  /**
   * Each error an `<ErrorBoundary>` caught, with its `digest` when `sanitizeErrors` replaced it in
   * the fallback. Default: those with a digest go to `onError`.
   */
  onCaughtError?: (error: unknown, info: { digest: string | undefined; streamed: boolean }) => void;
  /** Each streamed boundary, with a promise that settles once its content is ready or failed. */
  onBoundary?: (settled: Promise<unknown>) => void;
  /** Overrides the renderer's `loaderUrl` for this page (pages with an SPA load the SPA entry). */
  loaderUrl?: string;
  /**
   * `lumiose({ csp: "strict" })`: `style` props render as rules of a `<style>` (spec §7.4), and the
   * nonce, when the response has one, goes on every script, style and module preload.
   */
  csp?: { nonce: string | undefined };
  /** Production: `<ErrorBoundary>` fallbacks get a generic error with a digest (decision-29). */
  sanitizeErrors?: boolean;
}

/** The resolved shell (decision-19): everything outside `<Suspense>` plus the collected head. */
export interface RenderedShell {
  /** HTML collected from `<Head>`, `<Title>` and `<Meta>` while rendering the shell. */
  head: string;
  /**
   * The shell's island loader, client scripts and module preloads, which the handler places after
   * the page's stylesheets: those block the first paint, so they are requested first (over HTTP/1.1
   * a browser opens six connections per host, TASK-566). Absent when none.
   */
  assets?: string;
  /**
   * Body HTML of the shell, with Suspense fallbacks in place (the whole custom document, if any).
   * Anything that must precede the stream, such as island records, ends the page body: before
   * `BODY_SLOT` in a custom document.
   */
  body: string;
  /**
   * Suspense boundary chunks (`<template for>` / `$swap`), streamed right after `body` inside
   * `<body>`. `null` when everything resolved in the shell.
   */
  stream: ReadableStream<string | Uint8Array> | null;
}

/**
 * Renders a page tree inside the current request scope. Resolves once the shell is ready; rejects
 * with the shell's first error (including thrown `redirect()`/`notFound()`/`error()`), which the
 * handler turns into a redirect or an error page.
 */
export type PageRenderer = (tree: PageTree, options: PageRenderOptions) => Promise<RenderedShell>;

/** `createComponent` from the server runtime (contract doc-2 §3). */
export type CreateComponent = <P>(component: Component<P>, props: P) => unknown;

/**
 * Composes a page tree into a root thunk with the runtime's `createComponent`. `children` is a
 * getter, as in compiled props (contract doc-2 §1), so each level renders inside its parent's frame.
 * A custom document wraps the tree: `head` is a placeholder and `body` renders the tree followed by
 * a marker, both created with `rawHtml` (the runtime's raw HTML node).
 */
export function composePageTree(
  tree: PageTree,
  create: CreateComponent,
  rawHtml: (html: string) => unknown = (html) => ({ t: html }),
): () => unknown {
  const { layouts, page, props, params, document } = tree;
  const level = (index: number): unknown => {
    if (index === layouts.length) return create(page, props);
    return create(layouts[index]!, {
      params,
      get children() {
        return level(index + 1);
      },
    });
  };
  if (document === undefined) return () => level(0);
  return () =>
    create(document, {
      head: rawHtml(HEAD_SLOT),
      get body() {
        return [level(0), rawHtml(BODY_SLOT)];
      },
    } as unknown as DocumentProps);
}

/** Options for the default renderer; per-request options come from the handler. */
export interface ServerRendererOptions {
  /** CSP nonce for streaming scripts and strict-mode styles. */
  nonce?: string;
  /** CSP strict mode: `style` props become nonce'd rules (spec §7.4). */
  strictStyles?: boolean;
  /** Maps island module specifiers to URLs for `modulepreload` hints (the build's manifest). */
  islandUrl?: (specifier: string) => string;
  /** A build's client chunk URL → the chunks it imports statically, preloaded with it. */
  chunkImports?: (url: string) => readonly string[];
  /** URL of the island loader script, added to pages with islands (`lumiose/dom/loader`). */
  loaderUrl?: string;
  /**
   * Dev: whether client code reaches the scoped state `ref`, so the page sends it (decision-33).
   * Builds give ids only to such states and leave this unset.
   */
  isClientState?: (ref: string) => boolean;
}

const rawHtml = (html: string) => new SSRHtml(html);

/** The default `PageRenderer`: lumiose/server's shell-first `renderToStream`. */
export function createServerRenderer(options: ServerRendererOptions = {}): PageRenderer {
  return async (
    tree,
    {
      signal,
      resolveAll,
      streaming,
      streamTimeout,
      onError,
      onCaughtError,
      onBoundary,
      loaderUrl,
      csp,
      sanitizeErrors,
    },
  ) => {
    const { head, assets, html, records, stream } = await renderShell(
      composePageTree(tree, createComponent, rawHtml),
      {
        ...options,
        signal,
        resolveAll,
        onError,
        ...(streaming === undefined ? {} : { streaming }),
        ...(streamTimeout === undefined ? {} : { streamTimeout }),
        ...(onCaughtError === undefined ? {} : { onCaughtError }),
        ...(onBoundary === undefined ? {} : { onBoundary }),
        ...(sanitizeErrors === true ? { sanitizeErrors } : {}),
        ...(loaderUrl === undefined ? {} : { loaderUrl }),
        ...(csp === undefined ? {} : { strictStyles: true }),
        ...(csp?.nonce === undefined ? {} : { nonce: csp.nonce }),
      },
    );
    return {
      head,
      ...(assets === "" ? {} : { assets }),
      body: placeRecords(html, records, tree.document !== undefined),
      stream,
    };
  };
}

/**
 * The shell's island records end the page body, before the stream. A custom document's shell is
 * the whole document, so they go before its body marker (where the stream is spliced in) rather
 * than after `</html>`.
 */
function placeRecords(html: string, records: string, custom: boolean): string {
  const at = custom ? html.indexOf(BODY_SLOT) : -1;
  // Without the marker `documentParts` reports the document error.
  if (at === -1) return html + records;
  return html.slice(0, at) + records + html.slice(at);
}
