This package has Lumiose, Vite and TypeScript installed (see `package.json`; the Lumiose docs are in `node_modules/lumiose/docs`), but no app yet. You cannot install anything else.

Set it up as a Lumiose app whose routes are static by default (prerendered at build time):

- the configuration Lumiose needs (Vite config with the Lumiose plugin, TypeScript config);
- `package.json` scripts `dev`, `build` and `check` running the matching `lumiose` commands;
- a home page at `/` with the document title "Hello" and an `<h1>` "Hello Lumiose".

When you are done, `lumiose check` and `lumiose build` must succeed and the build must contain the prerendered home page.
