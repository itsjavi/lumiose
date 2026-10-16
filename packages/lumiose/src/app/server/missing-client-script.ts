// A client script the build did not emit (TASK-463). A component's `?client` import (decision-63)
// whose module the client build never saw, such as one in a nested project the one-time scan skips,
// has no URL to record: @lumiose/vite's server build gives it this stub instead, and warns once at
// build time. When a page renders the component, the stub says which script that page goes
// without, once per script, while prerendering and on the server.

import { currentFrame } from "../../server/frame.ts";
import { getRequestScope } from "./scope.ts";

const warned = new Set<string>();

/** Warns, once per script, that the page being rendered needs `file` and loads nothing. */
export function missingClientScript(file: string): void {
  if (currentFrame() === undefined || warned.has(file)) return;
  warned.add(file);
  const page = getRequestScope()?.ctx.url.pathname;
  console.warn(
    `${file} is a client script (?client) that the client build did not build: ${page === undefined ? "a page" : `"${page}"`} renders a component that needs it, and loads nothing. Import the component from a module of the project or of a Lumiose package, which the build scans.`,
  );
}
