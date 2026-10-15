// @vitest-environment happy-dom
// `searchParams` of lumiose/router outside an SPA (decision-61): in islands of MPA pages `set()`
// loads the page, and with `{ shallow: true }` the query is URL state. Inside an SPA the router's
// own tests cover it (./router.test.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effect } from "../../core/index.ts";
import { searchParams } from "./index.ts";
import { resetSearch, setRouterSearch } from "./search.ts";

// User effects run after the current task.
const settled = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const shallow = { shallow: true };

beforeEach(() => {
  history.replaceState(null, "", "/products?q=shoes#top");
  resetSearch();
});

afterEach(() => {
  resetSearch();
  vi.restoreAllMocks();
});

describe("searchParams in islands of MPA pages", () => {
  it("reads the document's query", () => {
    expect(searchParams().get("q")).toBe("shoes");
  });

  it("set() loads the page with the new query, keeping the path and hash", async () => {
    const assign = vi.spyOn(location, "assign").mockImplementation(() => {});
    const replace = vi.spyOn(location, "replace").mockImplementation(() => {});
    await searchParams.set({ q: "hats", page: 2, sort: null, tag: ["a", "b"] });
    expect(assign).toHaveBeenCalledWith(
      `${location.origin}/products?q=hats&page=2&tag=a&tag=b#top`,
    );
    await searchParams.set({ q: "caps" }, { replace: true });
    expect(replace).toHaveBeenCalledWith(`${location.origin}/products?q=caps#top`);
    expect(location.search).toBe("?q=shoes");
  });

  it("set() with { shallow: true } adds a history entry and loads nothing", async () => {
    const assign = vi.spyOn(location, "assign");
    const entries = history.length;
    await searchParams.set({ q: "hats", page: 2, sort: null, tag: ["a", "b"] }, shallow);
    expect(location.pathname + location.search + location.hash).toBe(
      "/products?q=hats&page=2&tag=a&tag=b#top",
    );
    expect(history.length).toBe(entries + 1);
    expect(searchParams().get("q")).toBe("hats");
    expect(assign).not.toHaveBeenCalled();
  });

  it("a shallow set() replaces the entry with { replace: true }, or when the URL does not change", async () => {
    const entries = history.length;
    await searchParams.set("q=hats", { ...shallow, replace: true });
    expect(location.search).toBe("?q=hats");
    await searchParams.set({ q: "hats" }, shallow);
    expect(history.length).toBe(entries);
  });

  it("set() passes a copy of the current query to a function", async () => {
    const before = searchParams();
    await searchParams.set((current) => {
      current.append("page", "3");
      return current;
    }, shallow);
    expect(before.toString()).toBe("q=shoes");
    expect(location.search).toBe("?q=shoes&page=3");
  });

  it("is reactive, and shared by every reader", async () => {
    const seen: (string | null)[] = [];
    const other: (string | null)[] = [];
    const stop = effect(() => {
      seen.push(searchParams().get("q"));
    });
    const stopOther = effect(() => {
      other.push(searchParams().get("q"));
    });
    await settled();
    await searchParams.set({ q: "hats" }, shallow);
    await settled();
    await searchParams.set({ q: "hats" }, shallow);
    await settled();
    expect(seen).toEqual(["shoes", "hats"]);
    expect(other).toEqual(["shoes", "hats"]);
    stop();
    stopOther();
  });

  it("follows back/forward between shallow entries", async () => {
    const seen: (string | null)[] = [];
    const stop = effect(() => {
      seen.push(searchParams().get("q"));
    });
    await settled();
    await searchParams.set({ q: "hats" }, shallow);
    await settled();
    // What the browser does on back: the URL is the previous entry's, then `popstate`.
    history.replaceState(null, "", "/products?q=shoes#top");
    dispatchEvent(new PopStateEvent("popstate"));
    await settled();
    expect(seen).toEqual(["shoes", "hats", "shoes"]);
    stop();
  });
});

describe("searchParams inside an SPA", () => {
  it("reads and navigates through the router, with or without shallow", async () => {
    const set = vi.fn(() => Promise.resolve());
    setRouterSearch({ read: () => new URLSearchParams("q=spa"), set });
    const entries = history.length;
    expect(searchParams().get("q")).toBe("spa");
    await searchParams.set({ q: "next" }, { replace: true });
    expect(set).toHaveBeenCalledWith({ q: "next" }, { replace: true });
    await searchParams.set({ q: "other" }, shallow);
    expect(set).toHaveBeenCalledWith({ q: "other" }, shallow);
    expect(history.length).toBe(entries);
    expect(location.search).toBe("?q=shoes");
  });

  it("an island that read the query before the SPA started follows the router", async () => {
    const seen: (string | null)[] = [];
    const stop = effect(() => {
      seen.push(searchParams().get("q"));
    });
    await settled();
    setRouterSearch({ read: () => new URLSearchParams("q=spa"), set: () => Promise.resolve() });
    await settled();
    expect(seen).toEqual(["shoes", "spa"]);
    stop();
  });
});
