import { formData } from "remix/middleware/form-data";
import { render } from "remix/middleware/render";
import { createMiddleware, type MiddlewareContext } from "remix/router";

import { assets } from "../assets.ts";
import { loadCurrentUser } from "./session.ts";

/** The router's middleware; no compression middleware (doc-4 §1). */
export const middleware = createMiddleware(formData(), loadCurrentUser(), render({ assets }));

export type AppContext = MiddlewareContext<typeof middleware>;

declare module "remix" {
  interface RouterTypes {
    context: AppContext;
  }
}
