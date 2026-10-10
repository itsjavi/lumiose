import { renderToStream, type RenderToStreamOptions } from "lumiose";
import { Page } from "./Page.tsx";

export function render(options: RenderToStreamOptions) {
  return renderToStream(() => <Page />, options);
}
