// The dev client of `lumiose dev` (TASK-148), loaded on every page through `\0lumiose:dev`
// (./plugin.ts). After an edit to server-only code the dev server sends `lumiose:server-update`;
// the page fetches its URL again and patches itself in place (./morph.ts), or reloads when it
// cannot. Edits that arrive during a patch run one more patch afterwards.
import type { ViteHotContext } from "vite/types/hot.d.ts";
import { patchPage, serverElements } from "./morph.ts";

/** The custom HMR event of server-only edits (./plugin.ts sends it). */
const SERVER_UPDATE = "lumiose:server-update";

const hot = (import.meta as ImportMeta & { hot?: ViteHotContext }).hot;
if (hot !== undefined) {
  const server = serverElements(document);
  let running = false;
  let again = false;
  hot.on(SERVER_UPDATE, async () => {
    if (running) {
      again = true;
      return;
    }
    running = true;
    try {
      do {
        again = false;
        const response = await fetch(location.href, {
          headers: { accept: "text/html" },
          cache: "no-store",
        });
        if (!(await patchPage(document, response, server))) {
          location.reload();
          return;
        }
        console.debug("[lumiose] page updated in place.");
      } while (again);
    } catch (error) {
      console.error("[lumiose] The page could not be updated in place; reloading.", error);
      location.reload();
    } finally {
      running = false;
    }
  });
}
