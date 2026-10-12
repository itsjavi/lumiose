// The SPA entry module (TASK-252): with `lumiose({ viewTransitions: true })` it imports
// `viewTransition()` and passes it to the router; otherwise neither, so the SPA leaves it out.
import { describe, expect, it } from "vitest";
import { spaEntryCode } from "./entry.ts";

const manifest = {
  routes: [
    {
      kind: "page",
      mode: "spa",
      ssr: true,
      file: "src/routes/page.tsx",
      layouts: [],
      segments: [],
    },
  ],
  layouts: [],
  notFoundPages: [],
  errorPages: [],
} as unknown as Parameters<typeof spaEntryCode>[0];

describe("spaEntryCode", () => {
  it("passes viewTransition() to the router only with viewTransitions", () => {
    const plain = spaEntryCode(manifest, "/");
    expect(plain).not.toContain("viewTransition");
    expect(plain).toContain("startSpa(islands, {");
    for (const csr of [false, true]) {
      const code = spaEntryCode(manifest, "/", { csr, viewTransitions: true });
      expect(code).toMatch(/^import \{ viewTransition \} from ".*\/dom\/view-transition\.ts";$/m);
      expect(code).toContain("\n  viewTransition,\n}");
      expect(code).toContain(csr ? "startCsr({" : "startSpa(islands, {");
    }
  });
});
