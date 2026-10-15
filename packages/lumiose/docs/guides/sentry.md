# Error reporting with Sentry

> Report server errors from `onRequestError` and browser errors from `onError` to Sentry, with source maps for the client and the server bundles.

Sentry has no Lumiose SDK, and needs none: `@sentry/node` starts in
`src/instrumentation.server.ts` and receives every unexpected error of a request, and
`@sentry/browser` starts in `src/instrumentation.client.ts`, before any island hydrates, and
receives the errors of islands, the SPA router and `submit()`
([Server](../concepts/server.md#instrumentation), [Islands](../concepts/islands.md#concept)).
Sentry's Vite plugin uploads the source maps of both builds.

| File                            | Role                                                                   |
| ------------------------------- | ---------------------------------------------------------------------- |
| `vite.config.ts`                | Hidden source maps, uploaded to Sentry after each build, then deleted. |
| `src/instrumentation.server.ts` | Starts `@sentry/node`; reports request errors with their phase.        |
| `src/instrumentation.client.ts` | Starts `@sentry/browser`; reports island, router and submit errors.    |

> **Status:** checked on 2026-10-15 with a Lumiose app built with `lumiose build` and served by
> `lumiose preview`, against a local stand-in for Sentry's ingest endpoint: a server render error
> and an island error each arrived as one event with the tags below and debug IDs for the source
> maps, and the build wrote hidden source maps for the client and the server. Not run against a
> Sentry account (no upload of the maps). Packages: `@sentry/node` and `@sentry/browser` 10.76,
> `@sentry/vite-plugin` 5.4.

## Setup

```sh
pnpm add @sentry/node @sentry/browser
pnpm add -D @sentry/vite-plugin
```

| Variable                       | Where                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                   | The server, at run time.                                                              |
| `PUBLIC_SENTRY_DSN`            | The build, for the browser bundle (`import.meta.env` only sees `PUBLIC_*` variables). |
| `SENTRY_AUTH_TOKEN`            | The build, to upload source maps. A secret: never a `PUBLIC_*` variable.              |
| `SENTRY_ORG`, `SENTRY_PROJECT` | The build, with the token.                                                            |

A DSN is not a secret (it only lets clients send events), so the same one may serve both sides.

## Source maps

`build.sourcemap: "hidden"` writes a map next to every bundle of both builds without the
`//# sourceMappingURL` comment, so browsers do not fetch them. The plugin, last in the list, runs
after the client build and after the server build: it adds a debug ID to each bundle and its map,
uploads the maps, and deletes them so they are not deployed. Without `SENTRY_AUTH_TOKEN` (on a
laptop) it builds as usual, warns, and uploads nothing.

```ts check
// vite.config.ts
import lumiose from "@lumiose/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  // Source maps for Sentry only: "hidden" leaves out the //# sourceMappingURL comment.
  build: { sourcemap: "hidden" },
  plugins: [
    lumiose({ mode: "server" }),
    // Last: uploads the client's and the server's source maps after each build, then deletes them.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: { filesToDeleteAfterUpload: ["dist/**/*.map"] },
    }),
  ],
});
```

## Server errors

`register()` starts the SDK once per server instance, before the first request.
`onRequestError` receives what the request handler catches and Sentry's own Node integrations do
not see: errors that render the `error` page or answer 500, errors of streamed `<Suspense>`
boundaries, rejected `waitUntil()` work and errors an `<ErrorBoundary>` caught, each with the
phase it happened in. `redirect()`, `notFound()` and `error(status)` are not reported.

```ts check
// src/instrumentation.server.ts
import * as Sentry from "@sentry/node";
import { env, type RequestErrorInfo } from "lumiose";

export function register() {
  Sentry.init({
    dsn: env("SENTRY_DSN"),
    environment: env("SENTRY_ENVIRONMENT") ?? "production",
    // Errors only; tracing is in the OpenTelemetry guide.
    tracesSampleRate: 0,
  });
}

export function onRequestError(error: unknown, info: RequestErrorInfo) {
  Sentry.captureException(error, {
    tags: { phase: info.phase, route: info.route ?? "(none)" },
    extra: { url: info.request.url, method: info.request.method, digest: info.digest },
  });
}
```

The `digest` is what an `<ErrorBoundary>` fallback shows in production: a user who quotes it
leads you to the event. Sentry's Node SDK also sets up OpenTelemetry for its own tracing; to keep
the [OpenTelemetry guide](opentelemetry.md)'s setup as well, follow Sentry's instructions for an
existing OpenTelemetry setup (`skipOpenTelemetrySetup`).

## Browser errors

The file's top-level code runs before any island hydrates, so the SDK is ready for hydration
errors. `onError` receives what Lumiose catches: an island that fails to load or hydrate
(`"hydrate"`), an async component or an `<ErrorBoundary>` (`"render"`), an effect or binding
(`"effect"`), the SPA router (`"navigate"`) and `submit()` (`"submit"`), with the island's
module and export. Sentry's own handlers still catch everything else on the page.

```ts check
// src/instrumentation.client.ts
import * as Sentry from "@sentry/browser";
import type { ClientErrorInfo } from "lumiose";

Sentry.init({
  dsn: import.meta.env.PUBLIC_SENTRY_DSN,
  environment: import.meta.env.PROD ? "production" : "development",
});

export function onError(error: unknown, info: ClientErrorInfo) {
  Sentry.captureException(error, {
    tags: { phase: info.phase, route: info.route ?? "(mpa)", island: info.island ?? "(none)" },
  });
}
```

## Production

- On serverless hosts the function may stop before the SDK sends: call
  `ctx.platform.waitUntil(Sentry.flush(2000))` after reporting, or follow Sentry's guide for the
  platform.
- With `lumiose({ csp: "strict" })`, the browser SDK posts events with `fetch`, which the
  strict policy does not restrict (it sets `script-src` and `style-src`, not `connect-src`).
- Set `release` in both `init` calls, or let the plugin inject it from the Git commit, so
  events and source maps match.

## Common mistakes

- **Starting the server SDK at module scope.** Start it in `register()`, which the server awaits
  before the first request.
- **Reporting from middleware with `try`/`catch` around `next()`.** Render errors, streamed
  boundaries and endpoint 500s never reach it; `onRequestError` gets them.
- **`SENTRY_DSN` in browser code.** It is undefined there; the browser bundle reads
  `import.meta.env.PUBLIC_SENTRY_DSN` at build time.
- **Deploying the source maps.** Keep `filesToDeleteAfterUpload`, or anyone can read the original
  source.
- **The plugin before `lumiose()`.** Put it last, so it sees the final bundles.
