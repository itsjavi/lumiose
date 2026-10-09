// The HTML document around every page: head defaults shared by all pages, the RSS link, and a
// tiny inline script. Lumen adds the View Transitions opt-in and the speculation rules that
// prefetch links on hover (`lumen({ viewTransitions: true })` in vite.config.ts) to `props.head`.
import { href, type DocumentProps } from "lumen";
import { asset, site } from "./lib/site.ts";

// Runs before the first paint: applies the theme chosen with the toggle (islands/ThemeToggle),
// so a reader who picked dark never sees a light flash. Without a choice, the system decides.
// Under `csp: "strict"` Lumen gives it the response's nonce; prerendered pages allow it by hash.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" href={asset("/favicon.svg")} type="image/svg+xml" />
        <link
          rel="alternate"
          type="application/rss+xml"
          title={site.title}
          href={href("/rss.xml")}
        />
        <script innerHTML={THEME_SCRIPT} />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
