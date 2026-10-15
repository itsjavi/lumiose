# Realtime: server-sent events and WebSockets

> Push live updates to the browser with server-sent events or WebSockets, with proxy configs and notes per platform.

**Server-sent events** (SSE) are a streamed `GET` response: the server pushes, the browser's
`EventSource` reads and reconnects by itself, and they pass through proxies and CDNs as plain HTTP.
Use them when updates flow from the server to the page (feeds, notifications, progress).
**WebSockets** carry messages both ways, and need a server that keeps connections open:
`@lumiose/adapter-node` on a VPS, in Docker or on Coolify.

Both are in the [ssr-realtime sample](https://github.com/itsjavi/lumiose/tree/main/examples/ssr-realtime),
with unit and e2e tests.

## Server-sent events

### The stream

An endpoint returns a `Response` whose body is a `ReadableStream` in the `text/event-stream` format.
This helper writes the events, sends a comment every 15 s so proxies keep an idle connection open,
and runs a cleanup exactly once when the stream ends:

```ts
// src/server/event-stream.server.ts
export type Send = (event: string, data: unknown, id?: string | number) => void;

export function eventStream(
  request: Request,
  start: (send: Send, close: () => void) => () => void,
  options: { keepAliveMs?: number; retryMs?: number } = {},
): Response {
  const encoder = new TextEncoder();
  let stopped = false;
  let cleanup: (() => void) | undefined;
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const write = (text: string) => {
    if (!stopped) controller.enqueue(encoder.encode(text));
  };
  const stop = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(keepAlive);
    request.signal.removeEventListener("abort", onAbort);
    cleanup?.();
  };
  const close = () => {
    if (stopped) return;
    stop();
    controller.close();
  };
  const onAbort = () => close();

  const body = new ReadableStream<Uint8Array>({
    start(streamController) {
      controller = streamController;
      write(`retry: ${options.retryMs ?? 3000}\n\n`); // the browser's reconnection delay
      keepAlive = setInterval(() => write(": keep-alive\n\n"), options.keepAliveMs ?? 15_000);
      const send: Send = (event, data, id) => {
        const lines = [`event: ${event}`];
        if (id !== undefined) lines.push(`id: ${id}`);
        lines.push(`data: ${JSON.stringify(data)}`); // JSON has no raw newlines: one data line
        write(`${lines.join("\n")}\n\n`);
      };
      cleanup = start(send, close);
      if (stopped) cleanup(); // closed by `start` itself
      else if (request.signal.aborted) close();
      else request.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-cache" },
  });
}
```

**Disconnects.** When the browser closes the connection (the tab closes, `EventSource.close()`),
the adapter aborts `request.signal` and cancels the body; either one runs the cleanup. Without
it, a closed tab would leave its subscription, timers and database listeners behind for good.

### The endpoint

```ts
// src/routes/api/events/route.ts
import type { Endpoint } from "lumiose";
import { subscribe } from "../../../server/bus.server.ts";
import { eventStream } from "../../../server/event-stream.server.ts";

export const mode = "server";

export const GET: Endpoint<"/api/events"> = ({ request }) =>
  eventStream(request, (send) =>
    // The unsubscribe is the stream's cleanup: it runs when the client goes away.
    subscribe((message) => send("message", message, message.id)),
  );
```

`subscribe` is the sample's in-process bus: a `Set` of listeners that a form action publishes to
(`publish(text)` calls each one). It reaches the clients of one process. With several (a cluster,
several containers, serverless instances), publish through a shared channel instead: Redis
pub/sub, Postgres `LISTEN`/`NOTIFY` or a hosted service.

### The island

```stsx
// src/islands/LiveFeed.stsx (shortened), used as <LiveFeed client:load />
import { onCleanup, onMount, signal } from "lumiose";
import type { Message } from "../lib/messages.ts";

export function LiveFeed() {
  const messages = signal<Message[]>([]);
  const state = signal<"connecting" | "open" | "reconnecting">("connecting");

  onMount(() => {
    const source = new EventSource("/api/events");
    source.addEventListener("open", () => state.set("open"));
    // EventSource reconnects by itself, after the stream's `retry:` delay.
    source.addEventListener("error", () => state.set("reconnecting"));
    source.addEventListener("message", (event) => {
      const message = JSON.parse(event.data) as Message;
      messages.update((list) => [...list.slice(-49), message]);
    });
    // Closing the source ends the request, and the server's cleanup unsubscribes.
    onCleanup(() => source.close());
  });

  return (
    <ol>
      {messages().map((message) => (
        <li key={message.id}>{message.text}</li>
      ))}
    </ol>
  );
}
```

`onMount` runs only in the browser, so the server render shows an empty list. The sample's island
also has a form that posts to the page's action with `submit()`: the page does not reload, so
the stream stays open.

**After a reconnect**, the browser sends the last `id:` it received as the `Last-Event-ID` request
header; an endpoint that keeps recent events can send the missed ones first. The sample does not.

**Compression.** The Node adapter compresses `text/event-stream` like any text response and
flushes the compressor whenever the stream pauses, so every event reaches the browser at once
(checked with brotli and gzip).

## WebSockets

Lumiose has no WebSocket API of its own. On Node, `createServer()` returns the `node:http` server,
and a WebSocket library attaches to its `upgrade` event. With [`ws`](https://github.com/websockets/ws):

```ts
// src/server/chat-socket.server.ts (shortened)
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";

const sockets = new WebSocketServer({ noServer: true, maxPayload: 2048 });

sockets.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const payload = JSON.stringify({ text: data.toString().slice(0, 500), at: new Date() });
    for (const client of sockets.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });
});

/** Upgrades requests to /ws and returns true; returns false for any other path. */
export function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  origin: string | undefined = process.env.ORIGIN,
): boolean {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname !== "/ws") return false;
  // Browsers send the page's origin with the handshake, and the same-origin policy does not apply
  // to WebSockets: refuse other sites (cross-site WebSocket hijacking).
  if (!sameSite(request, origin)) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    return true;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request));
  return true;
}

function sameSite(request: IncomingMessage, origin: string | undefined): boolean {
  const from = request.headers.origin;
  if (from === undefined) return true; // not a browser
  try {
    const host = origin === undefined ? request.headers.host : new URL(origin).host;
    return new URL(from).host === host;
  } catch {
    return false;
  }
}
```

One `server.ts` serves the app in dev and in production: [`createDevHandler()`](../reference/vite.md#createdevhandler)
mounts `lumiose dev` in it (HMR and the error overlay included), and `@lumiose/adapter-node`'s
`createHandler()` serves the build. The chat's upgrades attach to the same server in both:

```ts
// server.ts: `node server.ts --dev` in dev, `node server.ts` after `lumiose build`
import { createServer } from "node:http";
import { createHandler } from "@lumiose/adapter-node";
import { handleUpgrade } from "./src/server/chat-socket.server.ts";

const dev = process.argv.includes("--dev");
const server = createServer();
// @lumiose/vite is a dev dependency: production never loads it.
const handler = dev
  ? await (await import("@lumiose/vite/dev")).createDevHandler({ server })
  : await createHandler({ dir: new URL("dist", import.meta.url) });
server.on("request", handler);

server.on("upgrade", (request, socket, head) => {
  if (handleUpgrade(request, socket, head)) return;
  // Not the chat's path. In dev, Vite's hot reload upgrades on this server too: leave it alone.
  if (!dev) socket.destroy();
});
server.listen(Number(process.env.PORT ?? 3000));
```

In the browser, an island opens `new WebSocket(url)` in `onMount` (with `wss:` on an `https:` page)
and closes it in `onCleanup`, like the `EventSource` above.

**In dev**, run `node server.ts --dev` instead of `lumiose dev`: the WebSockets work as in
production, with no Vite plugin. `lumiose dev` and `lumiose preview` do not run `server.ts`, so
they have no WebSockets.

**Signing in.** The browser sends its cookies with the handshake: read the session from
`request.headers.cookie` before calling `handleUpgrade`, and refuse with `401` when it is missing.
Upgrades bypass Lumiose's middleware, which runs for HTTP requests only.

**Several processes** do not share `sockets.clients`: broadcast through a shared channel (Redis
pub/sub, for example), as with SSE. On `SIGTERM`, close the sockets (`client.close(1001)`) before
the server, as the sample's `server.ts` does.

## Behind a proxy

**Caddy** passes WebSocket upgrades and flushes streamed responses with the
[VPS guide's](../deploy/vps.md#caddy) `reverse_proxy` alone.

**nginx** needs a location that passes the upgrade on, next to the
[VPS guide's](../deploy/vps.md#nginx) `location /`, whose `proxy_buffering off` already sends each
event at once:

```nginx
    location /ws {
        proxy_pass http://my_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        # nginx closes a connection that stays quiet for proxy_read_timeout (60 s by default).
        proxy_read_timeout 1h;
    }
```

An event stream stays open past nginx's 60 s `proxy_read_timeout` thanks to the keep-alive
comments (checked for 75 s through nginx and Caddy). A WebSocket that may stay quiet longer needs the longer timeout above, or pings.

## Platforms

| Target                                                                                                | Server-sent events                                                                                                                                                                         | WebSockets                                                                                                                                                                                                                                                                                        |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node adapter: [VPS](../deploy/vps.md), [Docker](../deploy/docker.md), [Coolify](../deploy/coolify.md) | Tested (the sample's e2e).                                                                                                                                                                 | Tested: `ws` on `createServer().server`'s `upgrade` event.                                                                                                                                                                                                                                        |
| [Cloudflare Workers](../deploy/cloudflare.md)                                                         | A Worker can stream a response. Requests may run in different isolates, so to reach every client, publish through a Durable Object. Not tested with Lumiose.                               | Workers accept WebSockets with `WebSocketPair`; a Durable Object holds them for a room (with the WebSocket Hibernation API, idle sockets do not keep it running). Bind it in `wrangler.jsonc` and reach it through `ctx.platform.env`, or route `/ws` to its own Worker. Not tested with Lumiose. |
| [Vercel](../deploy/vercel.md), [Netlify](../deploy/netlify.md)                                        | A streaming function holds the connection until its maximum duration, then `EventSource` reconnects. Instances share no memory: publish through a hosted channel. Not tested with Lumiose. | Serverless functions cannot keep a WebSocket open. Use a hosted realtime service (Ably, Pusher, PartyKit, Supabase Realtime, Liveblocks, …) and connect islands to it directly.                                                                                                                   |

## Common mistakes

- **No cleanup on disconnect.** A stream that ignores `request.signal` and `cancel()` keeps its
  subscription and timers after the tab closes, for every visitor who ever came.
- **Reloading the page to post.** A plain form post reloads the page and reopens the stream; post
  with `submit()` from the island.
- **Opening the `EventSource` or `WebSocket` during render.** Islands also render on the server; open
  them in `onMount`.
- **Accepting any `Origin` on the WebSocket handshake.** Another site's page could open a socket
  with your visitor's cookies. Compare the origin, as `handleUpgrade` does.
- **Expecting `lumiose dev` or `lumiose preview` to serve WebSockets.** They do not run
  `server.ts`: run `node server.ts --dev`, or `node server.ts` after a build.
- **Destroying unknown upgrades in dev.** Vite's hot reload upgrades on the same server; destroy
  only in production, or leave upgrades you do not handle alone.
- **An in-memory bus with several processes.** Each process only reaches its own clients.

See also: [Data and actions](../concepts/data-and-actions.md) (endpoints, `submit()`),
[Islands](../concepts/islands.md), [`@lumiose/adapter-node`](../reference/adapter-node.md),
[Deploy](../deploy/README.md).
