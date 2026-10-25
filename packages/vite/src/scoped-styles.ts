// The `scopedStyles` option (decision-85): how scoped `<style>` blocks mark their elements and
// match them. The compiler stamps the markers and lumiose_css writes the selectors from the same
// option, so every compile of the app gets it (./index.ts `compileOptions`).

import { validateScopeNamespace } from "@lumiose/compiler";

export interface ScopedStylesOption {
  /** `"attribute"` (default): `data-<namespace>-<hash>`; `"class"`: `<namespace>-<hash>`. */
  strategy?: "attribute" | "class";
  /** `"default"`: the scope adds (0,1,0) to a selector; `"zero"`: nothing (`:where()`). */
  specificity?: "default" | "zero";
  /** The start of the marker name. Default `"lum"`. */
  namespace?: string;
}

const KEYS = ["strategy", "specificity", "namespace"];
const STRATEGIES = ["attribute", "class"];
const SPECIFICITIES = ["default", "zero"];

/** The problem with a `scopedStyles` value, as `[path, message]`, or `undefined` when it is valid. */
export function scopedStylesProblem(value: unknown): [path: string, message: string] | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return ["", "expected { strategy?, specificity?, namespace? }"];
  }
  for (const key of Object.keys(value)) {
    if (!KEYS.includes(key)) {
      return [`.${key}`, `unknown option. Known options: ${KEYS.join(", ")}`];
    }
  }
  const { strategy, specificity, namespace } = value as Record<string, unknown>;
  if (strategy !== undefined && !STRATEGIES.includes(strategy as string)) {
    return [".strategy", `expected "attribute" or "class", got ${JSON.stringify(strategy)}`];
  }
  if (specificity !== undefined && !SPECIFICITIES.includes(specificity as string)) {
    return [".specificity", `expected "default" or "zero", got ${JSON.stringify(specificity)}`];
  }
  if (namespace !== undefined) {
    if (typeof namespace !== "string") {
      return [".namespace", `expected a string, got ${JSON.stringify(namespace)}`];
    }
    const problem = validateScopeNamespace(namespace);
    if (problem != null) {
      return [".namespace", problem.replace(/^invalid scopedStyles\.namespace /, "")];
    }
  }
  return undefined;
}
