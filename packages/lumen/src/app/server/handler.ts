// The web-standard request handler (spec §8, decisions 18-19): `export default { fetch }`.
// Matches the URL, builds the request context, runs the middleware chain, then serves an
// endpoint or renders a page through its layouts, the document and the `_404`/`_error` pages.

import type { PageRoute, RouteManifest, SpecialPage } from "../routes/manifest.ts";
import { normalizeBase } from "../routes/href.ts";
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
import { jsonForScript } from "../../server/node.ts";
import { wantsActionResult } from "../actions/protocol.ts";
import {
  actionResultResponse,
  encodeActionData,
  hasActions,
  outcomeBody,
  resolveAction,
  runAction,
} from "./actions.ts";
import { HttpError, isHttpError, isRedirect, statusText, type Redirect } from "./control.ts";
import { createCookieJar, type CookieJar } from "./cookies.ts";
import {
  boundedRequest,
  checkContentLength,
  DEFAULT_LIMITS,
  resolveLimits,
  type LimitsOption,
} from "./body.ts";
import { isSameOriginRequest, needsOriginCheck, type CsrfOptions } from "./csrf.ts";
import {
  addNonce,
  createNonce,
  nonceMeta,
  noncePolicy,
  withHashPolicy,
  type CspOption,
} from "./csp.ts";
import { documentBody, documentParts, type DocumentComponent } from "./document.ts";
import { headersFor, type HeadersOption } from "../headers.ts";
import { documentRules, navigationHead, type Prefetch } from "./navigation.ts";
import { createServerRenderer, type PageRenderer, type PageTree } from "./render.ts";
import { spaErrorPart, spaPagePart, spaPageTree } from "../router/server.ts";
import {
  assertRequestApi,
  createResponseState,
  prerenderUrl,
  processEnv,
  runInRequestScope,
  runPrerenderGuarded,
  type PrerenderGuard,
  type RequestScope,
} from "./scope.ts";

export type ModuleExports = Record<string, unknown>;

export interface RequestHandlerOptions {
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages">;
  /**
   * Request body limits (`lumen({ limits })`, decision-29): `body` for URL-encoded, JSON and other
   * bodies (default 1 MB), `upload` for multipart (default 10 MB). A route's `export const limits`
   * overrides them for its requests.
   */
  limits?: LimitsOption;
  /** Loads a module by its project-relative path from the manifest (dev: Vite; prod: the build's map). */
  loadModule: (file: string) => Promise<ModuleExports>;
  /** Renders a page tree to its shell and stream. Default: lumen/server's `createServerRenderer()`. */
  render?: PageRenderer;
  /** Project-relative path of `src/middleware.ts`, when the app has one. */
  middleware?: string;
  /** Project-relative path of `src/document.stsx`, when the app has one. */
  document?: string;
  /**
   * URL of the SPA entry (`virtual:lumen/spa`, TASK-25): pages that render an SPA (`mode = "spa"`)
   * load it instead of the island loader.
   */
  spaEntry?: string;
  /**
   * Extra `<head>` HTML (CSS links, module preloads, island loader) for the rendered route files;
   * `spa` is true for pages that render an SPA.
   */
  headAssets?: (files: readonly string[], spa: boolean) => string | Promise<string>;
  /** Server env for `ctx.env` and `env()`. Default: `process.env`. */
  env?: ServerEnv;
  /** Dev mode: error pages get the real error, and cookies are not `secure` on http. */
  dev?: boolean;
  /**
   * Prerender/SSG: render every Suspense boundary into the shell (decision-19 §3). A function
   * decides per page route: the dev server renders `static` routes resolved, as the build does.
   */
  prerender?: boolean | ((route: PageRoute) => boolean);
  /** Called with unexpected errors (not redirects or `error()`/`notFound()`). Default: console.error. */
  onError?: (error: unknown, request: Request) => void;
  /**
   * The Origin check against cross-site form posts (decision-18), on by default: cross-site form
   * actions and form-encoded endpoint requests get a 403. `false` turns it off.
   */
  csrf?: false | CsrfOptions;
  /** Vite's `base` (`/docs/`): routes match the path below it; other paths are 404. Default `/`. */
  base?: string;
  /**
   * Trailing slashes of page URLs (endpoints are left alone): `always` and `never` redirect GET
   * and HEAD requests to that form (308). Default `ignore`: both forms render the page.
   */
  trailingSlash?: TrailingSlash;
  /**
   * Build-time prerendering (`lumen build`): pages and endpoints render with request APIs guarded
   * (LUM5001, reported through `onError`) and fully resolved. Middleware is not guarded.
   */
  prerendering?: boolean;
  /**
   * Cross-document View Transitions between pages (`lumen({ viewTransitions })`, decision-24):
   * every page document opts in, unless the reader prefers reduced motion. Default `false`.
   */
  viewTransitions?: boolean;
  /**
   * Speculation rules that prefetch the same-origin links of MPA pages, endpoints excepted
   * (`lumen({ prefetch })`, decision-24): on hover, early (`viewport`) or not. Default `"none"`
   * here; `lumen dev` and `lumen build` default to `"hover"`.
   */
  prefetch?: Prefetch;
  /**
   * `lumen({ csp: "strict" })` (spec §7.4, ./csp.ts): pages get a per-response nonce on every
   * inline script and style Lumen writes and a `Content-Security-Policy` header (outside dev,
   * unless the page or middleware sets one); prerendered pages get a hash policy `<meta>`.
   */
  csp?: CspOption;
  /**
   * `lumen({ headers })`, which adapters and `lumen dev` send: a `Content-Security-Policy` it
   * configures for a path replaces Lumen's strict policy there (header and prerendered `<meta>`).
   */
  headers?: HeadersOption;
}

export type TrailingSlash = "ignore" | "always" | "never";

export interface RequestHandler {
  fetch(request: Request): Promise<Response>;
}

const METHODS: readonly HttpMethod[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const PAGE_METHODS = "GET, HEAD, OPTIONS";
const ACTION_PAGE_METHODS = "GET, HEAD, POST, OPTIONS";
/** Nesting limit for in-process requests (`fetchJSON()` during SSR), against fetch loops. */
const MAX_IN_PROCESS_DEPTH = 8;
const CROSS_SITE_MESSAGE = "Cross-site form submissions are forbidden.";

interface ErrorPages {
  notFoundPage: string | undefined;
  errorPage: string | undefined;
}

/** What an in-process request shares with the request that made it. */
interface ParentRequest {
  cookies: CookieJar;
  locals: Locals;
  depth: number;
}

export function createRequestHandler(options: RequestHandlerOptions): RequestHandler {
  const { manifest, loadModule, dev = false, prerendering = false } = options;
  const prerender = prerendering || (options.prerender ?? false);
  const base = normalizeBase(options.base ?? "/");
  const trailingSlash = options.trailingSlash ?? "ignore";
  const navigation = navigationHead(options, manifest.routes, base);
  const render = options.render ?? createServerRenderer();
  const onError = options.onError ?? ((error: unknown) => console.error(error));
  const matcher = createRouteMatcher(manifest);
  // Reuses the _404 scope lookup to find the _error page covering an unmatched URL.
  const errorMatcher = createRouteMatcher({ routes: [], notFoundPages: manifest.errorPages });
  const specialPages = new Map<string, SpecialPage>(
    [...manifest.notFoundPages, ...manifest.errorPages].map((page) => [page.file, page]),
  );

  const allowedOrigins = new Set(options.csrf === false ? [] : options.csrf?.allowedOrigins);
  const appLimits = resolveLimits(options.limits, DEFAULT_LIMITS, "lumen({ limits })");

  function fetch(request: Request): Promise<Response> {
    return handle(request, undefined);
  }

  async function handle(incoming: Request, parent: ParentRequest | undefined): Promise<Response> {
    // Every body is bounded (413 beyond the limits); a route's own limits replace the app's once
    // its module is loaded (`applyRouteLimits`).
    const limits = { current: appLimits };
    const request = boundedRequest(incoming, () => limits.current);
    const url = new URL(request.url);
    // The path below `base`; outside it nothing matches and the root error pages apply.
    const pathname = routePath(url.pathname, base);
    const match = pathname === undefined ? null : matcher.match(pathname);
    const actionResult = wantsActionResult(request);
    if (match?.route.kind === "page" && pathname !== undefined) {
      const location = trailingSlashRedirect(request, url, pathname, trailingSlash);
      if (location !== undefined) {
        return new Response(null, { status: 308, headers: { location } });
      }
    }
    if (
      options.csrf !== false &&
      needsOriginCheck(request, match?.route.kind !== "endpoint") &&
      !isSameOriginRequest(request, url, allowedOrigins)
    ) {
      return actionResult
        ? actionResultResponse({
            type: "error",
            status: 403,
            error: { message: CROSS_SITE_MESSAGE },
          })
        : new Response(CROSS_SITE_MESSAGE, {
            status: 403,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
    }
    // An in-process request is part of its parent: it reads and writes the parent's cookies.
    const cookies =
      parent?.cookies ?? createCookieJar(request, { secure: !dev || url.protocol === "https:" });
    const ctx: RequestContext = {
      request,
      url,
      params: match?.params ?? {},
      // Middleware fills it in; `Locals` describes the result, not the empty start. In-process
      // requests start from a copy of the parent's.
      locals: (parent === undefined ? {} : { ...parent.locals }) as Locals,
      cookies,
      env: options.env ?? processEnv(),
    };
    const depth = parent === undefined ? 0 : parent.depth + 1;
    const scope: RequestScope = {
      ctx,
      cookies,
      ...(match === null ? {} : { route: match.route.pattern }),
      response: createResponseState(),
      fetch: (inner) => fetchInProcess(inner, { cookies, locals: ctx.locals, depth }, request),
      ...(options.csp === "strict" && !prerendering ? { nonce: createNonce() } : {}),
      bodyLimits: limits,
    };

    // Prerendering guards request APIs in routes, not in middleware (nested in-process requests
    // run their middleware unguarded too).
    const guard: PrerenderGuard | undefined = prerendering
      ? { report: (error) => onError(error, request) }
      : undefined;
    const notFoundPath = pathname ?? "/";
    return runInRequestScope(scope, async () => {
      let response: Response;
      try {
        response = await runPrerenderGuarded(undefined, () =>
          runMiddleware(ctx, () =>
            runPrerenderGuarded(guard, () => dispatch(scope, match, actionResult, notFoundPath)),
          ),
        );
      } catch (error) {
        scope.response = createResponseState();
        response =
          match?.route.kind === "endpoint"
            ? endpointError(error, request)
            : await runPrerenderGuarded(guard, () =>
                renderError(error, scope, errorPagesFor(match, notFoundPath)),
              );
      }
      if (actionResult) response = redirectAsActionResult(response);
      return finalize(response, scope, parent === undefined);
    });
  }

  /**
   * Serves a same-origin request made while handling `outer` (`fetchJSON()` during SSR) without
   * the network. It runs middleware like any request, sees the outer `cookie` and `authorization`
   * headers, shares the cookie jar (cookies it sets go out with the page) and starts from a copy
   * of the outer `locals`. It is aborted with the outer request.
   */
  function fetchInProcess(
    request: Request,
    parent: ParentRequest,
    outer: Request,
  ): Promise<Response> {
    if (parent.depth + 1 > MAX_IN_PROCESS_DEPTH) {
      throw new Error(
        `In-process fetch of ${request.url} nested more than ${MAX_IN_PROCESS_DEPTH} levels deep. Does a page or endpoint fetch itself?`,
      );
    }
    const headers = new Headers(request.headers);
    for (const name of ["cookie", "authorization"]) {
      const value = outer.headers.get(name);
      if (value !== null && !headers.has(name)) headers.set(name, value);
    }
    const inner = new Request(request, {
      headers,
      signal: AbortSignal.any([request.signal, outer.signal]),
    });
    return handle(inner, parent);
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

  async function dispatch(
    scope: RequestScope,
    match: RouteMatch | null,
    actionResult: boolean,
    pathname: string,
  ): Promise<Response> {
    const { request } = scope.ctx;
    if (match === null) {
      return renderError(new HttpError(404, "Not Found"), scope, errorPagesFor(null, pathname));
    }
    const { route } = match;
    // What route code sees: while prerendering, its request APIs throw LUM5001.
    const routeCtx = prerendering ? prerenderContext(scope.ctx) : scope.ctx;
    if (route.kind === "endpoint") {
      try {
        const module = await loadModule(route.file);
        applyRouteLimits(scope, module, route.file);
        return await serveEndpoint(routeCtx, request, module);
      } catch (error) {
        return endpointError(error, request);
      }
    }

    const baseline = new Headers(scope.response.headers);
    try {
      // `spa` pages render their SPA part as one root island; with `ssr = false` the server sends
      // a shell and neither loads nor runs the SPA's layouts and page (TASK-25).
      const spa =
        route.mode === "spa"
          ? spaPagePart(manifest, route.layouts, route.file, route.ssr)
          : undefined;
      const csr = spa !== undefined && !spa.ssr;
      const [layouts, pageModule] = await Promise.all([
        Promise.all((csr ? spa.outer : route.layouts).map((file) => loadComponent(file))),
        csr ? undefined : loadModule(route.file),
      ]);
      if (pageModule !== undefined) applyRouteLimits(scope, pageModule, route.file);
      const allow =
        pageModule !== undefined && hasActions(pageModule) ? ACTION_PAGE_METHODS : PAGE_METHODS;
      if (request.method === "OPTIONS") return allowResponse(204, allow);
      if (request.method === "POST" && allow === ACTION_PAGE_METHODS) {
        const response = await handleAction(scope, pageModule!, actionResult);
        if (response !== undefined) return response;
      } else if (request.method !== "GET" && request.method !== "HEAD") {
        return allowResponse(405, allow);
      }
      const page = pageModule === undefined ? undefined : componentOf(pageModule, route.file);
      if (typeof pageModule?.headers === "function") {
        const headers = new Headers(await pageModule.headers(routeCtx));
        for (const [name, value] of headers) scope.response.setHeader(name, value);
      }
      const props = { params: match.params };
      const tree: PageTree =
        spa === undefined
          ? { layouts, page: page!, props, params: match.params }
          : spaPageTree(
              spa,
              layouts.slice(0, spa.outer.length),
              csr ? undefined : [...layouts.slice(spa.outer.length), page!],
              props,
              match.params,
            );
      return await renderPage(
        scope,
        tree,
        [...route.layouts, route.file],
        prerendering || (typeof prerender === "function" ? prerender(route) : prerender),
        spa !== undefined,
      );
    } catch (error) {
      scope.response = createResponseState(200, baseline);
      return renderError(error, scope, route);
    }
  }

  /**
   * Runs the form action a page POST targets. Returns its response, or `undefined` to re-render
   * the page with `actionData()` (status 200, or the `fail()` status). Enhanced submissions get a
   * JSON result instead; thrown redirects still propagate and become redirect results in handle().
   */
  async function handleAction(
    scope: RequestScope,
    pageModule: ModuleExports,
    actionResult: boolean,
  ): Promise<Response | undefined> {
    const { ctx } = scope;
    if (!actionResult) {
      const outcome = await runAction(resolveAction(pageModule, ctx.url), ctx);
      if (outcome instanceof Response) return outcome;
      scope.action = { data: outcome.data, encoded: encodeActionData(outcome.data) };
      if (outcome.status !== 200) scope.response.setStatus(outcome.status);
      return undefined;
    }
    try {
      const outcome = await runAction(resolveAction(pageModule, ctx.url), ctx);
      return outcome instanceof Response ? outcome : actionResultResponse(outcomeBody(outcome));
    } catch (error) {
      if (isRedirect(error)) throw error;
      const status = isHttpError(error) ? error.status : 500;
      if (!isHttpError(error)) onError(error, ctx.request);
      const message = isHttpError(error)
        ? error.message
        : dev
          ? toError(error).message
          : statusText(500);
      return actionResultResponse({ type: "error", status, error: { message } });
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
    resolveAll = prerender === true,
    spa = false,
  ): Promise<Response> {
    const { request } = scope.ctx;
    const { nonce } = scope;
    // A policy configured with `lumen({ headers })` for this path replaces Lumen's.
    const ownPolicy =
      options.csp === "strict" &&
      !(
        options.headers !== undefined &&
        "content-security-policy" in
          headersFor(options.headers, routePath(scope.ctx.url.pathname, base) ?? "/")
      );
    const document =
      options.document === undefined
        ? undefined
        : componentOf<DocumentComponent>(await loadModule(options.document), options.document);
    const shell = await render(
      { ...tree, document },
      {
        request,
        signal: request.signal,
        resolveAll,
        onError: (error) => onError(error, request),
        // Production: ErrorBoundary fallbacks see a generic error with a digest (decision-29).
        ...(dev ? {} : { sanitizeErrors: true }),
        ...(spa && options.spaEntry !== undefined ? { loaderUrl: options.spaEntry } : {}),
        ...(options.csp === undefined ? {} : { csp: { nonce } }),
      },
    );
    const state = scope.response;
    state.seal();
    let body: string | ReadableStream<Uint8Array>;
    // The speculation rules of MPA pages (the stream may carry them, see ./navigation.ts).
    const mpa = nonce === undefined ? navigation.mpa : nonceRules(navigation.mpa, nonce);
    const rules = spa
      ? { head: "", stream: shell.stream }
      : documentRules(mpa, () => scope.prefetchLinks === true, shell.stream);
    try {
      const assets = addNonce(
        options.headAssets === undefined ? "" : await options.headAssets(files, spa),
        nonce,
      );
      // Islands read the same actionData() while hydrating as during SSR.
      const action =
        scope.action === undefined || scope.action.data === undefined
          ? ""
          : `<script type="application/json" data-l-action>${jsonForScript(scope.action.encoded)}</script>`;
      const meta = nonce === undefined ? "" : nonceMeta(nonce);
      const pages = addNonce(navigation.pages, nonce);
      const head = meta + shell.head + assets + pages + rules.head + action;
      const parts = documentParts(shell.body, head, document !== undefined);
      body = documentBody(parts, rules.stream, (error) => onError(error, request));
      // A prerendered page is a file: its inline scripts and styles are allowed by hash.
      if (ownPolicy && prerendering && typeof body === "string") {
        body = withHashPolicy(body);
      }
    } catch (error) {
      await rules.stream?.cancel(error);
      throw error;
    }
    const headers = new Headers(state.headers);
    if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
    if (ownPolicy && nonce !== undefined && !dev && !headers.has("content-security-policy")) {
      headers.set("content-security-policy", noncePolicy(nonce));
    }
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
          // Error pages below an `spa` layout render inside the SPA, as pages do (TASK-25).
          const spa = spaErrorPart(manifest, layouts, page.file);
          const csr = spa !== undefined && !spa.ssr;
          const [layoutComponents, component] = await Promise.all([
            Promise.all((csr ? spa.outer : layouts).map((layout) => loadComponent(layout))),
            csr ? undefined : loadComponent(page.file),
          ]);
          const params = scope.ctx.params;
          const props = { status, error: exposed, params };
          const tree: PageTree =
            spa === undefined
              ? { layouts: layoutComponents, page: component!, props, params }
              : spaPageTree(
                  spa,
                  layoutComponents.slice(0, spa.outer.length),
                  csr ? undefined : [...layoutComponents.slice(spa.outer.length), component!],
                  props,
                  params,
                );
          return await renderPage(
            scope,
            tree,
            [...layouts, page.file],
            undefined,
            spa !== undefined,
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

  /**
   * A route's `export const limits` over the app's, for the rest of the request; then a declared
   * `Content-Length` over the limit is refused before the route reads anything (413).
   */
  function applyRouteLimits(scope: RequestScope, module: ModuleExports, file: string): void {
    const limits = scope.bodyLimits!;
    if (module.limits !== undefined) {
      limits.current = resolveLimits(module.limits, appLimits, `${file}: export const limits`);
    }
    if (scope.ctx.request.body !== null)
      checkContentLength(scope.ctx.request.headers, limits.current);
  }

  return { fetch };
}

async function serveEndpoint(
  ctx: RequestContext,
  request: Request,
  module: ModuleExports,
): Promise<Response> {
  const method = request.method as HttpMethod;
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
    throw new TypeError(
      `Endpoint ${method} ${new URL(request.url).pathname} must return a Response.`,
    );
  }
  return method === "HEAD" ? withoutBody(response) : response;
}

/** The request context of a route being prerendered: request, cookies, locals and the query throw LUM5001. */
function prerenderContext(ctx: RequestContext): RequestContext {
  return {
    get request() {
      assertRequestApi("ctx.request");
      return ctx.request;
    },
    get url() {
      return prerenderUrl(ctx.url);
    },
    params: ctx.params,
    get locals() {
      assertRequestApi("ctx.locals");
      return ctx.locals;
    },
    get cookies() {
      assertRequestApi("ctx.cookies");
      return ctx.cookies;
    },
    env: ctx.env,
  };
}

/** The pathname below `base`, starting with "/"; `undefined` outside it. */
function routePath(pathname: string, base: string): string | undefined {
  if (base === "/") return pathname;
  if (pathname === base.slice(0, -1)) return "/";
  return pathname.startsWith(base) ? pathname.slice(base.length - 1) : undefined;
}

/** Where a GET/HEAD page request is redirected for the trailing-slash policy, if anywhere. */
function trailingSlashRedirect(
  request: Request,
  url: URL,
  pathname: string,
  policy: TrailingSlash,
): string | undefined {
  if (policy === "ignore" || pathname === "/") return undefined;
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;
  const slash = url.pathname.endsWith("/");
  if (policy === "always" && !slash) return `${url.pathname}/${url.search}`;
  if (policy === "never" && slash) return `${url.pathname.replace(/\/+$/, "")}${url.search}`;
  return undefined;
}

function componentOf<C = Component<any>>(module: ModuleExports, file: string): C {
  if (typeof module.default !== "function") {
    throw new TypeError(`${file} must export default a component.`);
  }
  return module.default as C;
}

/**
 * Cookies and response-context headers apply to every response, then both are sealed. The cookies
 * of an in-process request belong to its parent's response (`ownsCookies` false).
 */
/** The speculation rules of MPA pages, with the response's nonce. */
function nonceRules<T extends { plain: string; marked: string }>(rules: T, nonce: string): T {
  return { ...rules, plain: addNonce(rules.plain, nonce), marked: addNonce(rules.marked, nonce) };
}

function finalize(response: Response, scope: RequestScope, ownsCookies: boolean): Response {
  const cookies = ownsCookies ? scope.cookies.headers() : [];
  if (ownsCookies) scope.cookies.seal();
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

/** An enhanced submission ended in a redirect: answer with a redirect result `submit()` can follow. */
function redirectAsActionResult(response: Response): Response {
  const location = response.headers.get("location");
  if (response.status < 300 || response.status > 399 || location === null) return response;
  void response.body?.cancel();
  return actionResultResponse(
    { type: "redirect", status: response.status, location },
    response.headers,
  );
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
