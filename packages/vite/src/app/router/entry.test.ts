// The SPA entry module (TASK-252, TASK-263): with `lumiose({ viewTransitions: true })` it imports
// `viewTransition()`, and with `lumiose({ i18n })` `followLocaleLinks()`, and passes them to the
// router; otherwise neither, so the SPA leaves them out.
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

  it("passes followLocaleLinks() to the router only with i18n", () => {
    expect(spaEntryCode(manifest, "/")).not.toContain("followLocaleLinks");
    const i18n = { locales: ["en", "es"], defaultLocale: "en" };
    for (const csr of [false, true]) {
      const code = spaEntryCode({ ...manifest, i18n } as typeof manifest, "/", { csr });
      expect(code).toMatch(
        /^import \{ followLocaleLinks \} from ".*\/app\/router\/locale-links\.ts";$/m,
      );
      expect(code).toContain(`\n  i18n: ${JSON.stringify(i18n)},\n  followLocaleLinks,\n`);
    }
  });
});
