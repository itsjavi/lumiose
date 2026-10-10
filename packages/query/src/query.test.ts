// @vitest-environment happy-dom
import { QueryClient } from "@tanstack/query-core";
import { computed, effect, flush, signal } from "lumiose";
import { createComponent, render } from "lumiose/dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "./index.ts";

interface Book {
  id: number;
  title: string;
}

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

/** Renders `setup` inside a QueryClientProvider; returns what it returned. */
function mount<T>(client: QueryClient, setup: () => T): T {
  let value!: T;
  dispose = render(
    () =>
      createComponent(QueryClientProvider, {
        client,
        get children() {
          return createComponent(() => {
            value = setup();
            return null;
          }, {});
        },
      }),
    document.createElement("div"),
  );
  flush();
  return value;
}

/** Waits for query-core's notifications (scheduled with setTimeout) and the effects they cause. */
async function settle(): Promise<void> {
  for (let i = 0; i < 3; i++) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    flush();
  }
}

function newClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

describe("useQuery", () => {
  it("fetches once mounted and writes the result into a store", async () => {
    const client = newClient();
    const query = mount(client, () =>
      useQuery(() => ({ queryKey: ["books"], queryFn: async () => [{ id: 1, title: "A" }] })),
    );
    expect(query.isPending).toBe(true);
    await settle();
    expect(query.isSuccess).toBe(true);
    expect(query.data).toEqual([{ id: 1, title: "A" }]);
  });

  it("dedupes: two queries with the same key fetch once", async () => {
    const client = newClient();
    const queryFn = vi.fn(async () => "value");
    const [a, b] = mount(client, () => [
      useQuery(() => ({ queryKey: ["same"], queryFn })),
      useQuery(() => ({ queryKey: ["same"], queryFn })),
    ]);
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(a!.data).toBe("value");
    expect(b!.data).toBe("value");
  });

  it("refetches when invalidated", async () => {
    const client = newClient();
    let n = 0;
    const query = mount(client, () =>
      useQuery(() => ({ queryKey: ["count"], queryFn: async () => ++n })),
    );
    await settle();
    expect(query.data).toBe(1);
    await client.invalidateQueries({ queryKey: ["count"] });
    await settle();
    expect(query.data).toBe(2);
  });

  it("follows a reactive key", async () => {
    const client = newClient();
    const id = signal(1);
    const queryFn = vi.fn(async ({ queryKey }: { queryKey: readonly unknown[] }) => ({
      id: queryKey[1] as number,
      title: `Book ${String(queryKey[1])}`,
    }));
    const query = mount(client, () => useQuery(() => ({ queryKey: ["book", id()], queryFn })));
    await settle();
    expect(query.data?.title).toBe("Book 1");
    id.set(2);
    flush();
    expect(query.isPending).toBe(true);
    await settle();
    expect(query.data?.title).toBe("Book 2");
    expect(queryFn).toHaveBeenCalledTimes(2);
  });

  it("keeps the identity of unchanged items and notifies only what changed", async () => {
    const client = newClient();
    let books: Book[] = [
      { id: 1, title: "A" },
      { id: 2, title: "B" },
    ];
    let query!: UseQueryResult<Book[]>;
    const runs = { first: 0, second: 0 };
    mount(client, () => {
      query = useQuery(() => ({ queryKey: ["books"], queryFn: async () => books }));
      effect(() => {
        void query.data?.[0]?.title;
        runs.first++;
      });
      effect(() => {
        void query.data?.[1]?.title;
        runs.second++;
      });
    });
    await settle();
    const first = query.data![0];
    const before = { ...runs };
    books = [
      { id: 1, title: "A" },
      { id: 2, title: "B, revised" },
    ];
    await client.invalidateQueries({ queryKey: ["books"] });
    await settle();
    expect(query.data![0]).toBe(first);
    expect(query.data![1]!.title).toBe("B, revised");
    expect(runs.first).toBe(before.first);
    expect(runs.second).toBe(before.second + 1);
    // The store holds a copy: writes to it do not reach the cache.
    expect(client.getQueryData<Book[]>(["books"])![0]).not.toBe(first);
  });

  it("stops updating and unsubscribes when its owner is disposed", async () => {
    const client = newClient();
    let n = 0;
    const query = mount(client, () =>
      useQuery(() => ({ queryKey: ["n"], queryFn: async () => ++n })),
    );
    await settle();
    expect(query.data).toBe(1);
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ["n"] })!
        .getObserversCount(),
    ).toBe(1);
    dispose!();
    dispose = undefined;
    expect(
      client
        .getQueryCache()
        .find({ queryKey: ["n"] })!
        .getObserversCount(),
    ).toBe(0);
    client.setQueryData(["n"], 99);
    await settle();
    expect(query.data).toBe(1);
  });

  it("does not track what queryFn reads", async () => {
    const client = newClient();
    const other = signal(0);
    const queryFn = vi.fn(async () => other());
    mount(client, () => useQuery(() => ({ queryKey: ["untracked"], queryFn })));
    await settle();
    other.set(1);
    await settle();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });
});

describe("useMutation", () => {
  it("runs mutationFn, exposes its state and invalidates in onSuccess", async () => {
    const client = newClient();
    const saved: string[] = [];
    let query!: UseQueryResult<string[]>;
    let mutation!: UseMutationResult<string, Error, string>;
    mount(client, () => {
      const queryClient = useQueryClient();
      query = useQuery(() => ({ queryKey: ["titles"], queryFn: async () => [...saved] }));
      mutation = useMutation(() => ({
        mutationFn: async (title: string) => {
          saved.push(title);
          return title;
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["titles"] }),
      }));
    });
    await settle();
    expect(query.data).toEqual([]);
    expect(mutation.isIdle).toBe(true);
    const pending = computed(() => mutation.isPending);
    mutation.mutate("New");
    await settle();
    expect(mutation.isSuccess).toBe(true);
    expect(mutation.data).toBe("New");
    expect(pending()).toBe(false);
    expect(query.data).toEqual(["New"]);
    await expect(mutation.mutateAsync("Next")).resolves.toBe("Next");
  });

  it("reports errors through the result, not a rejection of mutate", async () => {
    const client = newClient();
    const mutation = mount(client, () =>
      useMutation(() => ({
        mutationFn: async () => {
          throw new Error("nope");
        },
      })),
    );
    mutation.mutate();
    await settle();
    expect(mutation.isError).toBe(true);
    expect(mutation.error?.message).toBe("nope");
  });
});

describe("QueryClientProvider", () => {
  it("mounts the client and unmounts it on disposal", () => {
    const client = newClient();
    const mountSpy = vi.spyOn(client, "mount");
    const unmountSpy = vi.spyOn(client, "unmount");
    mount(client, () => null);
    expect(mountSpy).toHaveBeenCalledTimes(1);
    dispose!();
    dispose = undefined;
    expect(unmountSpy).toHaveBeenCalledTimes(1);
  });

  it("useQueryClient throws without a provider or a client", () => {
    expect(() => useQueryClient()).toThrow(/No QueryClient set/);
    const client = newClient();
    expect(useQueryClient(client)).toBe(client);
  });
});
