This package has Lumen, Vite and TypeScript installed (see `package.json`; the Lumen docs are in `node_modules/lumen/docs`), but no app yet. You cannot install anything else.

Set it up as a Lumen app whose routes are static by default (prerendered at build time):

- the configuration Lumen needs (Vite config with the Lumen plugin, TypeScript config);
- `package.json` scripts `dev`, `build` and `check` running the matching `lumen` commands;
- a home page at `/` with the document title "Hello" and an `<h1>` "Hello Lumen".

When you are done, `lumen check` and `lumen build` must succeed and the build must contain the prerendered home page.
