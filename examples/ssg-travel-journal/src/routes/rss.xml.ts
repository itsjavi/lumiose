// The RSS 2.0 feed: a static GET endpoint, so `lumen build` writes it to dist/client/rss.xml.
import { href, type Endpoint } from "lumen";
import { renderToString } from "lumen/server";
import { allPosts } from "../content.ts";
import { escapeXml, rssDate } from "../lib/format.ts";
import { absoluteUrl, site } from "../lib/site.ts";

export const GET: Endpoint = async () => {
  const posts = allPosts();
  const bodies = await Promise.all(posts.map((post) => renderToString(post.Content)));
  const items = posts.map((post, index) => {
    const link = absoluteUrl(href("/posts/[slug]", { slug: post.slug }));
    return `    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${rssDate(post.date)}</pubDate>
      <description>${escapeXml(post.summary)}</description>
${post.tags.map((tag) => `      <category>${escapeXml(tag)}</category>`).join("\n")}
      <content:encoded>${cdata(bodies[index]!)}</content:encoded>
    </item>`;
  });
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${absoluteUrl("/")}</link>
    <description>${escapeXml(site.description)}</description>
    <language>en</language>
    <lastBuildDate>${rssDate(posts[0]?.date ?? "1970-01-01")}</lastBuildDate>
    <atom:link href="${absoluteUrl("/rss.xml")}" rel="self" type="application/rss+xml"/>
${items.join("\n")}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
};

/** A CDATA section; a `]]>` inside the text is split across two sections. */
function cdata(text: string): string {
  return `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;
}
