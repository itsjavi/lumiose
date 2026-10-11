import { describe, expect, it } from "vitest";
import type { ServerRuntime } from "../contract/server.ts";
import * as runtime from "./index.ts";

// Compile-time conformance: `pnpm typecheck` fails if lumiose/server drifts from the contract.
const conforms = runtime satisfies ServerRuntime;

const CONTRACT_KEYS: ReadonlyArray<keyof ServerRuntime> = [
  "ssr",
  "text",
  "insert",
  "insertText",
  "insertValue",
  "attr",
  "classAttr",
  "styleAttr",
  "nonceAttr",
  "spreadAttrs",
  "escape",
  "list",
  "branch",
  "branchArm",
  "selector",
  "createComponent",
  "restProps",
  "mergeProps",
  "island",
  "$await",
  "$leave",
  "$async",
];

describe("lumiose/server contract", () => {
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
