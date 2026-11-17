# Error reporting with Sentry

> Report server errors from `onRequestError` and browser errors from `onError` to Sentry, with source maps for the client and the server bundles.

## 1. Install

```sh
pnpm add @sentry/node @sentry/browser
pnpm add -D @sentry/vite-plugin
```

Sentry has no Lumiose SDK, and needs none: `@sentry/node` and `@sentry/browser` start in the two
instrumentation files, and Sentry's Vite plugin uploads the source maps of both builds.

| Variable                       | Where                                                                                 |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `SENTRY_DSN`                   | The server, at run time.                                                              |
| `PUBLIC_SENTRY_DSN`            | The build, for the browser bundle (`import.meta.env` only sees `PUBLIC_*` variables). |
| `SENTRY_AUTH_TOKEN`            | The build, to upload source maps. A secret: never a `PUBLIC_*` variable.              |
| `SENTRY_ORG`, `SENTRY_PROJECT` | The build, with the token.                                                            |

A DSN is not a secret (it only lets clients send events), so the same one may serve both sides.

## 2. Upload source maps

```ts check
// vite.config.ts
import lumiose from "@lumiose/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  // "hidden": maps without the sourceMappingURL comment.
  build: { sourcemap: "hidden" },
  plugins: [
    lumiose({ mode: "server" }),
    // Last, so it sees the final bundles.
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      sourcemaps: {
        filesToDeleteAfterUpload: ["dist/**/*.map"],
      },
    }),
  ],
});
```

`build.sourcemap: "hidden"` writes a map next to every bundle of both builds without the
`//# sourceMappingURL` comment, so browsers do not fetch them. The plugin runs after the client
build and after the server build: it adds a debug ID to each bundle and its map, uploads the maps,
and deletes them so they are not deployed. Without `SENTRY_AUTH_TOKEN` (on a laptop) it builds as
usual, warns, and uploads nothing.

## 3. Report server errors

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
    extra: {
      url: info.request.url,
      method: info.request.method,
      digest: info.digest,
    },
  });
}
```

`register()` starts the SDK once per server instance, before the first request.
`onRequestError` receives what the request handler catches and Sentry's own Node integrations do
not see, each with the phase it happened in: errors that render the `error` page or answer 500,
errors of streamed `<Suspense>` boundaries, rejected `waitUntil()` work and errors an
`<ErrorBoundary>` caught. `redirect()`, `notFound()` and `error(status)` are not reported
([Instrumentation](../concepts/server.md#instrumentation)).

> **Digest:** the `digest` is what an `<ErrorBoundary>` fallback shows in production: a user who
> quotes it leads you to the event.

## 4. Report browser errors

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
    tags: {
      phase: info.phase,
      route: info.route ?? "(mpa)",
      island: info.island ?? "(none)",
    },
  });
}
```

The file's top-level code runs before any island hydrates, so the SDK is ready for hydration
errors ([Islands](../concepts/islands.md#concept)). `onError` receives what Lumiose catches, with
the island's module and export. Sentry's own handlers still catch everything else on the page.

| `info.phase` | What failed                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------ |
| `"hydrate"`  | An island that fails to load or hydrate, or an event held until it hydrated that throws when replayed. |
| `"render"`   | An async component or an `<ErrorBoundary>`.                                                            |
| `"effect"`   | An effect or binding.                                                                                  |
| `"navigate"` | The SPA router.                                                                                        |
| `"submit"`   | `submit()`.                                                                                            |

## Production

- On serverless hosts the function may stop before the SDK sends: call
  `ctx.platform.waitUntil(Sentry.flush(2000))` after reporting, or follow Sentry's guide for the
  platform.
- With `lumiose({ csp: "strict" })`, the browser SDK posts events with `fetch`, which the
  strict policy does not restrict (it sets `script-src` and `style-src`, not `connect-src`).
- Set `release` in both `init` calls, or let the plugin inject it from the Git commit, so
  events and source maps match.
- Sentry's Node SDK also sets up OpenTelemetry for its own tracing; to keep the
  [OpenTelemetry guide](opentelemetry.md)'s setup as well, follow Sentry's instructions for an
  existing OpenTelemetry setup (`skipOpenTelemetrySetup`).

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

> **Status:** checked on 2026-10-15 with a Lumiose app built with `lumiose build` and served by
> `lumiose preview`, against a local stand-in for Sentry's ingest endpoint: a server render error
> and an island error each arrived as one event with the tags of steps 3 and 4 and debug IDs for
> the source maps, and the build wrote hidden source maps for the client and the server. Not run
> against a Sentry account (no upload of the maps). Packages: `@sentry/node` and `@sentry/browser`
> 10.76, `@sentry/vite-plugin` 5.4.
