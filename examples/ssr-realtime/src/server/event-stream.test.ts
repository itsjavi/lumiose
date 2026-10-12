import { describe, expect, it, vi } from "vitest";
import { eventStream } from "./event-stream.server.ts";

const decoder = new TextDecoder();

async function next(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  return decoder.decode(value);
}

describe("eventStream", () => {
  it("streams events as they are sent", async () => {
    let send!: (event: string, data: unknown, id?: number) => void;
    const response = eventStream(new Request("http://localhost/events"), (s) => {
      send = s;
      return () => {};
    });
    expect(response.headers.get("content-type")).toBe("text/event-stream; charset=utf-8");
    const reader = response.body!.getReader();
    expect(await next(reader)).toBe("retry: 3000\n\n");
    send("message", { text: "hi" }, 7);
    expect(await next(reader)).toBe('event: message\nid: 7\ndata: {"text":"hi"}\n\n');
  });

  it("cleans up once when the client disconnects", async () => {
    const controller = new AbortController();
    const cleanup = vi.fn();
    const response = eventStream(
      new Request("http://localhost/events", { signal: controller.signal }),
      () => cleanup,
    );
    const reader = response.body!.getReader();
    await next(reader);
    controller.abort();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(await reader.read()).toEqual({ done: true, value: undefined });
    await reader.cancel();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up when the consumer cancels the stream", async () => {
    const cleanup = vi.fn();
    const response = eventStream(new Request("http://localhost/events"), () => cleanup);
    await response.body!.cancel();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("ends the stream when the endpoint closes it", async () => {
    const cleanup = vi.fn();
    const response = eventStream(new Request("http://localhost/events"), (send, close) => {
      queueMicrotask(() => {
        send("done", null);
        close();
      });
      return cleanup;
    });
    const text = await response.text();
    expect(text).toBe("retry: 3000\n\nevent: done\ndata: null\n\n");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("cleans up when the endpoint closes the stream while starting", async () => {
    const cleanup = vi.fn();
    const response = eventStream(new Request("http://localhost/events"), (_send, close) => {
      close();
      return cleanup;
    });
    expect(await response.text()).toBe("retry: 3000\n\n");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("sends keep-alive comments while idle", async () => {
    vi.useFakeTimers();
    try {
      const response = eventStream(new Request("http://localhost/events"), () => () => {}, {
        keepAliveMs: 1000,
      });
      const reader = response.body!.getReader();
      await next(reader);
      vi.advanceTimersByTime(1000);
      expect(await next(reader)).toBe(": keep-alive\n\n");
      await reader.cancel();
    } finally {
      vi.useRealTimers();
    }
  });
});
