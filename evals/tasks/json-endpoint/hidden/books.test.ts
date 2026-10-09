import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, startDev } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

const ids = async (path: string) => {
  const response = await dev.get(path);
  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toMatch(/application\/json/);
  return ((await response.json()) as { id: number }[]).map((book) => book.id);
};

describe("GET /api/books", () => {
  it("returns every book sorted by year, then id", async () => {
    expect(await ids("/api/books")).toEqual([1, 2, 5, 3, 6, 4]);
  });

  it("returns whole book objects", async () => {
    const response = await dev.get("/api/books?q=hyperion");
    expect(await response.json()).toEqual([{ id: 4, title: "Hyperion", author: "Dan Simmons", year: 1989 }]);
  });

  it("filters by title or author, case-insensitively", async () => {
    expect(await ids("/api/books?q=DUNE")).toEqual([1, 5]);
    expect(await ids("/api/books?q=le%20guin")).toEqual([2, 3]);
    expect(await ids("/api/books?q=zzz")).toEqual([]);
  });

  it("limits the results", async () => {
    expect(await ids("/api/books?limit=2")).toEqual([1, 2]);
    expect(await ids("/api/books?q=herbert&limit=1")).toEqual([1]);
    expect(await ids("/api/books?limit=50")).toHaveLength(6);
  });

  for (const limit of ["0", "51", "abc", "2.5", "-1"]) {
    it(`rejects limit=${limit}`, async () => {
      const response = await dev.get(`/api/books?limit=${limit}`);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "limit must be an integer from 1 to 50" });
    });
  }
});
