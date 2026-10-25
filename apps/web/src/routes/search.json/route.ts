// The search index of the DocsSearch island: a static GET endpoint (dist/client/search.json), over
// the docs, the /ui pages and the /stsx pages.
import type { Endpoint } from "lumiose";
import { docPages, stsxPages, uiPages } from "../../content/docs.ts";
import type { SearchEntry } from "../../lib/search.ts";

export const GET: Endpoint<"/search.json"> = () =>
  Response.json(
    [...docPages(), ...stsxPages(), ...uiPages()].map((page): SearchEntry => ({
      url: page.url,
      title: page.title,
      section: page.topic.startsWith("ui/") ? `UI · ${page.section}` : page.section,
      summary: page.summary,
      headings: page.headings.map((heading) => [heading.id, heading.text]),
      text: page.text,
    })),
  );
