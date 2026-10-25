# Lumiose docs

> Lumiose is a web framework for everything from static sites and SPAs to full-stack apps: TSX with scoped CSS built in, signals, and 0 kB of JavaScript until a page needs it.

**Feels like React. Runs like vanilla JS.** Components live in `.stsx` files (TSX plus raw-CSS `<style>` blocks), are set up once and
update through signals, and every route picks its rendering mode: static, server, islands or SPA.

These docs ship inside the package, so they always match the installed version. Read them from
`node_modules/lumiose/docs`, or from the terminal:

```sh
lumiose docs                    # this index
lumiose docs signals            # a topic, by name or path (concepts/signals)
lumiose docs "bind:value"       # search, when no topic matches
lumiose explain LUM2001         # the long-form explanation of a diagnostic
lumiose docs signals --format json
```

Every concept page has the same sections, in order: **Concept**, **API**, **Example**, **Common
mistakes** and **Related diagnostics**. Reference pages list every export with its signature. The
Coming from guides map another framework's concepts to the current API (they are not migration
guides) and share one outline: **Mental model**, **From _framework_ to Lumiose** (a table from its
APIs to Lumiose's), **What has no equivalent** (and what to do instead), **Example**, **Common
mistakes** and **Related**.

## Start here

- [Getting started](getting-started.md): Create a project, configure TypeScript and Vite, and render a first component.
- [Stability](stability.md): What 0.x allows, the 1.0 criteria and the API freeze, supported Node.js versions and browsers, and who maintains Lumiose.
- [When not to use Lumiose](when-not-to-use.md): The cases where another framework is the better choice today, and what to use instead.

## Coming from

- [React](coming-from/react.md): Hooks mapped to signals, React 19's forms and server components mapped to form actions and islands, what goes away (the rules of hooks, dependency arrays, stale closures, memoization) and the mistakes React habits cause.
- [Next.js](coming-from/nextjs.md): The App Router mapped to Lumiose: the same route file names, server components by default, `client:*` islands instead of `"use client"`, form actions instead of server actions, metadata, caching and rendering modes.
- [React Router](coming-from/react-router.md): Framework mode mapped to Lumiose: file routes instead of `routes.ts`, async components instead of loaders, form actions and `submit()` instead of actions and fetchers, middleware, the document and custom servers.
- [Solid](coming-from/solid.md): The closest model, so mostly differences: signal and store APIs, props destructuring, control flow as plain JSX, async components instead of resources, `.stsx` styles, islands, and SolidStart and Solid Router mapped to file routes, endpoints and form actions.
- [Astro](coming-from/astro.md): The same page model with one component model instead of two: `.astro` files and framework islands mapped to `.stsx` components, typed `?client` scripts, file routes, endpoints, form actions and Markdown imports, and where Astro is still ahead.

## Concepts

- [Components](concepts/components.md): Setup-once function components, props, children, refs and the `.stsx`/`.tsx`/`.ts` file types.
- [Signals and reactivity](concepts/signals.md): `signal`, `computed`, `effect`, `store`, owners, context and scheduling.
- [Sharing state](concepts/state.md): Component, context and module-scope state; recipes for stores with actions, families, persisted signals, external stores and state shared by islands.
- [JSX](concepts/jsx.md): Bindings, compiled idioms (`.map`, ternaries), `class`, `style`, events, `bind:`, `attach` and `ref`.
- [Styles](concepts/styles.md): Raw-CSS `<style>` blocks scoped by placement, `<style global>`, JS values in styles (`$name`), build-time math and runtime values.
- [Async components](concepts/async.md): `async` components on server and client, `<Suspense>`, `<ErrorBoundary>`, re-runs and in-flight state.
- [Islands](concepts/islands.md): `client:*` directives, serializable props, slots and server-only boundaries.
- [Routing](concepts/routing.md): File routes, layouts, params, typed `href()`, error pages and the SPA router.
- [Internationalization](concepts/i18n.md): Locale prefixes, per-page locale declarations, `locale()`, locale-aware `href()`, `hreflang` and canonical links, detection on entry.
- [Data and actions](concepts/data-and-actions.md): Read data with async components, serve endpoints, mutate with form actions and `submit()`.
- [Server](concepts/server.md): Request context, middleware, cookies, env, redirects and error helpers.
- [Rendering modes](concepts/rendering-modes.md): `static`, `server` and `spa` routes: choosing a mode, combining modes, islands and `<Suspense>`, patterns close to partial prerendering, a comparison with Astro islands, prerendered SPA pages, shell-first streaming, hydration and the build.
- [SVG imports](concepts/svg.md): `import Icon from "./icon.svg?component"` as an inline, optimised component, from your project or a package; `title`, `currentColor`, and Vite's own `.svg` imports.
- [Markdown and HTML imports](concepts/content.md): `.md` and `.html` files as static components; GFM, heading ids, frontmatter and its hook, scoped `<style>`, client `<script>`.
- [Head and document](concepts/head.md): `<Title>`, `<Meta>`, `<Head>` and a custom `document.stsx`.
- [Compiler and diagnostics](concepts/compiler.md): What the compiler does with `.stsx`/`.tsx`, and how `LUMxxxx` diagnostics work.
- [Dev tools](concepts/dev-tools.md): The in-page inspector of `lumiose dev` (Alt+Shift+L): the component tree with props and source locations, signals with their dependents and last write, islands with their hydration state, why something updated, and Alt+click to open any element's source.
- [Testing](concepts/testing.md): Component tests with Vitest and Testing Library (queries and user-event), server rendering as strings, and end-to-end tests with Playwright.
- [Security](concepts/security.md): A strict Content Security Policy with nonces and hashes (`lumiose({ csp: "strict" })`, `cspNonce()`), and the cross-site form check.

## Guides

- [Authentication with Better Auth](guides/auth.md): Email and password accounts with Better Auth and Prisma: the handler as an endpoint, the session in middleware, protected pages, form actions and the browser client in an island.
- [Icons with Lucide](guides/icons.md): Lucide's SVG files (`lucide-static`), or any SVG icon set, as inline components through `?component` imports: install, size, colour and stroke with CSS, labels, and why not `lucide-react`.
- [i18n with Paraglide JS and i18next](guides/i18n.md): Messages in server pages and islands with Paraglide JS (compile-time) or i18next (a `t` per request), keyed by `locale()`; a language switcher on `alternates()` that updates the detection cookie; `hreflang`, canonical and `site` for search engines.
- [Realtime](guides/realtime.md): Server-sent events from an endpoint to an island's `EventSource`, WebSockets with `ws` on the Node adapter's server, proxy configs and per-platform notes.
- [Payments with Stripe Checkout](guides/stripe.md): Checkout started from a form action, a return page, and webhooks received by a `route.ts` endpoint that verifies Stripe's signature.
- [Content from Sanity](guides/sanity.md): Sanity content read in async components and prerendered, draft previews on a server-rendered route behind a secret, and static rebuilds from Sanity's webhook.
- [Tracing with OpenTelemetry](guides/opentelemetry.md): Spans for requests, their phases and client navigations from the instrumentation files, a relay for the browser's spans, and setups for OpenObserve, SigNoz and Datadog.
- [Error reporting with Sentry](guides/sentry.md): Server errors from `onRequestError` and browser errors from `onError` reported to Sentry, with the source maps of both builds uploaded by Sentry's Vite plugin.
- [Product analytics with PostHog](guides/posthog.md): PostHog started in `src/instrumentation.client.ts`, page views on MPA pages and SPA navigations (`afterNavigate`), events from islands and feature flags evaluated on the server.
- [Editors](guides/editors.md): The language server in Neovim and Helix (file type, root markers, the server command), what works in Zed today, and GitHub highlighting through `.gitattributes`.
- [Web components](guides/web-components.md): Custom elements and web-component libraries: defining them in the browser, typing them in JSX, properties versus attributes (React 19's rule), events with `on:`, server rendering, and the Custom Elements Everywhere score (100).

## STSX

- [STSX](https://lumiose.dev/stsx/llms.txt): `.stsx` files outside Lumiose. `@lumiose/stsx` is a Vite plugin that compiles their scoped `<style>` blocks for React, React Router and Solid, with the same placement rules, `$name` constants and `scopedStyles` option. Its docs ship in its package: `node_modules/@lumiose/stsx/docs/llms.txt` indexes them.

## UI

- [UI components](https://lumiose.dev/ui/llms.txt): `@lumiose/ui`, accessible and unstyled primitives on native elements, server-rendered without hydration, with the optional default theme. Its docs ship in its own package and match its own version: `node_modules/@lumiose/ui/docs/llms.txt` indexes them, and in a project that depends on it `lumiose docs ui` and `lumiose docs dialog` print them and the MCP server's `ui_components` tool lists the components.

## Deploy

- [Overview](deploy/README.md): What `lumiose build` writes, the production settings (`PORT`, `HOST`, `ORIGIN`, `LUMIOSE_SECRET`) and how far each target's guide was verified.
- [Docker](deploy/docker.md): A multi-stage Dockerfile: `node:24-alpine`, production dependencies only, a non-root user and a health check.
- [VPS](deploy/vps.md): `@lumiose/adapter-node` under systemd or pm2, behind Caddy or nginx; what the adapter already does for compression and caching.
- [Coolify](deploy/coolify.md): Deploy from the Dockerfile with Coolify's Dockerfile build pack.
- [Cloudflare Workers](deploy/cloudflare.md): `@lumiose/adapter-cloudflare`: the Worker, static assets, bindings as `ctx.platform.env`.
- [Vercel](deploy/vercel.md): `@lumiose/adapter-vercel`: the Build Output API, with a Node.js or Edge function.
- [Netlify](deploy/netlify.md): `@lumiose/adapter-netlify`: the site and a Netlify Function.
- [Bun](deploy/bun.md): `bun dist/server/entry.js`, static files included.
- [Deno](deploy/deno.md): `deno serve dist/server/entry.js`, static files included.
- [Fly.io](deploy/fly.md): The Docker image on Fly Machines, behind Fly's proxy.
- [Render](deploy/render.md): A Node web service (or the Docker image), and static sites.
- [Railway](deploy/railway.md): The Node adapter with Railway's Node builder, or the Docker image.
- [Static hosts](deploy/static.md): A fully prerendered site on Cloudflare, Netlify, GitHub Pages, S3 with CloudFront or any file server.
- [AWS Lambda](deploy/aws-lambda.md): A handler from Lambda's events to the server build's `fetch`.

## Reference

- [`lumiose`: reactivity](reference/reactivity.md): `signal`, `computed`, `effect`, `batch`, `flush`, `untrack`, `store`, owners, context (`createContext`, `useContext`), `useId`, `getAbortSignal`, `isPending`, `isBusy`, `resource`.
- [`lumiose`: components](reference/components.md): `Suspense`, `ErrorBoundary`, `Portal`, `Dynamic`, `ref`, `Head`, `Title`, `Meta`, `ViewTransition`, `viewTransition`.
- [`lumiose`: app layer](reference/app.md): `fetchJSON`, `submit`, `isSubmitting`, `actionData`, `invalidate`, `fail`, `redirect`, `notFound`, `error`, `href`, request APIs and types.
- [`lumiose`: server rendering](reference/server.md): `renderToStream`, `renderToString` and the `lumiose/server` subpath.
- [`lumiose/dom`](reference/dom.md): `render`, the compiler-runtime contract, `hydrate` (`lumiose/dom/hydrate`) and the island loader (`lumiose/dom/loader`).
- [`lumiose/router`](reference/router.md): The SPA router: `Link`, `navigate`, `isNavigating`, `searchParams`, `beforeNavigate`/`afterNavigate` and reactive route state.
- [`@lumiose/vite`](reference/vite.md): The Vite plugin and its options.
- [JSX types and tsconfig](reference/jsx.md): `lumiose/jsx-runtime`, `lumiose/env` and the required `tsconfig.json`.
- [CLI](reference/cli.md): `lumiose dev`, `build`, `preview`, `check`, `typegen`, `routes`, `lint`, `fmt`, `docs`, `explain`, `agents init` and `mcp`; `--format json` and exit codes.
- [MCP server](reference/mcp.md): `lumiose mcp` for coding agents: docs, `check` with fixes, routes, components, compiler output, rendered HTML and dev logs.
- [`@lumiose/adapter-node`](reference/adapter-node.md): `createServer`, `createHandler` and `createStaticHandler`: serve a build with Node.
- [Server build](reference/server-entry.md): `dist/server/entry.js`: `export default { fetch(request, platform?) }`, `ctx.platform`, `createHandler` and `config`; run it with Bun or Deno.
- [`@lumiose/query`](reference/query.md): TanStack Query for Lumiose (`useQuery`, `useMutation`, `useQueryClient`, `QueryClientProvider`), and when to use it instead of `fetchJSON`.

## Diagnostics

- [All diagnostics](errors/README.md): Every `LUMxxxx` code with its explanation and fix.

## Status of this version

Lumiose is pre-1.0, so APIs may change in any minor version ([Stability](stability.md)). The docs describe the
designed API; where this version does not implement something yet, the page says so in a
**Status** note. In short:

| Area                                                                                  | Status                                                                      |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Signals, components, JSX compilation, client rendering (`lumiose/dom`)                | Available                                                                   |
| Async components, `<Suspense>`, `<ErrorBoundary>`                                     | Available                                                                   |
| Server rendering (`renderToStream`), shell-first streaming, head                      | Available                                                                   |
| File routes, typegen, request handler, middleware, actions, `fetchJSON`               | Available, with `lumiose dev`, `lumiose build` and `@lumiose/adapter-node`  |
| `<style>` blocks                                                                      | Available                                                                   |
| Islands hydration and the island loader                                               | Available                                                                   |
| SPA mode and the SPA router (`lumiose/router`)                                        | Available, with `lumiose dev` and `lumiose build`                           |
| `lumiose check`, `lint`, `fmt`, `docs`, `explain`, language server, VS Code extension | Available                                                                   |
| `lumiose mcp`                                                                         | Available                                                                   |
| `create-lumiose` (templates `minimal`, `static`, `ssr`, `spa`), `lumiose agents init` | Available                                                                   |
| Testing: Vitest, Testing Library and Playwright                                       | Available, with stock tools (no adapter package)                            |
| `@lumiose/ui`                                                                         | Available (0.x, its own versions; `create-lumiose --ui`, `lumiose docs ui`) |
