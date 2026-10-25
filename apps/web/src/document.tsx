// The HTML document around every page: head defaults, the favicon, and the theme script that
// applies a stored light/dark choice before the first paint (@lumiose/site-kit/theme). The Open
// Graph image is the home page's unless a page's PageMeta replaces it (TASK-597).
import { themeInitScript } from "@lumiose/site-kit/theme";
import { href, type DocumentProps } from "lumiose";
import { absoluteUrl, link, ogImages, site } from "./lib/site.ts";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="description" content={site.description} />
        <meta property="og:site_name" content={site.name} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={absoluteUrl(ogImages.home.path)} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={ogImages.home.alt} />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="icon" href={link("/favicon.svg")} type="image/svg+xml" />
        <link rel="alternate" type="text/plain" title="llms.txt" href={href("/llms.txt")} />
        <script innerHTML={themeInitScript} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
