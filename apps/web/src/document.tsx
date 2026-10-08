// The HTML document around every page: head defaults, the favicon, and the theme script that
// applies a stored light/dark choice before the first paint (@lumen/site-kit/theme).
import { themeInitScript } from "@lumen/site-kit/theme";
import { href, type DocumentProps } from "lumen";
import { link, site } from "./lib/site.ts";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta name="description" content={site.description} />
        <link rel="icon" href={link("/favicon.svg")} type="image/svg+xml" />
        <link rel="alternate" type="text/plain" title="llms.txt" href={href("/llms.txt")} />
        <script innerHTML={themeInitScript} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
