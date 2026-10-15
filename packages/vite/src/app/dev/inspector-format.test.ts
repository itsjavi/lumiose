// Text helpers of the in-page inspector (./inspector-format.ts).
import { describe, expect, it } from "vitest";
import {
  ago,
  duration,
  openInEditorUrl,
  preview,
  shortSource,
  sourceFile,
  writeLocation,
} from "./inspector-format.ts";

describe("inspector text", () => {
  it("previews values on one line", () => {
    expect(preview("hi")).toBe('"hi"');
    expect(preview(3)).toBe("3");
    expect(preview(undefined)).toBe("undefined");
    expect(preview(10n)).toBe("10n");
    expect(preview(function onClick() {})).toBe("ƒ onClick()");
    expect(preview([1, "a", { b: [2] }])).toBe('[1, "a", { b: Array(1) }]');
    expect(preview([1, 2, 3, 4, 5, 6])).toBe("(6) [1, 2, 3, 4, 5, …]");
    expect(preview({ a: 1, nested: { deep: { x: 1 } } })).toBe("{ a: 1, nested: { deep: {…} } }");
    expect(preview(new Map([[1, 2]]))).toBe("Map(1)");
    expect(preview(new TypeError("boom"))).toBe("TypeError: boom");
    // Strings stop at 60 characters, quoted.
    expect(preview("x".repeat(200))).toHaveLength(63);
    expect(preview({ long: "y".repeat(60) }, 20)).toBe('{ long: "yyyyyyyyyy…');
    const hostile = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("no");
        },
      },
    );
    expect(preview(hostile)).toBe("(unreadable)");
  });

  it("shortens source locations and links them to the editor", () => {
    expect(shortSource("src/components/Counter.stsx:4:17")).toBe("Counter.stsx:4");
    expect(sourceFile("src/Counter.stsx:4:17")).toBe("src/Counter.stsx");
    expect(openInEditorUrl("/docs/", "/repo/app/", "src/Counter.stsx:4:17")).toBe(
      `/docs/__open-in-editor?file=${encodeURIComponent("/repo/app/src/Counter.stsx:4:17")}`,
    );
    // Modules outside the root keep their absolute id.
    expect(openInEditorUrl("/", "/repo/app", "/repo/kit/src/Nav.stsx:1:1")).toBe(
      `/__open-in-editor?file=${encodeURIComponent("/repo/kit/src/Nav.stsx:1:1")}`,
    );
    expect(openInEditorUrl("/", "C:/repo", "D:/kit/Nav.stsx:1:1")).toContain(
      encodeURIComponent("D:/kit/Nav.stsx:1:1"),
    );
  });

  it("finds where a write happened, past Lumiose's own frames", () => {
    const v8 = new Error("write");
    v8.stack = [
      "Error: write",
      "    at nodeWritten (http://localhost:5173/node_modules/lumiose/src/dom/devtools.ts:1:1)",
      "    at writeSignal (http://localhost:5173/@fs/repo/packages/lumiose/src/core/reactive.ts:2:2)",
      "    at Layout._button.$$click (http://localhost:5173/src/routes/layout.tsx?t=1:8:30)",
    ].join("\n");
    expect(writeLocation(v8)).toBe("src/routes/layout.tsx (Layout._button.$$click)");
    const anonymous = new Error("write");
    anonymous.stack = "Error: write\n    at http://localhost:5173/src/Counter.stsx?import:9:3";
    expect(writeLocation(anonymous)).toBe("src/Counter.stsx");
    const firefox = new Error("write");
    firefox.stack =
      "nodeWritten@http://localhost:5173/node_modules/lumiose/src/dom/devtools.ts:1:1\nonInput@http://localhost:5173/src/Search.stsx:3:4";
    expect(writeLocation(firefox)).toBe("src/Search.stsx (onInput)");
    expect(writeLocation(undefined)).toBeUndefined();
  });

  it("formats times", () => {
    expect(ago(100, 112.4)).toBe("12 ms ago");
    expect(ago(0, 3200)).toBe("3.2 s ago");
    expect(ago(0, 180_000)).toBe("3 min ago");
    expect(duration(10, 18.55)).toBe("8.6 ms");
    expect(duration(undefined, 3)).toBe("–");
  });
});
