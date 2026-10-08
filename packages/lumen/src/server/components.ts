// Server variants of the public boundary and head components (decision-19, spec §7.3, §8 Document).

import { getOwner } from "../core/internal.ts";
import { LUM_AFTER_SHELL, LumenError } from "../app/diagnostics.ts";
import { isHttpError, isRedirect } from "../app/server/control.ts";
import { spreadAttrs } from "./attrs.ts";
import {
  content,
  renderFrame,
  withFrame,
  currentFrame,
  type Frame,
  type RenderState,
} from "./frame.ts";
import { html, SSRHtml, wrap, type Html } from "./node.ts";
import { boundaryError, createUnit, foldUnit, streamBoundary } from "./render.ts";

export interface SuspenseProps {
  fallback?: unknown;
  children?: unknown;
}

/**
 * Streaming render: content that resolves synchronously renders inline. Otherwise the fallback is
 * sent with the shell inside `<?start name="lbN">…<?end>`, and the content streams later. Head,
 * status and redirect changes inside the boundary are LUM5004; its errors go to an
 * `<ErrorBoundary>` inside it, or to `onError` (the fallback then stays).
 * `resolveAll` (SSG): transparent, everything renders into the shell.
 */
export function Suspense(props: SuspenseProps): unknown {
  const frame = renderFrame("<Suspense>");
  const render = frame.render;
  if (render.resolveAll) return html(content(props.children));
  const unit = createUnit(frame.unit);
  const inner: Frame = { ...frame, unit, streamed: true };
  let out: Html;
  try {
    out = withFrame(inner, getOwner(), () => content(props.children));
  } catch (error) {
    out = Promise.reject(error);
  }
  // Keep island instance numbering continuous for the fallback.
  frame.children = inner.children;
  if (typeof out === "string") {
    foldUnit(render, unit);
    return new SSRHtml(out);
  }
  const name = streamBoundary(render, unit, out);
  return html(wrap(`<?start name="${name}">`, content(props.fallback), "<?end>"));
}

export interface ErrorBoundaryProps {
  /** Content, or `(error, reset) => content`. `reset` does nothing on the server. */
  fallback?: unknown;
  children?: unknown;
}

const noop = (): void => {};

/**
 * Renders `fallback` in place when the children throw or reject. In the shell, `redirect()`,
 * `notFound()` and `error()` pass through to the request handler; inside a streamed boundary they
 * become LUM5004 errors and render the fallback.
 */
export function ErrorBoundary(props: ErrorBoundaryProps): unknown {
  const frame = currentFrame();
  const owner = getOwner();
  const fallback = (error: unknown): Html => {
    if (isRedirect(error) || isHttpError(error)) {
      if (frame === undefined || !frame.streamed) throw error;
      error = boundaryError(error);
    }
    return withFrame(frame, owner, () => {
      const value = props.fallback;
      return content(typeof value === "function" ? value(error, noop) : value);
    });
  };
  let out: Html;
  try {
    out = content(props.children);
  } catch (error) {
    return html(fallback(error));
  }
  return typeof out === "string" ? new SSRHtml(out) : html(out.then(undefined, fallback));
}

// --- Head --------------------------------------------------------------------------------------

const EMPTY = new SSRHtml("");

function headRender(api: string): RenderState {
  const frame = renderFrame(api);
  if (frame.streamed || frame.render.shellDone) {
    throw new LumenError(
      LUM_AFTER_SHELL,
      `${api} inside a streamed <Suspense> boundary cannot change <head>: it was sent with the shell. Render it outside <Suspense>`,
    );
  }
  return frame.render;
}

function then(value: Html, fn: (html: string) => void): SSRHtml | Promise<SSRHtml> {
  if (typeof value === "string") {
    fn(value);
    return EMPTY;
  }
  return value.then((resolved) => {
    fn(resolved);
    return EMPTY;
  });
}

/** Sets the document title. The deepest `<Title>` wins (a page overrides its layouts). */
export function Title(props: { children?: unknown }): unknown {
  const render = headRender("<Title>");
  const depth = getOwner()?.depth ?? 0;
  return then(content(props.children), (text) => {
    if (render.title === undefined || depth >= render.title.depth) {
      render.title = { depth, html: `<title>${text}</title>` };
    }
  });
}

const META_KEYS = ["charset", "name", "property", "http-equiv", "itemprop"] as const;

/** Adds a `<meta>`. Metas with the same charset/name/property/http-equiv/itemprop dedupe; the deepest wins. */
export function Meta(props: Record<string, unknown>): unknown {
  const render = headRender("<Meta>");
  const depth = getOwner()?.depth ?? 0;
  const entry = { depth, html: `<meta${spreadAttrs(props)}>` };
  const name = META_KEYS.find((key) => props[key] != null);
  const key =
    name === undefined
      ? `#${render.metas.size}`
      : name === "charset"
        ? "charset"
        : `${name}:${String(props[name])}`;
  const existing = render.metas.get(key);
  if (existing === undefined || depth >= existing.depth) render.metas.set(key, entry);
  return EMPTY;
}

/** Appends its children to `<head>`, in render order. */
export function Head(props: { children?: unknown }): unknown {
  const render = headRender("<Head>");
  return then(content(props.children), (head) => {
    render.head.push(head);
  });
}
