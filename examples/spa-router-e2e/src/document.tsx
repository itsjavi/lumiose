// The document around every page. Its title and description are head defaults: the user pages
// replace them, and they come back after a client navigation to a page without its own (TASK-256).
import type { DocumentProps } from "lumiose";

export default function Document(props: DocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>SPA router e2e</title>
        <meta name="description" content="An spa-mode fixture" />
        {props.head}
      </head>
      <body>{props.body}</body>
    </html>
  );
}
