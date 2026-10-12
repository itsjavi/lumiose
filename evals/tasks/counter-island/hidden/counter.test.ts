import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Dev, islands, source, startDev } from "./helpers.ts";

let dev: Dev;
beforeAll(async () => {
  dev = await startDev();
});
afterAll(() => dev?.stop());

describe("counter island", () => {
  it("hydrates the counter, on visibility, with its props", async () => {
    const html = await (await dev.get("/")).text();
    const records = islands(html);
    expect(records).toHaveLength(1);
    expect(records[0]!.ref).toMatch(/\/src\/components\/Counter\.stsx#Counter$/);
    expect(records[0]!.strategy).toBe("visible");
    expect(records[0]!.props).toMatchObject({ start: 10, step: 5 });
  });

  it("keeps the page server-rendered", async () => {
    const html = await (await dev.get("/")).text();
    expect(html).toContain("Posts");
    expect(html).toMatch(/<output[^>]*>(<!--\[-->)?10(<!--\]-->)?<\/output>/);
    expect(source("vite.config.ts")).not.toMatch(/mode:\s*["']spa["']/);
    expect(source("src/routes/page.stsx")).not.toMatch(/export const mode\s*=\s*["']spa["']/);
  });
});
