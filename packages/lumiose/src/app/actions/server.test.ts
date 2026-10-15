// The form action helpers under the node condition, which islands read while rendering on the server.
import { describe, expect, it } from "vitest";
import { submission } from "./server.ts";

describe("submission() on the server", () => {
  it("is an idle handle whose submit() rejects: submissions start in event handlers", async () => {
    const handle = submission();
    expect([handle.isSubmitting(), handle.result(), handle.error()]).toEqual([
      false,
      undefined,
      undefined,
    ]);
    handle.abort();
    handle.reset();
    await expect(handle.submit({})).rejects.toThrow(
      "submission().submit() runs in the browser: call it from an event handler, not during render.",
    );
  });
});
