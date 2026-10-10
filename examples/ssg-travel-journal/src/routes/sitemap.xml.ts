// The sitemap: every prerendered page, as a static GET endpoint (dist/client/sitemap.xml).
import { href, type Endpoint } from "lumiose";
import { allPosts, allTags, postsTagged } from "../content.ts";
import { escapeXml } from "../lib/format.ts";
import { pageCount, pageHref } from "../lib/paginate.ts";
import { absoluteUrl, site } from "../lib/site.ts";

interface Entry {
  path: string;
  /** `YYYY-MM-DD` of the newest content on the page. */
  lastmod?: string;
}

export const GET: Endpoint<"/sitemap.xml"> = () => {
  const posts = allPosts();
  const newest = posts[0]?.date;
  const pages = pageCount(posts.length, site.pageSize);
  const entries: Entry[] = [
    ...Array.from({ length: pages }, (_, index) => ({
      path: pageHref(index + 1),
      lastmod: posts[index * site.pageSize]?.date,
    })),
    ...posts.map((post) => ({
      path: href("/posts/[slug]", { slug: post.slug }),
      lastmod: post.date,
    })),
    { path: href("/tags"), lastmod: newest },
    ...allTags().map(({ tag }) => ({
      path: href("/tags/[tag]", { tag }),
      lastmod: postsTagged(tag)[0]?.date,
    })),
    { path: href("/archive"), lastmod: newest },
    { path: href("/about") },
  ];
  const urls = entries.map(
    (entry) =>
      `  <url><loc>${escapeXml(absoluteUrl(entry.path))}</loc>${entry.lastmod === undefined ? "" : `<lastmod>${entry.lastmod}</lastmod>`}</url>`,
  );
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>
`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
