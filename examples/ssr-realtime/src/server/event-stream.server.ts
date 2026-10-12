// A `text/event-stream` response for an endpoint (server-sent events). `start` receives `send` and
// returns a cleanup, which runs exactly once: when the client disconnects (the request's signal
// aborts), when the stream is cancelled, or when the endpoint calls `close`.

export type Send = (event: string, data: unknown, id?: string | number) => void;

export interface EventStreamOptions {
  /** A comment line this often keeps proxies from closing an idle connection. Default 15 s. */
  keepAliveMs?: number;
  /** How long the browser waits before reconnecting. Default 3 s. */
  retryMs?: number;
}

export function eventStream(
  request: Request,
  start: (send: Send, close: () => void) => () => void,
  options: EventStreamOptions = {},
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
      write(`retry: ${options.retryMs ?? 3000}\n\n`);
      keepAlive = setInterval(() => write(": keep-alive\n\n"), options.keepAliveMs ?? 15_000);
      const send: Send = (event, data, id) => {
        const lines = [`event: ${event}`];
        if (id !== undefined) lines.push(`id: ${id}`);
        // JSON has no raw newlines, so the data is one `data:` line.
        lines.push(`data: ${JSON.stringify(data)}`);
        write(`${lines.join("\n")}\n\n`);
      };
      cleanup = start(send, close);
      // Closed by `start` itself: its cleanup arrived after `stop` ran.
      if (stopped) cleanup();
      else if (request.signal.aborted) close();
      else request.signal.addEventListener("abort", onAbort, { once: true });
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
    },
  });
}
