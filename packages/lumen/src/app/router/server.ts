// SPA pages on the server (spec §7.1, §7.5; owner: Spark): the request handler renders the part of
// an `spa` page below its first `spa` layout as one root island, which the SPA entry hydrates
// (`ssr`) or renders into an empty shell (`ssr = false`). The island ref names the leaf the client
// starts from, so the island's `modulepreload` hint is that page's module.
import type { Component } from "../../contract/client.ts";
import { createComponent } from "../../server/frame.ts";
import { island } from "../../server/island.ts";
import type { PageTree } from "../server/render.ts";
import { CSR_REF, SPA_REF, type SpaPart } from "./table.ts";

export { layoutChain, spaErrorPart, spaPagePart, type SpaPart } from "./table.ts";

/**
 * The page tree of an SPA page: the outer layouts, then the SPA root island. `levels` are the
 * loaded components of `part.levels` (layouts, then the leaf), or `undefined` for an `ssr = false`
 * shell, whose island the client renders. `leafProps` are the leaf's props (`{ params }`, or
 * `{ status, error, params }` for error pages); an error's status and message travel as island
 * props, so the client renders the same error page.
 */
export function spaPageTree(
  part: SpaPart,
  outer: readonly Component<any>[],
  levels: readonly Component<any>[] | undefined,
  leafProps: Record<string, unknown>,
  params: Record<string, string>,
): PageTree {
  const leaf = part.levels.at(-1)!;
  const error = leafProps.error as Error | undefined;
  const props =
    error === undefined ? {} : { status: leafProps.status as number, message: error.message };
  const SpaRoot = (): unknown =>
    levels === undefined
      ? island(`/${leaf}${CSR_REF}`, () => null, props, "only")
      : island(`/${leaf}${SPA_REF}`, () => level(levels, 0, leafProps, params), props, "load");
  return { layouts: outer, page: SpaRoot as Component<any>, props: {}, params };
}

/** Level `index` and, through its `children`, the levels below it (as `composePageTree` does). */
function level(
  levels: readonly Component<any>[],
  index: number,
  leafProps: Record<string, unknown>,
  params: Record<string, string>,
): unknown {
  if (index === levels.length - 1) return createComponent(levels[index]!, leafProps);
  return createComponent(levels[index]!, {
    params,
    get children() {
      return level(levels, index + 1, leafProps, params);
    },
  });
}
