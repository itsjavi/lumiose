// Server variants of the public boundary and head components (decision-19, spec §7.3, §8 Document).

import { getOwner } from "../core/internal.ts";
import { LUM_AFTER_SHELL, LumioseError } from "../app/diagnostics.ts";
import { isHttpError, isRedirect } from "../app/server/control.ts";
import { spreadAttrs } from "./attrs.ts";
import {
  content,
  renderFrame,
  resolvesAll,
  withFrame,
  withTimeout,
  currentFrame,
  scope,
  type Frame,
  type RenderState,
} from "./frame.ts";
import { html, SSRHtml, wrap, type Html } from "./node.ts";
import { boundaryError, createUnit, foldUnit, streamBoundary } from "./render.ts";

// Hydration block markers (contract doc-2 §3), emitted inside islands only.
const OPEN = "<!--[-->";
const OPEN_FAILED = "<!--[!-->";
const CLOSE = "<!--]-->";

export interface SuspenseProps {
  fallback?: unknown;
  children?: unknown;
}

/**
 * Streaming render: content that resolves synchronously renders inline. Otherwise the fallback is
 * sent with the shell inside `<?start name="lbN">…<?end>`, and the content streams later. Head,
 * status and redirect changes inside the boundary are LUM5004; its errors go to an
 * `<ErrorBoundary>` inside it, or to `onError` (the fallback then stays).
 * `resolveAll` (SSG) or `setStreaming(false)`: transparent, everything renders into the shell.
 * With `streamTimeout`, content still pending a task after it expired fails with LUM5009.
 */
export function Suspense(props: SuspenseProps): unknown {
  const frame = renderFrame("<Suspense>");
  const render = frame.render;
  // Inside islands the boundary is a block (the client's Suspense range), around the content or
  // around the streamed placeholder, which the content replaces in place.
  const range = (out: Html): Html => (frame.island === undefined ? out : wrap(OPEN, out, CLOSE));
  if (resolvesAll(render)) {
    const out = content(props.children);
    return html(range(typeof out === "string" ? out : withTimeout(render, out, true)));
  }
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
    return new SSRHtml(range(out) as string);
  }
  const name = streamBoundary(render, unit, withTimeout(render, out, true));
  return html(range(wrap(`<?start name="${name}">`, content(props.fallback), "<?end>")));
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
/**
 * Reports an error an `<ErrorBoundary>` caught (`onCaughtError`) and returns what its fallback
 * receives. Production (decision-29): a generic error with a short `digest` instead of `error`,
 * which may hold secrets (a database message, a file path); the original is reported with the same
 * `digest`, so a reported page can be matched to its log entry.
 */
function caught(error: unknown, frame: Frame): unknown {
  const { render, streamed } = frame;
  if (!render.sanitizeErrors) {
    render.onCaughtError(error, { digest: undefined, streamed });
    return error;
  }
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const digest = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const logged =
    typeof error === "object" && error !== null
      ? error
      : new Error(String(error), { cause: error });
  Object.defineProperty(logged, "digest", { configurable: true, enumerable: true, value: digest });
  render.onCaughtError(logged, { digest, streamed });
  return Object.assign(
    new Error(`An error occurred while rendering this part of the page (digest ${digest}).`),
    { digest },
  );
}

export function ErrorBoundary(props: ErrorBoundaryProps): unknown {
  // The fallback may render once the children reject: in a scope of its own (`useId()`).
  const frame = scope(currentFrame());
  const owner = getOwner();
  // Inside islands the boundary is a block (the client's ErrorBoundary range): `<!--[-->` around
  // the children, `<!--[!-->` around a fallback, so the client renders that boundary afresh.
  const island = frame?.island !== undefined;
  const fallback = (error: unknown): Html => {
    if (isRedirect(error) || isHttpError(error)) {
      if (frame === undefined || !frame.streamed) throw error;
      error = boundaryError(error);
    }
    if (frame !== undefined) error = caught(error, frame);
    const out = withFrame(frame, owner, () => {
      const value = props.fallback;
      return content(typeof value === "function" ? value(error, noop) : value);
    });
    return island ? wrap(OPEN_FAILED, out, CLOSE) : out;
  };
  const children = (out: string): string => (island ? OPEN + out + CLOSE : out);
  let out: Html;
  try {
    out = content(props.children);
  } catch (error) {
    return html(fallback(error));
  }
  return typeof out === "string" ? new SSRHtml(children(out)) : html(out.then(children, fallback));
}

// --- Head --------------------------------------------------------------------------------------

const EMPTY = new SSRHtml("");

function headRender(api: string): RenderState {
  const frame = renderFrame(api);
  if (frame.streamed || frame.render.shellDone) {
    throw new LumioseError(
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
