# Lumen docs

> Lumen is a TypeScript 7-first web framework: `.stsx` components (TSX plus raw-CSS `<style>` blocks), setup-once components with signals, and server-first rendering with islands.

These docs ship inside the package, so they always match the installed version. Read them from
`node_modules/lumen/docs`, or from the terminal:

```sh
lumen docs                    # this index
lumen docs signals            # a topic, by name or path (concepts/signals)
lumen docs "bind:value"       # search, when no topic matches
lumen explain LUM2001         # the long-form explanation of a diagnostic
lumen docs signals --format json
```

Every concept page has the same sections, in order: **Concept**, **API**, **Example**, **Common
mistakes** and **Related diagnostics**. Reference pages list every export with its signature.

## Start here

- [Getting started](getting-started.md): Create a project, configure TypeScript and Vite, and render a first component.

## Concepts

- [Components](concepts/components.md): Setup-once function components, props, children, refs and the `.stsx`/`.tsx`/`.ts` file types.
- [Signals and reactivity](concepts/signals.md): `signal`, `computed`, `effect`, `store`, owners, context and scheduling.
- [JSX](concepts/jsx.md): Bindings, compiled idioms (`.map`, ternaries), `class`, `style`, events, `bind:`, `attach` and `ref`.
- [Styles](concepts/styles.md): Raw-CSS `<style>` blocks scoped by placement, `<style global>`, JS values in styles (`$name`), build-time math and runtime values.
- [Async components](concepts/async.md): `async` components on server and client, `<Suspense>`, `<ErrorBoundary>`, re-runs and in-flight state.
- [Islands](concepts/islands.md): `client:*` directives, serializable props, slots and server-only boundaries.
- [Routing](concepts/routing.md): File routes, layouts, params, typed `href()`, error pages and the SPA router.
- [Data and actions](concepts/data-and-actions.md): Read data with async components, serve endpoints, mutate with form actions and `submit()`.
- [Server](concepts/server.md): Request context, middleware, cookies, env, redirects and error helpers.
- [Rendering modes](concepts/rendering-modes.md): `static`, `server` and `spa` routes, shell-first streaming, hydration and the build.
- [Head and document](concepts/head.md): `<Title>`, `<Meta>`, `<Head>` and a custom `document.stsx`.
- [Compiler and diagnostics](concepts/compiler.md): What the compiler does with `.stsx`/`.tsx`, and how `LUMxxxx` diagnostics work.
- [Testing](concepts/testing.md): Test components with Vitest and the Lumen Vite plugin.

## Reference

- [`lumen`: reactivity](reference/reactivity.md): `signal`, `computed`, `effect`, `batch`, `flushSync`, `untrack`, `store`, owners, context, `pending`, `busy`, `resource`.
- [`lumen`: components](reference/components.md): `Suspense`, `ErrorBoundary`, `Portal`, `Dynamic`, `ref`, `Head`, `Title`, `Meta`.
- [`lumen`: app layer](reference/app.md): `fetchJSON`, `submit`, `submitting`, `actionData`, `invalidate`, `fail`, `redirect`, `notFound`, `error`, `href`, request APIs and types.
- [`lumen`: server rendering](reference/server.md): `renderToStream`, `renderToString` and the `lumen/server` subpath.
- [`lumen/dom`](reference/dom.md): `mount` and the compiler-runtime contract.
- [`lumen/router`](reference/router.md): The SPA router: `Link`, `navigate`, `navigating` and reactive route state.
- [`lumen/vite`](reference/vite.md): The Vite plugin and its options.
- [JSX types and tsconfig](reference/jsx.md): `lumen/jsx-runtime`, `lumen/env` and the required `tsconfig.json`.
- [CLI](reference/cli.md): `lumen dev`, `build`, `preview`, `check`, `typegen`, `routes`, `lint`, `fmt`, `docs` and `explain`; `--format json` and exit codes.

## Diagnostics

- [All diagnostics](errors/README.md): Every `LUMxxxx` code with its explanation and fix.

## Status of this version

Lumen is pre-release (`0.0.0`). The docs describe the designed API; where this version does not
implement something yet, the page says so in a **Status** note. In short:

| Area                                                                                | Status                                                               |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Signals, components, JSX compilation, client rendering (`lumen/dom`)                | Available                                                            |
| Async components, `<Suspense>`, `<ErrorBoundary>`                                   | Available                                                            |
| Server rendering (`renderToStream`), shell-first streaming, head                    | Available                                                            |
| File routes, typegen, request handler, middleware, actions, `fetchJSON`             | Available, with `lumen dev`, `lumen build` and `@lumen/adapter-node` |
| `<style>` blocks                                                                    | Available                                                            |
| Islands hydration and the island loader                                             | Available                                                            |
| SPA router (`lumen/router`)                                                         | Planned                                                              |
| `lumen check`, `lint`, `fmt`, `docs`, `explain`, language server, VS Code extension | Available                                                            |
| `create-lumen`, `@lumen/testing`, `lumen mcp`                                       | Planned                                                              |
