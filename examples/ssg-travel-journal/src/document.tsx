// The HTML document around every page: head defaults shared by all pages, the RSS link, and two
// tiny inline scripts.
import type { DocumentProps } from "lumen";
import { site } from "./lib/site.ts";

// Runs before the first paint: applies the theme chosen with the toggle (islands/ThemeToggle),
// so a reader who picked dark never sees a light flash. Without a choice, the system decides.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

// Speculation rules: browsers that support them prefetch a same-site page when the pointer rests
// on its link, so the next (cross-document, view-transitioned) navigation starts sooner.
const SPECULATION_RULES = JSON.stringify({
  prefetch: [{ where: { href_matches: "/*" }, eagerness: "moderate" }],
});

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate" type="application/rss+xml" title={site.title} href="/rss.xml" />
        <script innerHTML={THEME_SCRIPT} />
        <script type="speculationrules" innerHTML={SPECULATION_RULES} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
