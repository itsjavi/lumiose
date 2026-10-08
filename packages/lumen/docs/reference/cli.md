# CLI

> The `lumen` command: `dev`, `build`, `preview`, `check`, `typegen`, `routes`, `lint`, `fmt`, `docs`, `explain`, `agents init` and `mcp`, each with help, `--format json` and stable exit codes.

```sh
lumen <command> [options]
lumen <command> --help        # usage, options, exit codes and examples
lumen help --format json      # every command, for agents
```

## Output contract

- **Exit codes:** `0` success, `1` problems found (errors, unformatted files, nothing found, a
  failed build, a server that could not start), `2` the tool itself failed or was misused (unknown
  command or option, missing tsconfig or oxlint, a project root that does not exist). Each
  command's `--help` lists its exit codes.
- **`--format json`:** stdout carries one JSON document, `{ "command": "<name>", "ok": <bool>, ... }`.
  `ok` is `true` exactly when the exit code is `0`. When the command could not do its job and no
  diagnostics explain why, `failure: { message, help? }` says so. Fields are only ever added.
  Usage errors are reported the same way (`lumen chek --format json` prints `{ "command": "chek",
  "ok": false, "failure": {...}, "suggestions": ["check"] }`).
- **Logs** go to stderr with `--format json`, so stdout parses as JSON.
- **Typos** get suggestions: `lumen chek` prints `Did you mean "lumen check"?`.

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

## lumen dev

Starts the Vite dev server with SSR and HMR, until interrupted.

```sh
lumen dev --port 3000
lumen dev --format json   # one line once listening: { "command": "dev", "ok": true, "url": "http://localhost:5173/", "urls": { "local": [...], "network": [...] } }
```

Like Vite, the server stops when its stdin ends; start it with an open stdin when it runs in the
background.

## lumen build

Builds the client and server bundles into `dist/`, then prerenders the `static` routes.

```sh
lumen build --format json   # { outDir, clientDir, serverEntry, prerendered: [{ path, file, kind }] }
```

Route errors (`LUM5002`, `LUM5003`, `LUM5005`) and compile errors exit 1.

## lumen preview

Serves the build output with `@lumen/adapter-node` (a dependency of the project), until interrupted.
Every response, static files included, gets Vite's `preview.headers` from the project's
`vite.config.*`, which default to `server.headers` (as with `vite preview`), so headers configured
for `lumen dev`, such as COOP/COEP, apply in the preview too
([adapter `headers`](./adapter-node.md#createhandler)).
`--format json` prints one line once listening: `{ "command": "preview", "ok": true, "url" }`.

## lumen check

Type-checks the project: runs typegen (`.lumen/types/routes.d.ts`), writes shadow TSX files for
every `.stsx` (`.lumen/shadow/`; also those of used Lumen packages when the tsconfig extends
`.lumen/tsconfig.generated.json`, as the template does, see
[tsconfig](./jsx.md#imports-outside-src-and-stsx-from-other-packages)), writes the generated
tsconfig, runs `tsc --noEmit -p tsconfig.json`, maps shadow positions back
to the `.stsx` sources (same line and UTF-16 column), and merges scanner, route, tsconfig and
compiler diagnostics for `.stsx` and `.tsx` files (such as `LUM1006` for a `<style>` block in a
`.tsx` file). For style diagnostics, the modules that `$` constants are imported from are resolved
like TypeScript resolves them (relative paths, tsconfig `paths`, package `exports`). Route
diagnostics use the project's default mode from `lumen({ mode })`.

```sh
lumen check
lumen check --format json   # { command, ok, diagnostics: [...], summary: { errors, warnings, hints, files } }
```

Each JSON diagnostic has `source` (`ts`, `lumen`, `oxlint`, `stylelint`), `code`, `severity`,
`file`, `line`, `column`, `endLine`, `endColumn`, `message`, and optional `help`, `docs` and
`fix`. A `fix` is `{ message, edits: [{ line, column, endLine, endColumn, text }] }`, with the same
positions as diagnostics; apply all its edits together.

## lumen typegen

Writes the route types (`.lumen/types/routes.d.ts`), the generated tsconfig
(`.lumen/tsconfig.generated.json`) and syncs the shadow TSX files (`.lumen/shadow/`), without
type-checking: what a bare `tsc` or an editor needs.

```sh
lumen typegen --format json   # { routeTypes: { file, changed }, routes, shadows: { dir, files, written, deleted }, diagnostics, summary }
```

## lumen routes

Lists the routes in match order, with their kind, mode (from the route, its layouts or the project
default `lumen({ mode })`) and layouts. `spa (shell)` marks a `spa` page with `ssr = false`.

```sh
$ lumen routes
Routes in src/routes (default mode: static): 2 pages, 1 endpoint

PATTERN        KIND      MODE    FILE                LAYOUTS
/              page      static  index.stsx          _layout.stsx
/api/search    endpoint  server  api/search.ts
/blog/[slug]   page      server  blog/[slug].stsx    _layout.stsx, blog/_layout.stsx

$ lumen routes --format json   # { routesDir, defaultMode, routes: [{ pattern, file, kind, mode, ssr?, layouts, params }], diagnostics, summary }
```

Paths in JSON are project-relative. Exits 1 when the routes have errors.

## lumen lint

Runs oxlint on the project, including `.stsx` files (through their shadow TSX, with diagnostics
inside style blocks dropped), and, when the project installs and configures stylelint, on each
block's CSS with `$` references replaced by same-length identifiers. The JSON report has the shape
of `lumen check`'s.

## lumen fmt

```sh
lumen fmt [paths...]        # default path: src
lumen fmt --check
lumen fmt --check --format json   # { check, files: [{ file, status, warnings, error? }], summary: { files, formatted, errors } }
```

Formats `.stsx` files: the TSX with oxfmt (each block replaced by a placeholder), then each block's
CSS separately with its `$` references protected, then re-indents and stitches the file together.
With `--check`, a `formatted` file is one that is not formatted yet.

## lumen docs

```sh
lumen docs                  # the docs index
lumen docs signals          # a topic by name...
lumen docs concepts/signals # ...or by path
lumen docs LUM2001          # a diagnostic page (also errors/LUM2001, diagnostics/LUM2001)
lumen docs bind:value       # no topic matches: search, best matches first
lumen docs --format json    # { topics: [{ topic, title, summary }] }
lumen docs signals --format json   # { topic, title, summary, related, content }
lumen docs "await island" --format json   # { query, results: [{ topic, title, score, snippet }] }
```

Prints the version-matched docs from `node_modules/lumen/docs`. A bare name prefers concepts over
reference pages and lists the other matches. A search requires every term to occur in a page.
Exits 1 when nothing matches.

## lumen explain

```sh
lumen explain LUM3010
lumen explain lum3010 --format json   # { code, title, severity, category, topic, content }
```

Prints the long-form explanation of a diagnostic code: what it means, an example, and how to fix
it. Exits 1 for an unknown code and 2 for text that is not a code.

## lumen agents init

```sh
lumen agents init
lumen agents init --format json   # { files: [{ file, action: "created" | "updated" | "unchanged" }] }
```

Makes an existing project agent-ready, as `create-lumen` does for new ones: a Lumen section in
`AGENTS.md` (between `<!-- lumen:start … -->` and `<!-- lumen:end -->`, pointing at
`node_modules/lumen/docs`, the `.stsx` format, the key rules and `lumen check`), a `CLAUDE.md`
that references `@AGENTS.md`, the `lumen` skill (`.claude/skills/lumen/SKILL.md`) and the
`*.stsx linguist-language=TSX` line in `.gitattributes`, and a `tsconfig.json` that extends
`.lumen/tsconfig.generated.json` when the project has none (an existing one is left alone).
Re-running it updates only those parts.

## lumen mcp

```sh
lumen mcp
claude mcp add lumen -- npx lumen mcp   # register it with Claude Code
```

Starts the MCP server on stdio for coding agents: the tools `docs_search`, `docs_get`, `check`,
`routes`, `components`, `compile`, `render` and `dev_logs`, and the docs and the route manifest as
resources. It runs until the client disconnects. See [MCP server](mcp.md).

## Planned commands

`lumen upgrade` is designed (spec §3) but not available yet.
