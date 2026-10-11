import { NotFound } from "../ui/not-found.tsx";
import { renderPage, type PageContext } from "./page.tsx";

/** The 404 page inside the layout (doc-4 §2): unknown URLs, projects and issues. */
export const notFound = (context: PageContext) =>
  renderPage(context, "Not found", <NotFound />, { status: 404 });
