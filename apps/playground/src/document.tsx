// The HTML document of the playground page: the site's head defaults, its favicon and the theme
// script that applies a stored light/dark choice before the first paint (@lumen/site-kit/theme).
import { themeInitScript } from "@lumen/site-kit/theme";
import type { DocumentProps } from "lumen";
import { siteLink } from "./lib/site.ts";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <meta
          name="description"
          content="Try Lumen in the browser: edit a .stsx component and see the compiled client and server code, the scoped CSS, the diagnostics and the running result."
        />
        <link rel="icon" href={siteLink("/favicon.svg")} type="image/svg+xml" />
        <script innerHTML={themeInitScript} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
