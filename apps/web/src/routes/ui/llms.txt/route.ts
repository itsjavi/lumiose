// /ui/llms.txt: @lumiose/ui's docs index for language models, generated with its docs
// (packages/ui/docs, decision-64), with its links pointing at this site's pages.
import type { Endpoint } from "lumiose";
import { uiLlmsText } from "../../../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(uiLlmsText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
