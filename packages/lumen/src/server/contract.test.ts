import { describe, expect, it } from "vitest";
import type { ServerRuntime } from "../contract/server.ts";
import * as runtime from "./index.ts";

// Compile-time conformance: `pnpm typecheck` fails if lumen/server drifts from the contract.
const conforms = runtime satisfies ServerRuntime;

const CONTRACT_KEYS: ReadonlyArray<keyof ServerRuntime> = [
  "ssr",
  "text",
  "insert",
  "attr",
  "classAttr",
  "styleAttr",
  "spreadAttrs",
  "escape",
  "list",
  "branch",
  "selector",
  "createComponent",
  "restProps",
  "mergeProps",
  "island",
  "$await",
  "$leave",
];

describe("lumen/server contract", () => {
  it("exports every ServerRuntime member", () => {
    for (const key of CONTRACT_KEYS) expect(conforms[key]).toBeTypeOf("function");
  });

  it("exports nothing outside the contract except the render entry points", () => {
    const extra = Object.keys(runtime).filter(
      (key) => !(CONTRACT_KEYS as readonly string[]).includes(key),
    );
    expect(extra.toSorted()).toEqual(["renderToStream", "renderToString"]);
  });
});
