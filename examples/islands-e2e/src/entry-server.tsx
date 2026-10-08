import { renderToStream, type RenderToStreamOptions } from "lumen";
import { Page } from "./Page.tsx";

export function render(options: RenderToStreamOptions) {
  return renderToStream(() => <Page />, options);
}
