// /stsx/llms-full.txt: every @lumiose/stsx docs page in one file, for language models
// (packages/stsx/docs).
import type { Endpoint } from "lumiose";
import { stsxLlmsFullText } from "../../../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(stsxLlmsFullText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
