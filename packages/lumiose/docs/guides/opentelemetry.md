# Tracing with OpenTelemetry

> Trace requests, their phases and the browser's navigations with OpenTelemetry from `src/instrumentation.server.ts` and `src/instrumentation.client.ts`, and send them to OpenObserve, SigNoz or Datadog.

Lumiose has no tracing of its own: its instrumentation files hand every phase of a request, and
every client navigation, submission, fetch and hydration, to observers you write
([Server](../concepts/server.md#instrumentation), [Islands](../concepts/islands.md#concept)). This
guide makes those observers OpenTelemetry spans and exports them over OTLP, which every backend
below accepts.

| File                                     | Role                                                                         |
| ---------------------------------------- | ---------------------------------------------------------------------------- |
| `src/instrumentation.server.ts`          | Starts the Node SDK; a span per request and per phase; errors as spans.      |
| `src/instrumentation.client.ts`          | A browser tracer; spans for navigations, submissions, fetches and hydration. |
| `src/routes/api/otel/v1/traces/route.ts` | Relays the browser's spans to the backend with the server's credentials.     |

> **Status:** checked end to end on 2026-10-15 with a Lumiose app built with `lumiose build` and
> served by `lumiose preview`, against OpenObserve and self-hosted SigNoz 0.129 (its last Docker Compose release) in Docker (server spans
> nested by phase, failed requests, a continued `traceparent`, and browser navigation and
> hydration spans through the relay). The Datadog setup follows Datadog's documentation; it was not
> run. Packages: `@opentelemetry/api` 1.9, `@opentelemetry/sdk-node` and
> `@opentelemetry/exporter-trace-otlp-http` 0.223, `@opentelemetry/sdk-trace-web` 2.12.

## Setup

```sh
pnpm add @opentelemetry/api @opentelemetry/sdk-node @opentelemetry/exporter-trace-otlp-http
pnpm add @opentelemetry/sdk-trace-web @opentelemetry/sdk-trace-base @opentelemetry/resources @opentelemetry/semantic-conventions
```

The Node SDK runs where the server runs on Node: `lumiose dev`, `lumiose preview`,
`@lumiose/adapter-node` and the Docker and VPS targets. On Cloudflare Workers or Vercel's Edge
runtime, start that platform's OpenTelemetry integration in `register()` instead; the wrappers
below stay the same.

## Server spans

`register()` starts the SDK once per server instance, before the first request. The
`instrumentations` wrappers open a span per request (`SERVER` kind, named after the route
pattern, as OpenTelemetry's HTTP conventions ask) and a child span per phase: each middleware file,
the action, the endpoint, the render until the shell is ready, and each streamed boundary. The
SDK's context manager makes each phase's span a child of the one around it, so a trace shows the
request, then its middleware, then its render, then its streamed parts. A `traceparent` header
from a proxy or another service continues its trace. `onRequestError` records unexpected errors
with the phase and the `digest` that an `<ErrorBoundary>` fallback shows.

```ts check
// src/instrumentation.server.ts
import {
  ROOT_CONTEXT,
  SpanKind,
  SpanStatusCode,
  propagation,
  trace,
  type Span,
  type TextMapGetter,
} from "@opentelemetry/api";
import type { RequestErrorInfo, ServerInstrumentation } from "lumiose";

export async function register() {
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  // The endpoint and headers come from the OTEL_EXPORTER_OTLP_* variables (see the backends).
  new NodeSDK({ serviceName: "my-app", traceExporter: new OTLPTraceExporter() }).start();
}

const tracer = trace.getTracer("lumiose");

/** Reads a `traceparent` header, so a trace started by a proxy or another service continues. */
const headers: TextMapGetter<Headers> = {
  get: (carrier, key) => carrier.get(key) ?? undefined,
  keys: (carrier) => [...carrier.keys()],
};

type Result = { status: "success" } | { status: "error"; error: unknown };

/** Ends a phase's span: failed, with the exception, when the phase failed. */
function end(span: Span, result: Result): void {
  if (result.status === "error") {
    span.recordException(result.error instanceof Error ? result.error : String(result.error));
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
  span.end();
}

/** The endpoint that relays the browser's spans (below): no spans for the relay itself. */
const RELAY = "/api/otel/v1/traces";

/** A child span around one phase: `call()` runs it, inside the span. */
function phase(
  name: string,
  info: { route: string | undefined },
  attributes: Record<string, string>,
  call: () => Promise<Result>,
) {
  if (info.route === RELAY) return call();
  return tracer.startActiveSpan(name, { attributes }, async (span) => end(span, await call()));
}

export const instrumentations: ServerInstrumentation[] = [
  {
    request: (call, info) => {
      if (info.route === RELAY) return call();
      const parent = propagation.extract(ROOT_CONTEXT, info.request.headers, headers);
      const method = info.request.method;
      const name = info.route === undefined ? method : `${method} ${info.route}`;
      const attributes = {
        "http.request.method": method,
        "url.path": new URL(info.request.url).pathname,
        ...(info.route === undefined ? {} : { "http.route": info.route }),
      };
      return tracer.startActiveSpan(
        name,
        { kind: SpanKind.SERVER, attributes },
        parent,
        async (span) => {
          const result = await call();
          const status = result.status === "success" ? result.response?.status : undefined;
          if (status !== undefined) span.setAttribute("http.response.status_code", status);
          if (status !== undefined && status >= 500) span.setStatus({ code: SpanStatusCode.ERROR });
          end(span, result);
        },
      );
    },
    middleware: (call, info) => phase("middleware", info, { "code.file.path": info.file }, call),
    action: (call, info) => phase(`action ${info.name}`, info, {}, call),
    endpoint: (call, info) => phase(`${info.method} handler`, info, {}, call),
    render: (call, info) => phase("render", info, {}, call),
    stream: (call, info) => phase("stream", info, {}, call),
  },
];

/** Unexpected errors, as spans of their own with the phase and the digest users see. */
export function onRequestError(error: unknown, info: RequestErrorInfo) {
  const span = tracer.startSpan(`error ${info.phase}`, {
    attributes: {
      "http.route": info.route ?? "",
      "lumiose.phase": info.phase,
      "lumiose.digest": info.digest ?? "",
    },
  });
  end(span, { status: "error", error });
}
```

## Client spans

`src/instrumentation.client.ts` runs on every page before islands hydrate and before the SPA
router starts, so its tracer sees the first hydration. The `navigate` wrapper covers a client
navigation of an SPA until the new page is on screen; `submit`, `fetch` and `hydrate` cover form
submissions, `fetchJSON()` and `query()` requests, and each island. MPA pages have no client
navigations: their page loads are the server's `request` spans.

```ts check
// src/instrumentation.client.ts
import { SpanStatusCode, trace, type Span } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import type { ClientErrorInfo, ClientInstrumentation } from "lumiose";

const provider = new WebTracerProvider({
  resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: "my-app-browser" }),
  // The app's own endpoint forwards the spans with the server's credentials (below).
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: "/api/otel/v1/traces" }))],
});
provider.register();

const tracer = trace.getTracer("lumiose");

type Result = { status: "success" } | { status: "error"; error: unknown };

function end(span: Span, result: Result): void {
  if (result.status === "error") {
    span.recordException(result.error instanceof Error ? result.error : String(result.error));
    span.setStatus({ code: SpanStatusCode.ERROR });
  }
  span.end();
}

function phase(name: string, attributes: Record<string, string>, call: () => Promise<Result>) {
  return tracer.startActiveSpan(name, { attributes }, async (span) => end(span, await call()));
}

export const instrumentations: ClientInstrumentation[] = [
  {
    // A client navigation of an SPA, until the new page is on screen.
    navigate: (call, info) =>
      phase(
        `navigate ${info.to?.route ?? info.to?.url.pathname ?? ""}`,
        { "lumiose.navigation": info.type, "url.path": info.to?.url.pathname ?? "" },
        call,
      ),
    submit: (call, info) => phase(`submit ${info.action}`, { "url.full": info.url }, call),
    fetch: (call, info) =>
      phase(
        "fetch",
        "url" in info ? { "url.full": info.url } : { "lumiose.query": JSON.stringify(info.key) },
        call,
      ),
    hydrate: (call, info) => phase(`hydrate ${info.island}`, {}, call),
  },
];

export function onError(error: unknown, info: ClientErrorInfo) {
  const span = tracer.startSpan(`error ${info.phase}`, {
    attributes: { "lumiose.phase": info.phase, "lumiose.island": info.island ?? "" },
  });
  end(span, { status: "error", error });
}

// Spans are batched: send the last ones when the page goes away.
addEventListener("pagehide", () => void provider.forceFlush());
```

The web SDK adds about 58 kB of JavaScript (16 kB brotli) to every page, since every page loads
the file. The `@opentelemetry/api` calls in the wrappers do nothing until a provider is registered,
so a site that only needs a sample can load the SDK with `import()` for some page loads and leave
the rest without it.

## The relay endpoint

Backends need credentials that must not ship to the browser, and most do not accept cross-origin
requests. The browser exporter posts to the app instead, and this endpoint forwards the spans with
the same `OTEL_EXPORTER_OTLP_*` settings the server uses. The server instrumentation above skips
it, so relaying spans creates none. The body limit keeps it from relaying anything larger than a
batch of spans.

```ts check file=routes/api/otel/v1/traces/route.ts
// src/routes/api/otel/v1/traces/route.ts: the browser's spans, forwarded with the server's settings
import { env, type Endpoint } from "lumiose";

export const mode = "server";
// Spans come in batches; anything larger is not a span batch.
export const limits = { body: "256kb" };

/** `OTEL_EXPORTER_OTLP_HEADERS` (`key=value,…`, values URL-encoded), as OpenTelemetry reads it. */
function otlpHeaders(): Record<string, string> {
  const pairs = (env("OTEL_EXPORTER_OTLP_HEADERS") ?? "")
    .split(",")
    .filter((pair) => pair.includes("="));
  return Object.fromEntries(
    pairs.map((pair) => {
      const at = pair.indexOf("=");
      return [pair.slice(0, at).trim(), decodeURIComponent(pair.slice(at + 1).trim())];
    }),
  );
}

export const POST: Endpoint<"/api/otel/v1/traces"> = async ({ request }) => {
  const url =
    env("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT") ??
    `${env("OTEL_EXPORTER_OTLP_ENDPOINT") ?? "http://localhost:4318"}/v1/traces`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...otlpHeaders(),
      "content-type": request.headers.get("content-type") ?? "application/json",
    },
    body: await request.arrayBuffer(),
  });
  return new Response(null, { status: response.ok ? 204 : 502 });
};
```

## Backends

The server exporter and the relay read OpenTelemetry's standard variables:

| Variable                             | Use                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------- |
| `OTEL_EXPORTER_OTLP_ENDPOINT`        | The backend's OTLP/HTTP base URL; traces go to `<url>/v1/traces`.           |
| `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` | The full traces URL, when it is not `<base>/v1/traces`.                     |
| `OTEL_EXPORTER_OTLP_HEADERS`         | `key=value` pairs, comma-separated, values URL-encoded (`%20` for a space). |
| `OTEL_SERVICE_NAME`                  | Overrides `serviceName`.                                                    |

### OpenObserve

OpenObserve takes OTLP/HTTP at `/api/<organization>/v1/traces`, with HTTP Basic authentication
(the user's email and password, or an ingestion token from the UI):

```sh
OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=https://openobserve.example.com/api/default/v1/traces
OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic%20Og=="
```

Locally, OpenObserve runs in one container; its UI is at `http://localhost:5080`:

```sh
docker run -d -p 5080:5080 -e ZO_ROOT_USER_EMAIL=root@example.com -e ZO_ROOT_USER_PASSWORD=change-me \
  public.ecr.aws/zinclabs/openobserve:latest
```

### SigNoz

Self-hosted SigNoz receives OTLP/HTTP on port 4318, without authentication: keep that port on a
private network.

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://signoz-otel-collector:4318
```

SigNoz Cloud takes the region's ingestion URL and the ingestion key as a header:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=https://ingest.<region>.signoz.cloud:443
OTEL_EXPORTER_OTLP_HEADERS=signoz-ingestion-key=<your-ingestion-key>
```

SigNoz installs with its `foundryctl` tool ([SigNoz docs](https://signoz.io/docs/install/docker/));
the UI is at `http://localhost:8080`. On a fresh install the collector starts receiving once the
first user has signed up in the UI, which creates the organization.

### Datadog

The Datadog Agent receives OTLP once its receiver is enabled, and forwards to Datadog with the
Agent's API key, so the app needs no Datadog credentials. Enable the HTTP receiver on the Agent
(`DD_OTLP_CONFIG_RECEIVER_PROTOCOLS_HTTP_ENDPOINT=0.0.0.0:4318`, and expose the port), then point
the app at it:

```sh
OTEL_EXPORTER_OTLP_ENDPOINT=http://datadog-agent:4318
```

The spans appear in Datadog APM under the service name. For the browser, Datadog's own RUM SDK
started in `src/instrumentation.client.ts` is the usual choice; the relay above works too, through
the Agent.

## Common mistakes

- **Starting the SDK at module scope.** Start it in `register()`, which the server awaits before the
  first request; module code also runs while `lumiose build` loads the server.
- **Exporting from the browser straight to the backend.** The credentials would ship in the bundle,
  and the backend must allow the page's origin. Relay through the app.
- **High-cardinality span names.** Name spans after the route pattern (`GET /stories/[slug]`), not
  the URL; the URL goes in `url.path`.
- **Expecting spans for static files.** The server serves them before the app, so no wrapper sees
  them; prerendered pages are static files.
- **Changing the request in a wrapper.** Wrappers observe: they cannot change arguments, results or
  the response. Use middleware for that.
