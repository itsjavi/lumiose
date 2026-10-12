// /llms-full.txt: every docs page in one file, for language models (packages/lumiose/docs).
import type { Endpoint } from "lumiose";
import { llmsFullText } from "../../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(llmsFullText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
