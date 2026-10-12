// Browser variants of the locale APIs of `lumiose` (decision-44). `locale()` and `alternates()`
// read the request, so in the browser they throw LUM4003 like the other request APIs; inside SPA
// routes, `locale()` from lumiose/router is the reactive one. `href()` is ../routes/href.ts.

import { LUM_SERVER_ONLY, LumioseError } from "../diagnostics.ts";
import type { Locale } from "../routes/registry.ts";

function serverOnly(api: string, hint: string): never {
  throw new LumioseError(
    LUM_SERVER_ONLY,
    `${api} is server-only and cannot run in the browser. ${hint} In code that also runs in the browser, such as a defineState() factory, guard the call with isServer: isServer ? ${api} : fallback.`,
  );
}

export function locale(): Locale {
  return serverOnly("locale()", "Inside SPA routes and islands, use locale() from lumiose/router.");
}

export function alternates(): Array<{ locale: Locale; href: string }> {
  return serverOnly(
    "alternates()",
    "Render the language switcher on the server, or pass the alternates to the island as a prop.",
  );
}
