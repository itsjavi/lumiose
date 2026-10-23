// Client scripts of server-rendered components (decision-63, TASK-354): a module that must run in
// the browser on the pages that render a component, without the island runtime, such as the
// definition of a custom element the component renders (`lu-menu` in @lumiose/ui). The component
// imports the module with the `?client` query (packages/vite/src/client-scripts.ts), whose server
// version calls `clientScript()` with the module's client URL when the component renders. The page
// then loads it with a module script, once, in the head or in the chunk of the streamed boundary
// that rendered it. In the browser the import loads the module itself and the call does nothing,
// so islands and SPA pages load it with their own code (or on the first call, when their code only
// calls it conditionally: TASK-551).

import { currentFrame, resolveUnit } from "./frame.ts";
import { addPreload } from "./render.ts";

/**
 * Records that the page being rendered loads the module script `url`, and modulepreloads
 * `preloads` (the chunks it imports). Outside a render it does nothing.
 */
export function clientScript(url: string, preloads: readonly string[] = []): void {
  const frame = currentFrame();
  if (frame === undefined) return;
  const render = frame.render;
  const unit = resolveUnit(frame.unit);
  if (unit.scripts.includes(url) || render.shell.scripts.includes(url)) return;
  unit.scripts.push(url);
  for (const preload of preloads) addPreload(render, unit, preload);
}
