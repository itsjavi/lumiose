// Server build of lumiose (node condition): effects never run, so queries do not fetch.
import { QueryClient } from "@tanstack/query-core";
import { renderToString } from "lumiose";
import { describe, expect, it, vi } from "vitest";
import { QueryClientProvider, useQuery } from "./index.ts";

describe("server render", () => {
  it("returns the pending state without fetching", async () => {
    const client = new QueryClient();
    const mount = vi.spyOn(client, "mount");
    const queryFn = vi.fn(async () => "value");
    const html = await renderToString(() =>
      QueryClientProvider({
        client,
        children: () => {
          const query = useQuery(() => ({ queryKey: ["ssr"], queryFn }));
          return `${query.status}:${String(query.data)}`;
        },
      }),
    );
    expect(html).toContain("pending:undefined");
    expect(queryFn).not.toHaveBeenCalled();
    expect(mount).not.toHaveBeenCalled();
  });

  it("renders data already in the cache", async () => {
    const client = new QueryClient();
    client.setQueryData(["ssr"], { title: "Cached" });
    const html = await renderToString(() =>
      QueryClientProvider({
        client,
        children: () => {
          const query = useQuery(() => ({
            queryKey: ["ssr"],
            queryFn: async () => ({ title: "Fetched" }),
          }));
          return query.data?.title;
        },
      }),
    );
    expect(html).toContain("Cached");
  });
});
