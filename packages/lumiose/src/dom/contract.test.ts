import { describe, expect, it } from "vitest";
import type { ClientRuntime } from "../contract/client.ts";
import * as runtime from "./index.ts";

// Compile-time conformance: `lumiose/dom` implements every member of the client contract.
const conforms = runtime satisfies ClientRuntime;

describe("lumiose/dom contract", () => {
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
      "insertText",
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
      "$async",
      "branchValue",
      "listValue",
      "insertValue",
    ];
    for (const name of members) {
      expect(typeof conforms[name], name).toBe("function");
    }
  });

  it("$await never rejects: it resolves to a function that returns or throws", async () => {
    expect((await runtime.$await(() => Promise.resolve(1), 0))()).toBe(1);
    const resume = await runtime.$await(() => Promise.reject(new Error("no")), 1);
    expect(resume).toThrow("no");
    expect(() => runtime.$leave()).not.toThrow();
  });
});
