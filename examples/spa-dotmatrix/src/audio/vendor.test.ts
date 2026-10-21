// The vendored engine must stay byte-for-byte what its archive shipped (CHECKSUMS.sha256).
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../vendor/gbaudio/", import.meta.url);

describe("vendored gbaudio", () => {
  const lines = readFileSync(new URL("CHECKSUMS.sha256", root), "utf8")
    .split("\n")
    .map((line) => /^([0-9a-f]{64}) {2}(dist\/\S+)$/.exec(line))
    .filter((m) => m !== null);

  it("lists every dist file", () => expect(lines.length).toBe(12));

  for (const [, hash, file] of lines) {
    it(`${file} is unchanged`, () => {
      const actual = createHash("sha256")
        .update(readFileSync(new URL(file!, root)))
        .digest("hex");
      expect(actual).toBe(hash);
    });
  }
});
