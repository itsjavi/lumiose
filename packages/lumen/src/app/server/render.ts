// The seam between the request handler and the server runtime (TASK-16, decision-19). The
// handler decides *what* to render (layouts + page, or an error page) and owns the document and
// the Response; the renderer resolves the shell, collects the head and streams Suspense
// boundaries. Until TASK-16 lands, tests use a string renderer fixture; the integration adapts
// lumen/server's renderToStream to `PageRenderer` with `composePageTree`.

import type { Component } from "../../contract/client.ts";
import type { RouteParamValues } from "./context.ts";

/** What to render: layouts wrap the page, outermost first. */
export interface PageTree {
  /** Layout components, outermost first. Each receives `{ params, children }`. */
  layouts: readonly Component<any>[];
  /** The page, `_404` or `_error` component. */
  page: Component<any>;
  /** Props for `page`: `{ params }` for pages, `{ status, error }` (+ params) for error pages. */
  props: Record<string, unknown>;
  params: RouteParamValues;
}

export interface PageRenderOptions {
  request: Request;
  /** Aborted when the client disconnects. */
  signal: AbortSignal;
  /** Prerender/SSG: resolve every Suspense boundary into the body; no fallbacks or swap scripts. */
  resolveAll: boolean;
}

/** The resolved shell (decision-19): everything outside `<Suspense>` plus the collected head. */
export interface RenderedShell {
  /** HTML collected from `<Head>`, `<Title>` and `<Meta>` while rendering the shell. */
  head: string;
  /** Body HTML of the shell, with Suspense fallbacks in place. */
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
 */
export function composePageTree(tree: PageTree, createComponent: CreateComponent): () => unknown {
  const { layouts, page, props, params } = tree;
  const level = (index: number): unknown => {
    if (index === layouts.length) return createComponent(page, props);
    return createComponent(layouts[index]!, {
      params,
      get children() {
        return level(index + 1);
      },
    });
  };
  return () => level(0);
}
