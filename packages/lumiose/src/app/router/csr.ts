// The SPA entry's runtime for builds whose SPA pages are all client-rendered (`ssr = false`) and
// that have no islands (owner: Spark; spec §7.5): nothing hydrates, so the SPA starts without the
// island loader (./boot.ts) and hydration, which then do not ship.
import { createOwner, runWithOwner } from "../../core/internal.ts";
import { createComponent } from "../../dom/component.ts";
import { ID_PREFIX } from "../../dom/id.ts";
import { insert } from "../../dom/insert.ts";
import { receivePayload } from "../../dom/state.ts";
import { createRouter, prepareRoot, type SpaConfig } from "./router.ts";
import { CSR_REF } from "./table.ts";

/** Leaf file (page or error page) → the SPA it belongs to. */
export function leavesOf(config: SpaConfig): Record<string, string> {
  const leaves: Record<string, string> = {};
  for (const route of config.routes) {
    if (route.levels !== undefined) leaves[route.levels.at(-1)!] = route.app!;
  }
  for (const [file, page] of Object.entries(config.pages)) leaves[file] = page.app;
  return leaves;
}

/**
 * Starts an SPA whose pages are all client-rendered, without the island loader: finds the shell's
 * root island (`/<leaf>#lumiose:csr`, plain JSON props) once the document is parsed and renders the
 * router's root component before its closing marker. With `src/instrumentation.client.ts`, once
 * `ready` (its run, ../client-entry.ts) settled (decision-49).
 */
export function startCsr(config: SpaConfig, ready?: Promise<unknown>): void {
  const leaves = leavesOf(config);
  const start = (): void => {
    // Scoped state values from the server (decision-33), before the SPA's first render.
    for (const script of document.querySelectorAll("script[data-l-payload]")) {
      receivePayload(JSON.parse(script.textContent!));
    }
    for (const script of document.querySelectorAll("script[data-l-islands]")) {
      for (const record of JSON.parse(script.textContent!) as {
        id: number;
        ref: string;
        props: object;
        idPrefix?: string;
      }[]) {
        const leaf = record.ref.slice(1, -CSR_REF.length);
        if (!record.ref.endsWith(CSR_REF) || leaves[leaf] === undefined) continue;
        const walker = document.createTreeWalker(document, 128);
        let end: Node | null;
        while ((end = walker.nextNode()) !== null && (end as Comment).data !== `/l:${record.id}`);
        createRouter(config, leaves[leaf]);
        void prepareRoot(leaf, true).then((root) => {
          const owner = createOwner(undefined);
          if (record.idPrefix) owner.context = { [ID_PREFIX]: record.idPrefix };
          runWithOwner(owner, () =>
            insert(end!.parentNode!, createComponent(root, record.props), end),
          );
        });
        return;
      }
    }
  };
  const begin = ready === undefined ? start : () => void ready.then(start);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", begin);
  else begin();
}
