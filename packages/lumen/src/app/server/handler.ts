// The web-standard request handler (spec §8, decisions 18-19): `export default { fetch }`.
// Matches the URL, builds the request context, runs the middleware chain, then serves an
// endpoint or renders a page through its layouts, the document and the `_404`/`_error` pages.

import type { RouteManifest, SpecialPage } from "../routes/manifest.ts";
import { createRouteMatcher, type RouteMatch } from "../routes/match.ts";
import type { Component } from "../../contract/client.ts";
import type {
  Endpoint,
  HttpMethod,
  Locals,
  Middleware,
  RequestContext,
  ServerEnv,
} from "./context.ts";
import { HttpError, isHttpError, isRedirect, statusText, type Redirect } from "./control.ts";
import { createCookieJar } from "./cookies.ts";
import { documentBody, renderDocument, type DocumentComponent } from "./document.ts";
import type { PageRenderer, PageTree } from "./render.ts";
import { createResponseState, processEnv, runInRequestScope, type RequestScope } from "./scope.ts";

export type ModuleExports = Record<string, unknown>;

export interface RequestHandlerOptions {
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;
  /** Loads a module by its project-relative path from the manifest (dev: Vite; prod: the build's map). */
  loadModule: (file: string) => Promise<ModuleExports>;
  /** Renders a page tree to its shell and stream (lumen/server, TASK-16). */
  render: PageRenderer;
  /** Project-relative path of `src/middleware.ts`, when the app has one. */
  middleware?: string;
  /** Project-relative path of `src/document.stsx`, when the app has one. */
  document?: string;
  /** Extra `<head>` HTML (CSS links, module preloads, island loader) for the rendered route files. */
  headAssets?: (files: readonly string[]) => string | Promise<string>;
  /** Server env for `ctx.env` and `env()`. Default: `process.env`. */
  env?: ServerEnv;
  /** Dev mode: error pages get the real error, and cookies are not `secure` on http. */
  dev?: boolean;
  /** Prerender/SSG: render every Suspense boundary into the shell (decision-19 §3). */
  prerender?: boolean;
  /** Called with unexpected errors (not redirects or `error()`/`notFound()`). Default: console.error. */
  onError?: (error: unknown, request: Request) => void;
}

export interface RequestHandler {
  fetch(request: Request): Promise<Response>;
}

const METHODS: readonly HttpMethod[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const PAGE_METHODS = "GET, HEAD, OPTIONS";

interface ErrorPages {
  notFoundPage: string | undefined;
  errorPage: string | undefined;
}

export function createRequestHandler(options: RequestHandlerOptions): RequestHandler {
  const { manifest, loadModule, render, dev = false, prerender = false } = options;
  const onError = options.onError ?? ((error: unknown) => console.error(error));
  const matcher = createRouteMatcher(manifest);
  // Reuses the _404 scope lookup to find the _error page covering an unmatched URL.
  const errorMatcher = createRouteMatcher({ routes: [], notFoundPages: manifest.errorPages });
  const specialPages = new Map<string, SpecialPage>(
    [...manifest.notFoundPages, ...manifest.errorPages].map((page) => [page.file, page]),
  );

  async function fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = matcher.match(url.pathname);
    const cookies = createCookieJar(request, { secure: !dev || url.protocol === "https:" });
    const ctx: RequestContext = {
      request,
      url,
      params: match?.params ?? {},
      // Middleware fills it in; `Locals` describes the result, not the empty start.
      locals: {} as Locals,
      cookies,
      env: options.env ?? processEnv(),
    };
    const scope: RequestScope = { ctx, cookies, response: createResponseState() };

    return runInRequestScope(scope, async () => {
      let response: Response;
      try {
        response = await runMiddleware(ctx, () => dispatch(scope, match));
      } catch (error) {
        scope.response = createResponseState();
        response =
          match?.route.kind === "endpoint"
            ? endpointError(error, request)
            : await renderError(error, scope, errorPagesFor(match, url.pathname));
      }
      return finalize(response, scope);
    });
  }

  async function runMiddleware(ctx: RequestContext, last: () => Promise<Response>) {
    const chain = options.middleware === undefined ? [] : await loadMiddleware(options.middleware);
    const call = async (index: number): Promise<Response> => {
      const middleware = chain[index];
      if (middleware === undefined) return last();
      let called = false;
      const response = await middleware(ctx, () => {
        if (called) throw new Error("Middleware called next() more than once.");
        called = true;
        return call(index + 1);
      });
      if (!(response instanceof Response)) {
        throw new TypeError(
          `Middleware #${index + 1} in ${options.middleware} must return a Response (usually \`return next()\`).`,
        );
      }
      return response;
    };
    return call(0);
  }

  async function loadMiddleware(file: string): Promise<Middleware[]> {
    const exported = (await loadModule(file)).default;
    const chain = Array.isArray(exported) ? exported : [exported];
    if (!chain.every((item) => typeof item === "function")) {
      throw new TypeError(
        `${file} must export default a middleware function (ctx, next) => Response, or an array of them.`,
      );
    }
    return chain as Middleware[];
  }

  async function dispatch(scope: RequestScope, match: RouteMatch | null): Promise<Response> {
    const { request, url } = scope.ctx;
    if (match === null) {
      return renderError(new HttpError(404, "Not Found"), scope, errorPagesFor(null, url.pathname));
    }
    const { route } = match;
    if (route.kind === "endpoint") {
      try {
        return await serveEndpoint(scope.ctx, await loadModule(route.file));
      } catch (error) {
        return endpointError(error, request);
      }
    }

    if (request.method === "OPTIONS") return allowResponse(204, PAGE_METHODS);
    // TASK-23 adds POST for pages that export form actions.
    if (request.method !== "GET" && request.method !== "HEAD") {
      return allowResponse(405, PAGE_METHODS);
    }
    const baseline = new Headers(scope.response.headers);
    try {
      const [layouts, pageModule] = await Promise.all([
        Promise.all(route.layouts.map((file) => loadComponent(file))),
        loadModule(route.file),
      ]);
      const page = componentOf(pageModule, route.file);
      if (typeof pageModule.headers === "function") {
        const headers = new Headers(await pageModule.headers(scope.ctx));
        for (const [name, value] of headers) scope.response.setHeader(name, value);
      }
      return await renderPage(
        scope,
        { layouts, page, props: { params: match.params }, params: match.params },
        [...route.layouts, route.file],
      );
    } catch (error) {
      scope.response = createResponseState(200, baseline);
      return renderError(error, scope, route);
    }
  }

  function endpointError(error: unknown, request: Request): Response {
    if (isRedirect(error)) return redirectResponse(error, request);
    if (isHttpError(error)) {
      return new Response(error.message, {
        status: error.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    onError(error, request);
    return new Response(dev ? describe(error) : statusText(500), {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  /** Renders a page tree into the document. The status and headers are sealed once the shell resolves. */
  async function renderPage(
    scope: RequestScope,
    tree: PageTree,
    files: readonly string[],
  ): Promise<Response> {
    const { request } = scope.ctx;
    const shell = await render(tree, { request, signal: request.signal, resolveAll: prerender });
    const state = scope.response;
    state.seal();
    let body: string | ReadableStream<Uint8Array>;
    try {
      const assets = options.headAssets === undefined ? "" : await options.headAssets(files);
      const document =
        options.document === undefined
          ? undefined
          : componentOf<DocumentComponent>(await loadModule(options.document), options.document);
      const parts = await renderDocument(shell.head + assets, document);
      body = documentBody(parts, shell, (error) => onError(error, request));
    } catch (error) {
      await shell.stream?.cancel(error);
      throw error;
    }
    const headers = new Headers(state.headers);
    if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
    if (request.method === "HEAD") {
      if (typeof body !== "string") await body.cancel();
      return new Response(null, { status: state.status, headers });
    }
    return new Response(body, { status: state.status, headers });
  }

  /**
   * Turns a thrown value into a response: a redirect, or the `_404` (404s) / `_error` page with its
   * layouts, then without them if a layout fails too, then a built-in fallback page.
   */
  async function renderError(error: unknown, scope: RequestScope, pages: ErrorPages) {
    const { request } = scope.ctx;
    if (isRedirect(error)) return redirectResponse(error, request);
    const status = isHttpError(error) ? error.status : 500;
    if (!isHttpError(error)) onError(error, request);
    const exposed = isHttpError(error)
      ? error
      : dev
        ? toError(error)
        : new HttpError(500, statusText(500));
    const baseline = new Headers(scope.response.headers);
    const candidates = status === 404 ? [pages.notFoundPage, pages.errorPage] : [pages.errorPage];

    for (const file of new Set(candidates)) {
      const page = file === undefined ? undefined : specialPages.get(file);
      if (page === undefined) continue;
      const layoutFiles = layoutsFor(page.dir);
      for (const layouts of layoutFiles.length > 0 ? [layoutFiles, []] : [[]]) {
        scope.response = createResponseState(status, baseline);
        try {
          const [layoutComponents, component] = await Promise.all([
            Promise.all(layouts.map((layout) => loadComponent(layout))),
            loadComponent(page.file),
          ]);
          const params = scope.ctx.params;
          return await renderPage(
            scope,
            {
              layouts: layoutComponents,
              page: component,
              props: { status, error: exposed, params },
              params,
            },
            [...layouts, page.file],
          );
        } catch (failure) {
          if (isRedirect(failure)) return redirectResponse(failure, request);
          onError(failure, request);
        }
      }
    }
    scope.response = createResponseState(status, baseline);
    return fallbackPage(status, exposed);
  }

  function fallbackPage(status: number, error: Error): Response {
    const title = `${status} ${statusText(status)}`;
    let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>`;
    if (error.message !== statusText(status)) html += `<p>${escapeHtml(error.message)}</p>`;
    if (dev && !isHttpError(error) && error.stack) html += `<pre>${escapeHtml(error.stack)}</pre>`;
    return new Response(`${html}</body></html>`, {
      status,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  function errorPagesFor(match: RouteMatch | null, pathname: string): ErrorPages {
    if (match?.route.kind === "page") return match.route;
    return {
      notFoundPage: matcher.notFound(pathname)?.file,
      errorPage: errorMatcher.notFound(pathname)?.file,
    };
  }

  /** Layout files that wrap a page in `dir`, outermost first. */
  function layoutsFor(dir: string): string[] {
    return manifest.layouts
      .filter(
        (layout) => layout.dir === "" || dir === layout.dir || dir.startsWith(`${layout.dir}/`),
      )
      .toSorted((a, b) => a.dir.length - b.dir.length)
      .map((layout) => layout.file);
  }

  async function loadComponent(file: string): Promise<Component<any>> {
    return componentOf(await loadModule(file), file);
  }

  return { fetch };
}

async function serveEndpoint(ctx: RequestContext, module: ModuleExports): Promise<Response> {
  const method = ctx.request.method as HttpMethod;
  const exported = METHODS.filter((name) => typeof module[name] === "function");
  let handler = exported.includes(method) ? (module[method] as Endpoint) : undefined;
  if (handler === undefined && method === "HEAD" && exported.includes("GET")) {
    handler = module.GET as Endpoint;
  }
  if (handler === undefined) {
    const allow = METHODS.filter(
      (name) =>
        exported.includes(name) ||
        (name === "HEAD" && exported.includes("GET")) ||
        name === "OPTIONS",
    ).join(", ");
    return allowResponse(method === "OPTIONS" ? 204 : 405, allow);
  }
  const response = await handler(ctx);
  if (!(response instanceof Response)) {
    throw new TypeError(`Endpoint ${method} ${ctx.url.pathname} must return a Response.`);
  }
  return method === "HEAD" ? withoutBody(response) : response;
}

function componentOf<C = Component<any>>(module: ModuleExports, file: string): C {
  if (typeof module.default !== "function") {
    throw new TypeError(`${file} must export default a component.`);
  }
  return module.default as C;
}

/** Cookies and response-context headers apply to every response, then both are sealed. */
function finalize(response: Response, scope: RequestScope): Response {
  const cookies = scope.cookies.headers();
  scope.cookies.seal();
  scope.response.seal();
  const extra = [...scope.response.headers].filter(([name]) => !response.headers.has(name));
  if (cookies.length === 0 && extra.length === 0) return response;
  // Copy: responses from Response.redirect() or fetch() have immutable headers.
  const headers = new Headers(response.headers);
  for (const [name, value] of extra) headers.set(name, value);
  for (const cookie of cookies) headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function redirectResponse(redirect: Redirect, request: Request): Response {
  const status =
    redirect.status ?? (request.method === "GET" || request.method === "HEAD" ? 302 : 303);
  // Header values must be ASCII; encode raw non-ASCII paths such as "/café".
  const location = /[^!-~]/.test(redirect.location)
    ? encodeURI(redirect.location)
    : redirect.location;
  return new Response(null, { status, headers: { location } });
}

function allowResponse(status: 204 | 405, allow: string): Response {
  return new Response(status === 405 ? statusText(405) : null, {
    status,
    headers: { allow },
  });
}

function withoutBody(response: Response): Response {
  void response.body?.cancel();
  return new Response(null, response);
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

function describe(error: unknown): string {
  return error instanceof Error ? (error.stack ?? error.message) : String(error);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
