// The search index of the Search island: a static GET endpoint (dist/client/search.json).
import { href, type Endpoint } from "lumiose";
import { allPosts } from "../content.ts";
import type { SearchEntry } from "../lib/search.ts";

export const GET: Endpoint<"/search.json"> = () =>
  Response.json(
    allPosts().map((post): SearchEntry => ({
      url: href("/posts/[slug]", { slug: post.slug }),
      title: post.title,
      summary: post.summary,
      tags: [...post.tags],
      date: post.date,
    })),
  );
