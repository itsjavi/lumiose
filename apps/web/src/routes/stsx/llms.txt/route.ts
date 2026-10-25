// /stsx/llms.txt: @lumiose/stsx's docs index for language models, generated with its docs
// (packages/stsx/docs), with its links pointing at this site's pages.
import type { Endpoint } from "lumiose";
import { stsxLlmsText } from "../../../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(stsxLlmsText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
