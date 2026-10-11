// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

// Streaming SSR (the default mode): the shell is flushed once the `deferStream` data of the page
// is ready; the comments stream in behind their Suspense fallback.
export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
