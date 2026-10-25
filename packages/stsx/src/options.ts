// `stsx({ … })` options (decision-86): the class attribute is required, `scopedStyles` is the option
// of `lumiose()` (decision-85). Invalid options throw a `TypeError` when the config loads.

import { validateScopeNamespace } from "@lumiose/compiler";

export interface ScopedStylesOption {
  /** `"attribute"` (default): `data-<namespace>-<hash>`; `"class"`: `<namespace>-<hash>`. */
  strategy?: "attribute" | "class";
  /** `"default"`: the scope adds (0,1,0) to a selector; `"zero"`: nothing (`:where()`). */
  specificity?: "default" | "zero";
  /** The start of the marker name. Default `"lum"`. */
  namespace?: string;
}

export interface StsxOptions {
  /**
   * The JSX attribute that holds classes: `"className"` for React and Preact, `"class"` for Solid.
   * The unused-selector check reads it, and with `scopedStyles.strategy: "class"` the scope
   * classes are merged into it (and passed to child components through it).
   */
  classAttribute: "className" | "class";
  /**
   * How scoped `<style>` blocks mark their elements and match them: `data-lum-<hash>` attributes
   * with a (0,1,0) bump by default; `strategy: "class"` uses `lum-<hash>` classes, `specificity:
   * "zero"` wraps the marker in `:where()`, `namespace` replaces `lum`.
   *
   * @example stsx({ classAttribute: "className", scopedStyles: { strategy: "class" } })
   */
  scopedStyles?: ScopedStylesOption;
}

const KNOWN = ["classAttribute", "scopedStyles"];
const SCOPED_KEYS = ["strategy", "specificity", "namespace"];

/** Validates `stsx({ … })` options; throws a `TypeError`. */
export function validateOptions(options: unknown): StsxOptions {
  if (typeof options !== "object" || options === null || Array.isArray(options)) {
    fail("", `expected an options object such as { classAttribute: "className" }`);
  }
  for (const key of Object.keys(options)) {
    if (!KNOWN.includes(key)) fail(key, `unknown option. Known options: ${KNOWN.join(", ")}`);
  }
  const { classAttribute, scopedStyles } = options as Record<string, unknown>;
  if (classAttribute !== "className" && classAttribute !== "class") {
    fail(
      "classAttribute",
      `expected "className" (React, Preact) or "class" (Solid), got ${JSON.stringify(classAttribute)}`,
    );
  }
  if (scopedStyles !== undefined) validateScopedStyles(scopedStyles);
  return options as StsxOptions;
}

function validateScopedStyles(value: unknown): void {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("scopedStyles", "expected { strategy?, specificity?, namespace? }");
  }
  for (const key of Object.keys(value)) {
    if (!SCOPED_KEYS.includes(key)) {
      fail(`scopedStyles.${key}`, `unknown option. Known options: ${SCOPED_KEYS.join(", ")}`);
    }
  }
  const { strategy, specificity, namespace } = value as Record<string, unknown>;
  if (strategy !== undefined && strategy !== "attribute" && strategy !== "class") {
    fail(
      "scopedStyles.strategy",
      `expected "attribute" or "class", got ${JSON.stringify(strategy)}`,
    );
  }
  if (specificity !== undefined && specificity !== "default" && specificity !== "zero") {
    fail(
      "scopedStyles.specificity",
      `expected "default" or "zero", got ${JSON.stringify(specificity)}`,
    );
  }
  if (namespace !== undefined) {
    if (typeof namespace !== "string") {
      fail("scopedStyles.namespace", `expected a string, got ${JSON.stringify(namespace)}`);
    }
    const problem = validateScopeNamespace(namespace);
    if (problem != null) {
      fail("scopedStyles.namespace", problem.replace(/^invalid scopedStyles\.namespace /, ""));
    }
  }
}

function fail(option: string, problem: string): never {
  const where = option === "" ? "stsx()" : `stsx({ ${option} })`;
  throw new TypeError(`${where}: ${problem}.`);
}
