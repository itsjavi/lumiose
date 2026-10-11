import { listProjects } from "@bench/data";
import type { RemixNode } from "remix/component";

import type { AppContext } from "../middleware/index.ts";
import { Document } from "./document.tsx";

export type PageContext = AppContext;

/** Renders a page inside the shared document and layout (doc-4 §2). */
export function renderPage(
  context: PageContext,
  title: string,
  page: RemixNode,
  init?: ResponseInit,
) {
  return context.render(
    <Document title={title} user={context.currentUser} projects={listProjects()}>
      {page}
    </Document>,
    init,
  );
}
