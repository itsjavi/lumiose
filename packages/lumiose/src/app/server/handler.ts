// The web-standard request handler (spec §8, decisions 18-19): `export default { fetch }`.
// Matches the URL, builds the request context, runs the middleware chain, then serves an
// endpoint or renders a page through its layouts, the document and the `_404`/`_error` pages.

import type { PageRoute, RouteEntry, RouteManifest, SpecialPage } from "../routes/manifest.ts";
import { normalizeBase, routeHref } from "../routes/href.ts";
import { localizePath, negotiateLocale, splitLocale } from "../i18n/config.ts";
import { createRouteMatcher, type RouteMatch } from "../routes/match.ts";
import type { Component } from "../../contract/client.ts";
import type {
  Endpoint,
  HttpMethod,
  Locals,
  Middleware,
  Platform,
  RequestContext,
  RouteParamValues,
  ServerEnv,
} from "./context.ts";
import { jsonForScript } from "../../server/node.ts";
import { actionName, wantsActionResult } from "../actions/protocol.ts";
import {
  actionResultResponse,
  encodeActionData,
  hasActions,
  outcomeBody,
  resolveAction,
  runAction,
} from "./actions.ts";
import { HttpError, isHttpError, isRedirect, Redirect, statusText } from "./control.ts";
import { createCookieJar, type CookieJar, type CookieOptions } from "./cookies.ts";
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
import {
  createServerRenderer,
  type PageRenderer,
  type PageRenderOptions,
  type PageTree,
} from "./render.ts";
import {
  instrumentationError,
  loadInstrumentation,
  observe,
  type InstrumentationHooks,
  type RequestPhase,
} from "./instrumentation.ts";
import { rerouteScript, spaErrorPart, spaPagePart, spaPageTree } from "../router/server.ts";
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
  /** The routes; with `i18n`, URLs carry locale prefixes and routes declare locales (decision-44). */
  manifest: Pick<RouteManifest, "routes" | "layouts" | "notFoundPages" | "errorPages" | "i18n">;
  /**
   * Request body limits (`lumiose({ limits })`, decision-29): `body` for URL-encoded, JSON and other
   * bodies (default 1 MB), `upload` for multipart (default 10 MB). A route's `export const limits`
   * overrides them for its requests.
   */
  limits?: LimitsOption;
  /** Loads a module by its project-relative path from the manifest (dev: Vite; prod: the build's map). */
  loadModule: (file: string) => Promise<ModuleExports>;
  /** Renders a page tree to its shell and stream. Default: lumiose/server's `createServerRenderer()`. */
  render?: PageRenderer;
  /** Project-relative path of `src/middleware.ts`, when the app has one. */
  middleware?: string;
  /** Project-relative path of `src/document.stsx`, when the app has one. */
  document?: string;
  /**
   * URL of the SPA entry (`virtual:lumiose/spa`, TASK-25): pages that render an SPA (`mode = "spa"`)
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
   * Project-relative path of `src/instrumentation.server.ts` (decision-49): loaded before the
   * first request, which waits for its `register()`; then `onRequestError` receives unexpected
   * errors and `instrumentations` observe the phases of each request. Ignored while prerendering.
   */
  instrumentation?: string;
  /**
   * `src/instrumentation.client.ts` (decision-49): the URL every page loads, first in its head, as
   * `<script type="module" data-l-client>`, and the chunks it imports, preloaded with it. The
   * island loader and the SPA entry of such an app import the same URL and wait for it.
   */
  clientEntry?: { url: string; preloads?: readonly string[] };
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
   * Build-time prerendering (`lumiose build`): pages and endpoints render with request APIs guarded
   * (LUM5001, reported through `onError`) and fully resolved. Middleware is not guarded.
   */
  prerendering?: boolean;
  /**
   * Cross-document View Transitions between pages (`lumiose({ viewTransitions })`, decision-24):
   * every page document opts in, unless the reader prefers reduced motion. Default `false`.
   */
  viewTransitions?: boolean;
  /**
   * Speculation rules that prefetch the same-origin links of MPA pages, endpoints excepted
   * (`lumiose({ prefetch })`, decision-24): on hover, early (`viewport`) or not. Default `"none"`
   * here; `lumiose dev` and `lumiose build` default to `"hover"`.
   */
  prefetch?: Prefetch;
  /**
   * `lumiose({ csp: "strict" })` (spec §7.4, ./csp.ts): pages get a per-response nonce on every
   * inline script and style Lumiose writes and a `Content-Security-Policy` header (outside dev,
   * unless the page or middleware sets one); prerendered pages get a hash policy `<meta>`.
   */
  csp?: CspOption;
  /**
   * `lumiose({ headers })`, which adapters and `lumiose dev` send: a `Content-Security-Policy` it
   * configures for a path replaces Lumiose's strict policy there (header and prerendered `<meta>`).
   */
  headers?: HeadersOption;
  /**
   * `lumiose({ site })`, the site's origin (`https://example.com`): the absolute `hreflang` and
   * canonical URLs of localized pages while prerendering, which has no request origin. Without it,
   * prerendered pages get root-relative ones.
   */
  site?: string;
}

export type TrailingSlash = "ignore" | "always" | "never";

export interface RequestHandler {
  /**
   * Serves a request. `platform` is what the host adds (`ctx.platform`): bindings, `waitUntil`
   * and the client address; missing fields fall back (see `Platform`).
   */
  fetch(request: Request, platform?: Partial<Platform>): Promise<Response>;
}

const METHODS: readonly HttpMethod[] = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
const PAGE_METHODS = "GET, HEAD, OPTIONS";
const ACTION_PAGE_METHODS = "GET, HEAD, POST, OPTIONS";
/** Nesting limit for in-process requests (`fetchJSON()` during SSR), against fetch loops. */
const MAX_IN_PROCESS_DEPTH = 8;
const CROSS_SITE_MESSAGE = "Cross-site form submissions are forbidden.";
/** What detection answers for a prefetch: no decision (see `routeLocale`). */
const PREFETCH: unique symbol = Symbol("prefetch");
/** The locale cookie detection writes on a first visit: a year, readable by language switchers. */
const LOCALE_COOKIE: CookieOptions = { path: "/", maxAge: 60 * 60 * 24 * 365, httpOnly: false };

interface ErrorPages {
  notFoundPage: string | undefined;
  errorPage: string | undefined;
}

/** What an in-process request shares with the request that made it. */
interface ParentRequest {
  cookies: CookieJar;
  locals: Locals;
  platform: Platform;
  depth: number;
}

export function createRequestHandler(options: RequestHandlerOptions): RequestHandler {
  const { manifest, loadModule, dev = false, prerendering = false } = options;
  const prerender = prerendering || (options.prerender ?? false);
  const base = normalizeBase(options.base ?? "/");
  const trailingSlash = options.trailingSlash ?? "ignore";
  const { i18n } = manifest;
  const navigation = navigationHead(options, manifest.routes, base, i18n);
  const render = options.render ?? createServerRenderer();
  const onError = options.onError ?? ((error: unknown) => console.error(error));
  const matcher = createRouteMatcher(manifest);
  const routesByPattern = new Map(manifest.routes.map((route) => [route.pattern, route]));
  // Reuses the _404 scope lookup to find the _error page covering an unmatched URL.
  const errorMatcher = createRouteMatcher({ routes: [], notFoundPages: manifest.errorPages });
  const specialPages = new Map<string, SpecialPage>(
    [...manifest.notFoundPages, ...manifest.errorPages].map((page) => [page.file, page]),
  );
  // A `_404` page inside an SPA hides the document while its URL may be a page the router renders
  // instead (TASK-231), by SPA.
  const notFoundFiles = new Set(manifest.notFoundPages.map((page) => page.file));
  const rerouteScripts = new Map<string, string>();
  const rerouteHead = (app: string): string => {
    let script = rerouteScripts.get(app);
    if (script === undefined)
      rerouteScripts.set(app, (script = rerouteScript(manifest, app, base)));
    return script;
  };

  const allowedOrigins = new Set(options.csrf === false ? [] : options.csrf?.allowedOrigins);
  const clientHead = clientEntryHead(options.clientEntry);
  const appLimits = resolveLimits(options.limits, DEFAULT_LIMITS, "lumiose({ limits })");

  // `src/instrumentation.server.ts`: loaded on the first request, which waits for `register()`.
  // Without it (and while prerendering) `hooks` stays undefined: one check per phase.
  const instrumentationFile = prerendering ? undefined : options.instrumentation;
  let hooks: InstrumentationHooks | undefined;
  let ready = instrumentationFile === undefined;
  let loading: Promise<void> | undefined;

  function fetch(request: Request, platform?: Partial<Platform>): Promise<Response> {
    if (!ready) {
      loading ??= instrument(instrumentationFile!, request);
      return loading.then(() => fetch(request, platform));
    }
    if (hooks === undefined || hooks.request.length === 0) {
      return handle(request, undefined, platform);
    }
    // The whole request, observed by `request` wrappers (top-level requests only).
    const match = matchOf(request);
    return observe(
      hooks.request,
      {
        request,
        route: match?.route.pattern as RequestContext["route"],
        params: match?.params ?? {},
      },
      () => handle(request, undefined, platform),
      wrapperFailed(request),
      (response) => ({ response: { status: response.status } }),
    );
  }

  /** The route a request matches, as `handle` matches it, for `request` wrappers. */
  function matchOf(request: Request): RouteMatch | null {
    const pathname = routePath(new URL(request.url).pathname, base);
    const path =
      pathname === undefined || i18n === undefined ? pathname : splitLocale(pathname, i18n).path;
    return path === undefined ? null : matcher.match(path);
  }

  async function instrument(file: string, request: Request): Promise<void> {
    try {
      hooks = await loadInstrumentation(await loadModule(file), file, (error) =>
        onError(error, request),
      );
    } catch (error) {
      onError(error, request);
    }
    ready = true;
  }

  /**
   * An unexpected error of a request: the host's `onError`, then `onRequestError` of the
   * instrumentation. `log: false` reports to the instrumentation only.
   */
  function report(
    error: unknown,
    ctx: RequestContext,
    phase: RequestPhase,
    digest?: string,
    log = true,
  ): void {
    if (log) onError(error, ctx.request);
    const onRequestError = hooks?.onRequestError;
    if (onRequestError === undefined) return;
    const info = { request: ctx.request, route: ctx.route, params: ctx.params, phase, digest };
    try {
      const result = onRequestError(error, info);
      if (result instanceof Promise) result.catch((failure) => failed(failure, ctx.request));
    } catch (failure) {
      failed(failure, ctx.request);
    }
  }

  /** What `onRequestError` threw, for the server log. */
  function failed(failure: unknown, request: Request): void {
    onError(instrumentationError(instrumentationFile!, "onRequestError()", failure), request);
  }

  /** What a wrapper of `instrumentations` threw, for the server log. */
  function wrapperFailed(request: Request): (failure: unknown) => void {
    return (failure) =>
      onError(
        instrumentationError(instrumentationFile!, "an instrumentations wrapper", failure),
        request,
      );
  }

  /** `ctx.platform`: the host's fields, with fallbacks for those it does not pass. */
  function platformOf(
    request: Request,
    given: Partial<Platform> | undefined,
    rejected: (error: unknown, log: boolean) => void,
  ): Platform {
    const hostWaitUntil = given?.waitUntil;
    return {
      env: given?.env ?? ({} as Platform["env"]),
      waitUntil:
        hostWaitUntil === undefined
          ? (promise) => {
              Promise.resolve(promise).catch((error: unknown) => rejected(error, true));
            }
          : hooks?.onRequestError === undefined
            ? hostWaitUntil
            : // The host still sees the rejection (it logs it); onRequestError gets it too.
              (promise) =>
                hostWaitUntil(
                  Promise.resolve(promise).catch((error: unknown) => {
                    rejected(error, false);
                    throw error;
                  }),
                ),
      clientAddress: given?.clientAddress,
    };
  }

  async function handle(
    incoming: Request,
    parent: ParentRequest | undefined,
    platform?: Partial<Platform>,
  ): Promise<Response> {
    // Every body is bounded (413 beyond the limits); a route's own limits replace the app's once
    // its module is loaded (`applyRouteLimits`).
    const limits = { current: appLimits };
    const request = boundedRequest(incoming, () => limits.current);
    const url = new URL(request.url);
    // The path below `base`; outside it nothing matches and the root error pages apply. With
    // `i18n`, routes match the path without its locale prefix (`/es/about` → `/about`).
    const pathname = routePath(url.pathname, base);
    const localized =
      pathname === undefined || i18n === undefined ? undefined : splitLocale(pathname, i18n);
    const path = localized?.path ?? pathname;
    const match = path === undefined ? null : matcher.match(path);
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
      platform:
        parent?.platform ??
        platformOf(request, platform, (error, log) =>
          report(error, ctx, "waitUntil", undefined, log),
        ),
      locale: localized?.locale as RequestContext["locale"],
      route: match?.route.pattern as RequestContext["route"],
    };
    const depth = parent === undefined ? 0 : parent.depth + 1;
    const scope: RequestScope = {
      ctx,
      cookies,
      ...(match === null ? {} : { route: match.route.pattern }),
      response: createResponseState(),
      fetch: (inner) =>
        fetchInProcess(
          inner,
          { cookies, locals: ctx.locals, platform: ctx.platform, depth },
          request,
        ),
      ...(options.csp === "strict" && !prerendering ? { nonce: createNonce() } : {}),
      bodyLimits: limits,
      ...(localized === undefined
        ? {}
        : {
            i18n: {
              locale: localized.locale,
              href: (pattern, params) =>
                routeHref(pattern, params, {
                  base,
                  trailingSlash,
                  i18n: i18n!,
                  locale: localized.locale,
                }),
              alternates: [],
              routeAlternates,
            },
          }),
    };

    // Prerendering guards request APIs in routes, not in middleware (nested in-process requests
    // run their middleware unguarded too).
    const guard: PrerenderGuard | undefined = prerendering
      ? { report: (error) => onError(error, request) }
      : undefined;
    // Error pages cover the path without its locale prefix, like routes.
    const notFoundPath = path ?? "/";
    return runInRequestScope(scope, async () => {
      let response: Response;
      try {
        response = await runPrerenderGuarded(undefined, () =>
          runMiddleware(ctx, () =>
            runPrerenderGuarded(guard, () =>
              dispatch(scope, match, actionResult, notFoundPath, parent !== undefined, guard),
            ),
          ),
        );
      } catch (error) {
        scope.response = createResponseState();
        response =
          match?.route.kind === "endpoint"
            ? endpointError(error, ctx, "middleware")
            : await runPrerenderGuarded(guard, () =>
                renderError(error, scope, errorPagesFor(match, notFoundPath), "middleware"),
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

  /** `src/middleware.ts` around `last`; every request runs it. */
  function runMiddleware(ctx: RequestContext, last: () => Promise<Response>): Promise<Response> {
    return options.middleware === undefined
      ? last()
      : runMiddlewareFiles(ctx, [options.middleware], last);
  }

  /** The middleware of `files` around `last`, in order: each file's functions, then the next file's. */
  async function runMiddlewareFiles(
    ctx: RequestContext,
    files: readonly string[],
    last: () => Promise<Response>,
  ): Promise<Response> {
    const chains =
      files.length === 1
        ? [await loadMiddleware(files[0]!)]
        : await Promise.all(files.map(loadMiddleware));
    // Each file, observed by `middleware` wrappers around itself and what follows it.
    const enter = (fileIndex: number): Promise<Response> => {
      const wrappers = hooks?.middleware;
      if (wrappers === undefined || wrappers.length === 0 || fileIndex === files.length) {
        return call(fileIndex, 0);
      }
      const { request, route, params } = ctx;
      return observe(
        wrappers,
        { request, route, params, file: files[fileIndex]! },
        () => call(fileIndex, 0),
        wrapperFailed(request),
      );
    };
    const call = async (fileIndex: number, index: number): Promise<Response> => {
      const chain = chains[fileIndex];
      if (chain === undefined) return last();
      const middleware = chain[index];
      if (middleware === undefined) return enter(fileIndex + 1);
      let called = false;
      const response = await middleware(ctx, () => {
        if (called) throw new Error("Middleware called next() more than once.");
        called = true;
        return call(fileIndex, index + 1);
      });
      if (!(response instanceof Response)) {
        throw new TypeError(
          `Middleware #${index + 1} in ${files[fileIndex]} must return a Response (usually \`return next()\`).`,
        );
      }
      return response;
    };
    return enter(0);
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

  // Not async, like `serveMatched`: a request without folder middleware goes through as many
  // async functions as before them.
  function dispatch(
    scope: RequestScope,
    match: RouteMatch | null,
    actionResult: boolean,
    pathname: string,
    inProcess: boolean,
    guard: PrerenderGuard | undefined,
  ): Promise<Response> {
    if (match === null) {
      return renderError(new HttpError(404, "Not Found"), scope, errorPagesFor(null, pathname));
    }
    if (scope.i18n === undefined) {
      return serveMatched(scope, match, actionResult, undefined, guard);
    }
    return routeLocale(scope, match, pathname, inProcess).then((outcome) =>
      outcome instanceof Response
        ? outcome
        : serveMatched(scope, match, actionResult, outcome, guard),
    );
  }

  /**
   * A matched route behind its folder middleware (decision-48), outermost first, unguarded while
   * prerendering like src/middleware.ts. What the middleware throws renders the error page outside
   * the chain (`handle`).
   */
  function serveMatched(
    scope: RequestScope,
    match: RouteMatch,
    actionResult: boolean,
    localeHead: { links: string; canonical: string } | undefined,
    guard: PrerenderGuard | undefined,
  ): Promise<Response> {
    const folders = match.route.middleware;
    if (folders === undefined) return serveRoute(scope, match, actionResult, localeHead);
    return runPrerenderGuarded(undefined, () =>
      runMiddlewareFiles(scope.ctx, folders, () =>
        runPrerenderGuarded(guard, () => serveRoute(scope, match, actionResult, localeHead)),
      ),
    );
  }

  /** Serves a matched route: its endpoint, or its page (with its form action). */
  async function serveRoute(
    scope: RequestScope,
    match: RouteMatch,
    actionResult: boolean,
    localeHead: { links: string; canonical: string } | undefined,
  ): Promise<Response> {
    const { request } = scope.ctx;
    const { route } = match;
    // What route code sees: while prerendering, its request APIs throw LUM5001.
    const routeCtx = prerendering ? prerenderContext(scope.ctx) : scope.ctx;
    if (route.kind === "endpoint") {
      try {
        const module = await loadModule(route.file);
        applyRouteLimits(scope, module, route.file);
        const wrappers = hooks?.endpoint;
        if (wrappers === undefined || wrappers.length === 0) {
          return await serveEndpoint(routeCtx, request, module);
        }
        const { route: pattern, params } = scope.ctx;
        return await observe(
          wrappers,
          { request, route: pattern, params, method: request.method as HttpMethod },
          () => serveEndpoint(routeCtx, request, module),
          wrapperFailed(request),
        );
      } catch (error) {
        return endpointError(error, scope.ctx, "endpoint");
      }
    }

    const baseline = new Headers(scope.response.headers);
    // Where an error of the page comes from, for `onRequestError`.
    let phase: RequestPhase = "render";
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
        phase = "action";
        const response = await handleAction(scope, pageModule!, actionResult);
        if (response !== undefined) return response;
        phase = "render";
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
        localeHead?.links,
        localeHead?.canonical,
      );
    } catch (error) {
      scope.response = createResponseState(200, baseline);
      return renderError(error, scope, route, phase);
    }
  }

  /**
   * The locales of a matched route (decision-44): a route requested in a locale it does not declare
   * is a 404, or a redirect to the default locale's URL with `missing: "redirect"`; detection may
   * redirect an entry request to the visitor's locale. Otherwise records the route's URL in each
   * declared locale (`alternates()`) and returns the `hreflang` links and canonical of a page.
   */
  async function routeLocale(
    scope: RequestScope,
    match: RouteMatch,
    path: string,
    inProcess: boolean,
  ): Promise<Response | { links: string; canonical: string }> {
    const config = i18n!;
    const { route, params } = match;
    const { request, url } = scope.ctx;
    const locale = scope.i18n!.locale;
    const declared = await declaredLocales(route, params);
    const search = prerendering ? "" : url.search;
    if (!declared.includes(locale)) {
      if (
        locale !== config.defaultLocale &&
        config.missing === "redirect" &&
        declared.includes(config.defaultLocale)
      ) {
        // 307 keeps the method and body of a form post.
        const get = request.method === "GET" || request.method === "HEAD";
        return redirectResponse(
          new Redirect(base + path.slice(1) + search, get ? 302 : 307),
          request,
        );
      }
      throw new HttpError(404, "Not Found");
    }
    const target = route.kind === "page" && !inProcess ? detectLocale(scope, path) : undefined;
    if (target === PREFETCH) {
      // A prefetch (speculation rules, `<link rel=prefetch>`, a prerender) must not keep a
      // detection decision: a language switcher may change the cookie before the navigation. Browsers
      // discard a prefetch that is not 2xx, and the navigation itself then detects.
      return new Response(null, {
        status: 503,
        headers: { "cache-control": "no-store", vary: "Sec-Purpose, Cookie, Accept-Language" },
      });
    }
    if (target !== undefined && target !== locale && declared.includes(target)) {
      const localizedPath = localizePath(path, target, config);
      const slash = trailingSlash === "always" && path === "/" ? "/" : "";
      return new Response(null, {
        status: 302,
        headers: { location: base + localizedPath.slice(1) + slash + search },
      });
    }
    const values = params as Record<string, unknown>;
    scope.i18n!.alternates = declared.map((each) => ({
      locale: each,
      href: routeHref(route.pattern, values, { base, trailingSlash, i18n: config, locale: each }),
    }));
    // Search engines need absolute URLs: the request's origin, or `site` while prerendering.
    const origin = prerendering ? options.site : url.origin;
    const absolute = (href: string) => (origin === undefined ? href : origin + href);
    if (route.kind !== "page" || declared.length < 2) return { links: "", canonical: "" };
    let links = "";
    for (const alternate of scope.i18n!.alternates) {
      links += `<link rel="alternate" hreflang="${escapeHtml(alternate.locale)}" href="${escapeHtml(absolute(alternate.href))}">`;
    }
    const own = scope.i18n!.alternates.find((alternate) => alternate.locale === locale)!;
    return {
      links,
      canonical: `<link rel="canonical" href="${escapeHtml(absolute(own.href))}">`,
    };
  }

  /**
   * `alternates(pattern, params)`: a route's URL in each locale it declares, for links to a page
   * that has fewer locales than the current one. Rendering is synchronous, so a route that decides
   * its locales with a `locales({ params })` function is an error.
   */
  function routeAlternates(
    pattern: string,
    params: Record<string, unknown>,
  ): Array<{ locale: string; href: string }> {
    const config = i18n!;
    const route = routesByPattern.get(pattern);
    if (route === undefined) {
      throw new TypeError(`alternates("${pattern}"): no route has this pattern.`);
    }
    if (route.localesFrom !== undefined) {
      throw new TypeError(
        `alternates("${pattern}"): ${route.localesFrom} decides the route's locales per params with a locales({ params }) function, which alternates() cannot run while rendering. Build the links with href("${pattern}", { ...params, locale }) from the locales your content lists, or declare them as a list (export const locales = [...]).`,
      );
    }
    return (route.locales ?? [config.defaultLocale]).map((each) => ({
      locale: each,
      href: routeHref(pattern, { ...params, locale: each }, { base, trailingSlash, i18n: config }),
    }));
  }

  /** The locales a route declares for these params: static, or its `locales({ params })` function's. */
  async function declaredLocales(route: RouteEntry, params: RouteParamValues): Promise<string[]> {
    const config = i18n!;
    if (route.localesFrom === undefined) return route.locales ?? [config.defaultLocale];
    const exported = (await loadModule(route.localesFrom)).locales;
    if (typeof exported !== "function") {
      throw new TypeError(
        `${route.localesFrom}: export locales must be a function locales({ params }).`,
      );
    }
    const result: unknown = await exported({ params });
    if (result === "all") return config.locales;
    if (!Array.isArray(result) || !result.every((each) => typeof each === "string")) {
      throw new TypeError(
        `${route.localesFrom}: locales({ params }) must return a list of locales or "all", got ${typeof result}.`,
      );
    }
    const unknown = result.filter((each) => !config.locales.includes(each));
    if (unknown.length > 0) {
      throw new TypeError(
        `${route.localesFrom}: locales({ params }) returned ${unknown.map((each) => `"${each}"`).join(", ")}, which lumiose({ i18n }) does not configure.`,
      );
    }
    return result as string[];
  }

  /**
   * Locale detection, on entry only (decision-44): on a first visit (no locale cookie) the visitor's
   * `Accept-Language` locale, which the cookie then records; on `/`, the cookie's locale. Deep links
   * with a cookie and prefixed URLs never redirect. Responses that depend on it vary on both
   * headers and are not cached; a prefetch of such a request gets `PREFETCH`, and no decision.
   */
  function detectLocale(scope: RequestScope, path: string): string | typeof PREFETCH | undefined {
    const config = i18n!;
    const { detect } = config;
    const { request, cookies } = scope.ctx;
    if (detect === false || prerendering) return undefined;
    if (request.method !== "GET" && request.method !== "HEAD") return undefined;
    if (scope.i18n!.locale !== config.defaultLocale) return undefined;
    const root = path === "/";
    const stored = detect.cookie === undefined ? undefined : cookies.get(detect.cookie);
    // Without a cookie, first visits cannot be told apart: only `/` detects. With one, only `/`.
    if (stored === undefined ? detect.cookie === undefined && !root : !root) return undefined;
    if (/\bprefetch\b/i.test(request.headers.get("sec-purpose") ?? "")) return PREFETCH;
    let target: string | undefined;
    if (stored === undefined) {
      target = detect.acceptLanguage
        ? negotiateLocale(request.headers.get("accept-language"), config.locales)
        : undefined;
      if (detect.cookie !== undefined) {
        cookies.set(detect.cookie, target ?? config.defaultLocale, LOCALE_COOKIE);
      }
    } else {
      target = config.locales.includes(stored) ? stored : undefined;
    }
    scope.response.setHeader("vary", "Cookie, Accept-Language");
    scope.response.setHeader("cache-control", "private, no-store");
    return target;
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
      const outcome = await observedAction(pageModule, ctx);
      if (outcome instanceof Response) return outcome;
      scope.action = { data: outcome.data, encoded: encodeActionData(outcome.data) };
      if (outcome.status !== 200) scope.response.setStatus(outcome.status);
      return undefined;
    }
    try {
      const outcome = await observedAction(pageModule, ctx);
      return outcome instanceof Response ? outcome : actionResultResponse(outcomeBody(outcome));
    } catch (error) {
      if (isRedirect(error)) throw error;
      const status = isHttpError(error) ? error.status : 500;
      if (!isHttpError(error)) report(error, ctx, "action");
      const message = isHttpError(error)
        ? error.message
        : dev
          ? toError(error).message
          : statusText(500);
      return actionResultResponse({ type: "error", status, error: { message } });
    }
  }

  /** Runs the action a page POST targets, observed by `action` wrappers. */
  function observedAction(pageModule: ModuleExports, ctx: RequestContext) {
    const action = resolveAction(pageModule, ctx.url);
    const wrappers = hooks?.action;
    if (wrappers === undefined || wrappers.length === 0) return runAction(action, ctx);
    const { request, route, params } = ctx;
    return observe(
      wrappers,
      { request, route, params, name: actionName(ctx.url) ?? "default" },
      () => runAction(action, ctx),
      wrapperFailed(request),
    );
  }

  function endpointError(error: unknown, ctx: RequestContext, phase: RequestPhase): Response {
    const { request } = ctx;
    if (isRedirect(error)) return redirectResponse(error, request);
    if (isHttpError(error)) {
      return new Response(error.message, {
        status: error.status,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    report(error, ctx, phase);
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
    extraHead = "",
    defaultHead = "",
  ): Promise<Response> {
    const { request } = scope.ctx;
    // A policy configured with `lumiose({ headers })` for this path replaces Lumiose's.
    const ownPolicy =
      options.csp === "strict" &&
      !(
        options.headers !== undefined &&
        "content-security-policy" in
          headersFor(options.headers, routePath(scope.ctx.url.pathname, base) ?? "/")
      );
    // Per request: the response's nonce. Prerendering: a marker nonce that tags what Lumiose and JSX
    // emit, so only those are hashed (and the marker removed) — never injected markup (TASK-165).
    const hashMarker =
      prerendering && ownPolicy && scope.nonce === undefined ? createNonce() : undefined;
    const nonce = scope.nonce ?? hashMarker;
    const document =
      options.document === undefined
        ? undefined
        : componentOf<DocumentComponent>(await loadModule(options.document), options.document);
    const { ctx } = scope;
    const renderOptions: PageRenderOptions = {
      request,
      signal: request.signal,
      resolveAll,
      onError: (error, streamed) => report(error, ctx, streamed === true ? "stream" : "render"),
      // Production: ErrorBoundary fallbacks see a generic error with a digest (decision-29), which
      // the server log gets with the error; onRequestError gets every caught error, dev included.
      onCaughtError: (error, { digest, streamed }) =>
        report(error, ctx, streamed ? "stream" : "render", digest, digest !== undefined),
      ...(dev ? {} : { sanitizeErrors: true }),
      ...(spa && options.spaEntry !== undefined ? { loaderUrl: options.spaEntry } : {}),
      ...(options.csp === undefined ? {} : { csp: { nonce } }),
    };
    if (hooks !== undefined && hooks.stream.length > 0) {
      const wrappers = hooks.stream;
      const info = { request, route: ctx.route, params: ctx.params };
      renderOptions.onBoundary = (settled) => {
        observe(wrappers, info, () => settled, wrapperFailed(request)).catch(() => {});
      };
    }
    const page = { ...tree, document };
    const shell =
      hooks === undefined || hooks.render.length === 0
        ? await render(page, renderOptions)
        : await observe(
            hooks.render,
            { request, route: ctx.route, params: ctx.params },
            () => render(page, renderOptions),
            wrapperFailed(request),
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
      const meta = scope.nonce === undefined ? "" : nonceMeta(scope.nonce);
      const pages = addNonce(navigation.pages, nonce);
      // The client entry first: the island loader or SPA entry in the shell's head looks it up.
      const head =
        meta +
        addNonce(clientHead + extraHead, nonce) +
        shell.head +
        assets +
        pages +
        rules.head +
        action;
      const parts = documentParts(shell.body, head, document !== undefined, {
        ...(scope.i18n === undefined ? {} : { lang: scope.i18n.locale }),
        // Lumiose's canonical of a localized page: the page's or a layout's own replaces it.
        ...(defaultHead === "" ? {} : { defaults: addNonce(defaultHead, nonce) }),
      });
      body = documentBody(parts, rules.stream, (error) => report(error, ctx, "stream"));
      // A prerendered page is a file: its inline scripts and styles are allowed by hash.
      if (hashMarker !== undefined && typeof body === "string") {
        body = await withHashPolicy(body, hashMarker);
      }
    } catch (error) {
      await rules.stream?.cancel(error);
      throw error;
    }
    const headers = new Headers(state.headers);
    if (!headers.has("content-type")) headers.set("content-type", "text/html; charset=utf-8");
    if (ownPolicy && scope.nonce !== undefined && !dev && !headers.has("content-security-policy")) {
      headers.set("content-security-policy", noncePolicy(scope.nonce));
    }
    // A nonce is only secret while the HTML stays private to this response: a shared cache that
    // served it to others would let injected markup reuse it (TASK-165). The app's own value wins.
    if (scope.nonce !== undefined && !headers.has("cache-control")) {
      headers.set("cache-control", "private, no-store");
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
  async function renderError(
    error: unknown,
    scope: RequestScope,
    pages: ErrorPages,
    phase: RequestPhase = "render",
  ) {
    const { request } = scope.ctx;
    if (isRedirect(error)) return redirectResponse(error, request);
    const status = isHttpError(error) ? error.status : 500;
    if (!isHttpError(error)) report(error, scope.ctx, phase);
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
            spa?.ssr === true && notFoundFiles.has(page.file) ? rerouteHead(spa.app) : "",
          );
        } catch (failure) {
          if (isRedirect(failure)) return redirectResponse(failure, request);
          report(failure, scope.ctx, "render");
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
    locale: ctx.locale,
    route: ctx.route,
    get locals() {
      assertRequestApi("ctx.locals");
      return ctx.locals;
    },
    get cookies() {
      assertRequestApi("ctx.cookies");
      return ctx.cookies;
    },
    env: ctx.env,
    platform: ctx.platform,
  };
}

/** The `<head>` tags of `src/instrumentation.client.ts`: its imports preloaded, then the module. */
function clientEntryHead(entry: RequestHandlerOptions["clientEntry"]): string {
  if (entry === undefined) return "";
  let html = "";
  for (const href of entry.preloads ?? []) {
    html += `<link rel="modulepreload" href="${escapeHtml(href)}">`;
  }
  return `${html}<script type="module" src="${escapeHtml(entry.url)}" data-l-client></script>`;
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
  // A path, never a protocol-relative URL: `/a/..//evil.com/` must not redirect to `//evil.com`
  // (TASK-165), so leading slashes collapse to one.
  const path = url.pathname.replace(/^\/{2,}/, "/");
  if (policy === "always" && !slash) return `${path}/${url.search}`;
  if (policy === "never" && slash) return `${path.replace(/\/+$/, "")}${url.search}`;
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
