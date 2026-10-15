# CLI

> The `lumiose` command: every subcommand with its options, JSON output and exit codes.

The command comes with the `@lumiose/cli` package (`pnpm add -D @lumiose/cli`).

```sh
lumiose <command> [options]
lumiose <command> --help        # usage, options, exit codes and examples
lumiose help --format json      # every command, for agents
```

## Output contract

- **Exit codes:** `0` success, `1` problems found (errors, unformatted files, nothing found, a
  failed build, a server that could not start), `2` the tool itself failed or was misused (unknown
  command or option, missing tsconfig or oxlint, a project root that does not exist). Each
  command's `--help` lists its exit codes.
- **`--format json`:** stdout carries one JSON document, `{ "command": "<name>", "ok": <bool>, ... }`.
  `ok` is `true` exactly when the exit code is `0`. When the command could not do its job and no
  diagnostics explain why, `failure: { message, help? }` says so. Fields are only ever added.
  Usage errors are reported the same way (`lumiose chek --format json` prints `{ "command": "chek",
  "ok": false, "failure": {...}, "suggestions": ["check"] }`).
- **Logs** go to stderr with `--format json`, so stdout parses as JSON.
- **Typos** get suggestions: `lumiose chek` prints `Did you mean "lumiose check"?`.

| Option                   | Applies to   | Meaning                                                       |
| ------------------------ | ------------ | ------------------------------------------------------------- |
| `--root <dir>`, `--cwd`  | all          | Project root (default: the current directory).                |
| `--format human \| json` | all          | Output format (default `human`).                              |
| `-h, --help`             | all          | Help for the command.                                         |
| `-v, --version`          |              | The version (`{ command: "version", ok, version }` in JSON).  |
| `-p, --project <file>`   | check        | tsconfig path relative to the root (default `tsconfig.json`). |
| `--check`                | fmt          | List unformatted files and exit 1 instead of writing.         |
| `--port <n>`             | dev, preview | Port; `0` picks a free one.                                   |
| `--host <addr>`          | dev, preview | Listen address (`0.0.0.0`: all addresses).                    |

## lumiose dev

Starts the Vite dev server with SSR and HMR, until interrupted.

What an edit updates: a stylesheet or a file's `<style>` block updates in place; an edited
component in an island's own module re-renders its instances in place (the page, its scroll
position, the island's other components and the other islands keep their state; see
[hot updates](./vite.md)); an island module the compiler could not register re-renders the
island's instances from their props. An island module that other client modules import reloads
the page, since they would keep its old exports, and so does other client code (a module an
island or an SPA route imports).

Server-only code (pages, layouts and components that no island or SPA route imports, middleware,
the document) updates the page in place: the page fetches its URL again and patches its DOM to the
new HTML. Islands keep their DOM and state, and focus, scroll positions and form input survive; the
title, meta tags and stylesheets of the head follow the new page. The page reloads instead when
the new HTML changes the `<html>`, `<head>` or `<body>` attributes, adds or removes a script, or
changes an island's props, hydration strategy or slot content; when the response status changed,
redirected or is not HTML; when the page was the result of a form post; and when the render
reported errors (the reload shows the overlay).

```sh
lumiose dev --port 3000
lumiose dev --format json   # one line once listening: { "command": "dev", "ok": true, "url": "http://localhost:5173/", "urls": { "local": [...], "network": [...] } }
```

Like Vite, the server stops when its stdin ends; start it with an open stdin when it runs in the
background. A project with its own Node server runs the same dev setup inside it with
[`createDevHandler()`](vite.md#createdevhandler).

## lumiose build

Builds the client and server bundles into `dist/`, then prerenders the `static` routes and the `spa`
pages with `prerender`. When every route is prerendered (no `server` route, no `spa` route rendered
per request, no form action), the build
removes `dist/server`: `dist/client` is the whole site, and `serverEntry` is `null`.
`lumiose({ headers })` is written to `dist/client/_headers`.
Route modules' chunks and stylesheets are named after their route folder, since every page is
`page.stsx`: `blog/[slug]/page.stsx` builds to `assets/blog-slug-page-[hash].js` (an `spa` page) and
`assets/blog-slug-page-[hash].css`, `(app)/layout.stsx` to `assets/app-layout-[hash].css`. A Vite
config that sets its own `entryFileNames`, `chunkFileNames` or `assetFileNames` keeps its names.
Servers and deploy adapters cache exactly the files the build named by content hash for a year;
files you put in `public/assets/` revalidate
([`@lumiose/adapter-node`](./adapter-node.md#createstatichandler)).

```sh
lumiose build --format json   # { outDir, clientDir, serverEntry, prerendered: [{ path, file, kind }] }
```

Route errors (`LUM5002`, `LUM5003`, `LUM5005`, `LUM5006`) and compile errors exit 1.

## lumiose preview

Serves the build output until interrupted. With `dist/server`, it serves it with
`@lumiose/adapter-node` (a dependency of the project), and the app runs with `NODE_ENV=production`
unless `NODE_ENV` is set. Without it (every route prerendered), it serves
`dist/client` as a static site, no adapter needed: page URLs map to `about/index.html` or
`about.html`, and unknown URLs get `404.html` with status 404, as static hosts do. Every response,
static files included, gets `lumiose({ headers })` and Vite's `preview.headers`, which default to
`server.headers` (as with `vite preview`)
([adapter `headers`](./adapter-node.md#createhandler)).
`--format json` prints one line once listening: `{ "command": "preview", "ok": true, "url" }`.

## lumiose check

Type-checks the project: runs typegen (`.lumiose/types/routes.d.ts`), writes shadow TSX files for
every `.stsx` (`.lumiose/shadow/`; also those of used Lumiose packages when the tsconfig extends
`.lumiose/tsconfig.generated.json`, as the template does, see
[tsconfig](./jsx.md#imports-outside-src-and-stsx-from-other-packages)), writes the generated
tsconfig, runs `tsc --noEmit -p tsconfig.json`, maps shadow positions back
to the `.stsx` sources (same line and UTF-16 column), and merges scanner, route, tsconfig and
compiler diagnostics for `.stsx` and `.tsx` files (such as `LUM1006` for a `<style>` block in a
`.tsx` file). For style diagnostics, the modules that `$` constants are imported from are resolved
like TypeScript resolves them (relative paths, tsconfig `paths`, package `exports`). Route
diagnostics use the project's default mode from `lumiose({ mode })`.

```sh
lumiose check
lumiose check --format json   # { command, ok, diagnostics: [...], summary: { errors, warnings, hints, files } }
```

Each JSON diagnostic has `source` (`ts`, `lumiose`, `oxlint`, `stylelint`), `code`, `severity`,
`file`, `line`, `column`, `endLine`, `endColumn`, `message`, and optional `help`, `docs` and
`fix`. A `fix` is `{ message, edits: [{ line, column, endLine, endColumn, text }] }`, with the same
positions as diagnostics; apply all its edits together.

TypeScript errors inside a raw-CSS `<style>` block of a `.tsx` file are dropped: `LUM1006` reports
the block, and renaming the file to `.stsx` removes them. TypeScript errors on an island call site
for a prop that cannot be serialized are reported as `LUM4002` on the prop (see
[LUM4002](../errors/LUM4002.md)). While the project has syntax errors, TypeScript reports no type
errors yet: the report then ends with a note (JSON: `notes: [...]`), and another run after the
fixes shows them.

## lumiose typegen

Writes the route types (`.lumiose/types/routes.d.ts`), the generated tsconfig
(`.lumiose/tsconfig.generated.json`) and syncs the shadow TSX files (`.lumiose/shadow/`), without
type-checking: what a bare `tsc` or an editor needs.

```sh
lumiose typegen --format json   # { routeTypes: { file, changed }, routes, shadows: { dir, files, written, deleted }, diagnostics, summary }
```

## lumiose routes

Lists the routes in match order, with their kind, mode (from the route, its layouts or the project
default `lumiose({ mode })`) and layouts. `spa (shell)` marks a `spa` page with `ssr = false`, and
`spa (prerendered)` a `spa` page rendered to HTML at build time, by its own `export const prerender`,
a layout's or `lumiose({ prerender })`.
With `lumiose({ i18n })`, the header names the locales and a `LOCALES` column lists the locales
each route declares (its own `locales` export, a layout's, or the default locale alone);
`locales() in <file>` marks a route whose `locales({ params })` function decides per params.
When the app has middleware, a `MIDDLEWARE` column shows each route's chain in the order it runs:
`src/middleware.ts`, then the folder `middleware.ts` files from the outermost folder in.

```sh
$ lumiose routes
Routes in src/routes (default mode: static): 2 pages, 1 endpoint

PATTERN        KIND      MODE    FILE                   LAYOUTS
/              page      static  page.stsx              layout.stsx
/api/search    endpoint  server  api/search/route.ts
/blog/[slug]   page      server  blog/[slug]/page.stsx  layout.stsx, blog/layout.stsx

$ lumiose routes   # with lumiose({ i18n })
Routes in src/routes (default mode: static, locales: en, es, fr (default en)): 3 pages, 0 endpoints

PATTERN       KIND  MODE    FILE                   LOCALES                             LAYOUTS
/             page  static  page.stsx              en, es, fr
/about        page  static  about/page.stsx        en, es
/blog/[slug]  page  static  blog/[slug]/page.stsx  locales() in blog/[slug]/page.stsx

$ lumiose routes   # with src/middleware.ts and src/routes/admin/middleware.ts
Routes in src/routes (default mode: server): 2 pages, 0 endpoints

PATTERN       KIND  MODE    FILE                   MIDDLEWARE                                LAYOUTS
/             page  server  page.stsx              src/middleware.ts                         layout.stsx
/admin/users  page  server  admin/users/page.stsx  src/middleware.ts > admin/middleware.ts  layout.stsx

$ lumiose routes --format json   # { routesDir, defaultMode, i18n?, routes: [{ pattern, file, kind, mode, ssr?, prerender?, layouts, middleware, params, locales?, localesFrom? }], diagnostics, summary }
```

Paths in JSON are project-relative. Exits 1 when the routes have errors.

## lumiose lint

Runs oxlint on the project, including `.stsx` files (through their shadow TSX, with diagnostics
inside style blocks dropped) and leaving out `node_modules` and `.lumiose`, and, when the project
installs and configures stylelint, on each
block's CSS with `$` references replaced by same-length identifiers. The JSON report has the shape
of `lumiose check`'s.

## lumiose fmt

```sh
lumiose fmt [paths...]        # default path: src
lumiose fmt --check
lumiose fmt --check --format json   # { check, files: [{ file, status, warnings, error? }], summary: { files, formatted, errors } }
```

Formats `.stsx` files: the TSX with oxfmt (each block replaced by a placeholder), then each block's
CSS separately with its `$` references protected, then re-indents and stitches the file together.
With `--check`, a `formatted` file is one that is not formatted yet.

## oxlint, ESLint and Prettier

Projects that run the tools themselves add Lumiose through plugins. The lint rules are thin
adapters over the compiler: they report its `LUMxxxx` diagnostics (with help, the docs topic and
fixes), so every tool agrees with `lumiose check`. Project-wide checks (`LUM4003`, `LUM3012`) and the
style diagnostics of `$` constants imported from other modules need the whole project: run
`lumiose check` for those.

**oxlint** (JS plugins, alpha in oxlint): lints `.tsx` files; oxlint cannot parse `.stsx` yet, so
`lumiose lint` covers those.

```json
// .oxlintrc.json
{
  "jsPlugins": ["@lumiose/eslint-plugin"],
  "rules": { "lumiose/compiler": "error", "lumiose/compiler-warnings": "warn" }
}
```

**ESLint 9** (flat config): the recommended config also lints `.stsx` files through a processor
that hands ESLint the masked TSX (same offsets, so positions and fixes apply to the source). Parse
TSX with a TypeScript parser, such as typescript-eslint's.

```js
// eslint.config.js
import lumiose from "@lumiose/eslint-plugin";
import tseslint from "typescript-eslint";

export default [
  ...lumiose.configs.recommended,
  { files: ["**/*.tsx", "**/*.stsx/*.tsx"], languageOptions: { parser: tseslint.parser } },
];
```

**Prettier**: `@lumiose/prettier-plugin` formats `.stsx` like `lumiose fmt` (the TSX and each block's
CSS with Prettier's printers, re-indented at their placement), following Prettier's options; a
file with scanner or syntax errors is reported, not changed. oxfmt has no plugin API, so
`lumiose fmt` remains the way to format `.stsx` with oxfmt.

```json
// .prettierrc.json
{ "plugins": ["@lumiose/prettier-plugin"] }
```

## lumiose docs

```sh
lumiose docs                  # the docs index
lumiose docs signals          # a topic by name...
lumiose docs concepts/signals # ...or by path
lumiose docs deploy           # a section's index (deploy/README), like errors
lumiose docs LUM2001          # a diagnostic page (also errors/LUM2001, diagnostics/LUM2001)
lumiose docs fetchJSON        # an exported name: its section of the API reference
lumiose docs bind:value       # no topic matches: search, best matches first
lumiose docs --format json    # { topics: [{ topic, title, summary }] }
lumiose docs signals --format json   # { topic, title, summary, related, content }
lumiose docs Link --format json      # { topic, heading, content }
lumiose docs "await island" --format json   # { query, results: [{ topic, title, score, snippet }] }
```

Prints the version-matched docs from `node_modules/lumiose/docs`. A bare name prefers concepts over
reference pages and lists the other matches. An exported name (case-sensitive, such as `signal`,
`Link` or `fail`) prints the section of the reference page that documents it. A search requires
every term to occur in a page.
Exits 1 when nothing matches.

## lumiose explain

```sh
lumiose explain LUM3010
lumiose explain lum3010 --format json   # { code, title, severity, category, topic, content }
```

Prints the long-form explanation of a diagnostic code: what it means, an example, and how to fix
it. Exits 1 for an unknown code and 2 for text that is not a code.

## lumiose agents init

```sh
lumiose agents init
lumiose agents init --mcp           # also .mcp.json (Claude Code) and .codex/config.toml (Codex)
lumiose agents init --format json   # { files: [{ file, action: "created" | "updated" | "unchanged" }] }
```

Makes an existing project agent-ready, as `create-lumiose` does for new ones: a Lumiose section in
`AGENTS.md` (between `<!-- lumiose:start … -->` and `<!-- lumiose:end -->`, pointing at
`node_modules/lumiose/docs`, the `.stsx` format, the key rules and `lumiose check`), a `CLAUDE.md`
that references `@AGENTS.md`, the `lumiose` skill (`.claude/skills/lumiose/SKILL.md`) and the
`*.stsx linguist-language=TSX` line in `.gitattributes`, and a `tsconfig.json` that extends
`.lumiose/tsconfig.generated.json` when the project has none (an existing one is left alone).
Re-running it updates only those parts. `--mcp` also registers `lumiose mcp` for Claude Code and
Codex, run with the package manager of the lockfile (see [MCP](mcp.md#register-it)); the JSON
report then has `mcp: { command, args, note }`.

## lumiose mcp

```sh
lumiose mcp
claude mcp add lumiose -- npx lumiose mcp   # register it with Claude Code
```

Starts the MCP server on stdio for coding agents: the tools `docs_search`, `docs_get`, `check`,
`routes`, `components`, `compile`, `render` and `dev_logs`, and the docs and the route manifest as
resources. It runs until the client disconnects. See [MCP server](mcp.md).
