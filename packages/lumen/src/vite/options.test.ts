// `lumen({ … })` project options (TASK-77, decision-21): validated and exposed as `api.options`.
import { describe, expect, it } from "vitest";
import lumen, { type LumenOptions } from "./index.ts";

const apiOf = (options?: LumenOptions) => lumen(options)[0]!.api!.options;
const create = (options: unknown) => () => lumen(options as LumenOptions);

describe("lumen() project options", () => {
  it("exposes mode, ssr, trailingSlash and csrf as api.options", () => {
    expect(apiOf()).toEqual({});
    expect(apiOf({ mode: "spa", ssr: false })).toEqual({ mode: "spa", ssr: false });
    expect(
      apiOf({
        mode: "server",
        trailingSlash: "never",
        csrf: { allowedOrigins: ["https://app.example.com", "http://localhost:5173"] },
        include: /\.stsx$/,
      }),
    ).toEqual({
      mode: "server",
      trailingSlash: "never",
      csrf: { allowedOrigins: ["https://app.example.com", "http://localhost:5173"] },
    });
    expect(apiOf({ csrf: false })).toEqual({ csrf: false });
    expect(Object.isFrozen(apiOf({ mode: "static" }))).toBe(true);
  });

  it("rejects invalid values with the option and the expected values", () => {
    expect(create({ mode: "ssg" })).toThrow(
      'lumen({ mode }): expected one of "static", "server", "spa", got "ssg".',
    );
    expect(create({ ssr: "no" })).toThrow('lumen({ ssr }): expected true or false, got "no".');
    expect(create({ trailingSlash: true })).toThrow(
      'lumen({ trailingSlash }): expected one of "ignore", "always", "never", got true.',
    );
    expect(create({ csrf: true })).toThrow(
      "lumen({ csrf }): expected false or { allowedOrigins }, got true.",
    );
    expect(create({ csrf: { allowedOrigins: "https://a.example" } })).toThrow(
      'lumen({ csrf.allowedOrigins }): expected an array of origins, got "https://a.example".',
    );
    expect(create({ csrf: { allowedOrigins: ["https://a.example/"] } })).toThrow(
      /csrf\.allowedOrigins \}\): expected full origins .* got "https:\/\/a\.example\/"\./,
    );
    expect(create({ csrf: { allowed: [] } })).toThrow(
      "lumen({ csrf.allowed }): unknown option. Known options: allowedOrigins.",
    );
    expect(create({ include: "*.stsx" })).toThrow(
      'lumen({ include }): expected a RegExp, got "*.stsx".',
    );
    expect(create({ moed: "spa" })).toThrow(
      "lumen({ moed }): unknown option. Known options: include, exclude, mode, ssr, trailingSlash, csrf, svg, md, html, viewTransitions, prefetch.",
    );
    expect(create(null)).toThrow("lumen(): expected an options object, got null.");
  });

  it("validates the MPA navigation options viewTransitions and prefetch (TASK-93)", () => {
    expect(apiOf({ viewTransitions: true, prefetch: "viewport" })).toEqual({
      viewTransitions: true,
      prefetch: "viewport",
    });
    expect(apiOf({ prefetch: "none" })).toEqual({ prefetch: "none" });
    expect(create({ viewTransitions: "auto" })).toThrow(
      'lumen({ viewTransitions }): expected true or false, got "auto".',
    );
    expect(create({ prefetch: "eager" })).toThrow(
      'lumen({ prefetch }): expected one of "hover", "viewport", "none", got "eager".',
    );
    expect(create({ prefetch: false })).toThrow(
      'lumen({ prefetch }): expected one of "hover", "viewport", "none", got false.',
    );
  });
});
