// /llms.txt: the docs index for language models, generated with the docs (packages/lumen/docs),
// with its links pointing at this site's pages.
import type { Endpoint } from "lumen";
import { llmsText } from "../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(llmsText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
