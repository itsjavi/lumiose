// The search index of the DocsSearch island: a static GET endpoint (dist/client/search.json).
import type { Endpoint } from "lumen";
import { docPages } from "../content/docs.ts";
import type { SearchEntry } from "../lib/search.ts";

export const GET: Endpoint = () =>
  Response.json(
    docPages().map((page): SearchEntry => ({
      url: page.url,
      title: page.title,
      section: page.section,
      summary: page.summary,
      headings: page.headings.map((heading) => [heading.id, heading.text]),
      text: page.text,
    })),
  );
