import { describe, expect, it } from "vitest";
import type { ClientRuntime } from "../contract/client.ts";
import * as runtime from "./index.ts";

// Compile-time conformance: `lumen/dom` implements every member of the client contract.
const conforms = runtime satisfies ClientRuntime;

describe("lumen/dom contract", () => {
  it("exports every ClientRuntime member", () => {
    const members: (keyof ClientRuntime)[] = [
      "template",
      "bind",
      "setText",
      "setAttr",
      "setProp",
      "setClass",
      "toggleClass",
      "setStyle",
      "setStyleProperty",
      "insert",
      "list",
      "branch",
      "selector",
      "createComponent",
      "restProps",
      "mergeProps",
      "spread",
      "applyScope",
      "delegateEvents",
      "listen",
      "bindValue",
      "bindChecked",
      "attach",
      "useRef",
      "$await",
      "$leave",
    ];
    for (const name of members) {
      expect(typeof conforms[name], name).toBe("function");
    }
  });

  it("keeps the async helpers as explicit TASK-17 stubs", () => {
    expect(() => runtime.$leave()).toThrow(/TASK-17/);
    expect(() => runtime.$await(() => 1, 0)).toThrow(/TASK-17/);
  });
});
