import { describe, expect, it } from "vitest";

describe("lumen package", () => {
  it("loads the public entry", async () => {
    await expect(import("./index.ts")).resolves.toBeTypeOf("object");
  });
});
