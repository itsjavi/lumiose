// /ui/llms-full.txt: every @lumiose/ui docs page in one file, for language models (packages/ui/docs).
import type { Endpoint } from "lumiose";
import { uiLlmsFullText } from "../../../content/llms.ts";

export const GET: Endpoint = () =>
  new Response(uiLlmsFullText(), { headers: { "content-type": "text/plain; charset=utf-8" } });
