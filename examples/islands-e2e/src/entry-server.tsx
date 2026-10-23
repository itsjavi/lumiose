import { renderToStream, type RenderToStreamOptions } from "lumiose";
import { DraftPage } from "./DraftPage.tsx";
import { Page } from "./Page.tsx";

export function render(options: RenderToStreamOptions, path = "/") {
  return renderToStream(() => (path === "/draft" ? <DraftPage /> : <Page />), options);
}
