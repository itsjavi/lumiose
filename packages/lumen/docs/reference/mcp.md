# MCP server

> `lumen mcp` serves the project to coding agents over the Model Context Protocol: version-matched docs, `lumen check` diagnostics with fixes, routes, component metadata, compiler output, server-rendered HTML and dev server logs.

`lumen mcp` starts a stdio MCP server for the project in the current directory (or `--root`). It
gives an agent the same answers as the CLI, as structured tool results, without parsing terminal
output. Related: [CLI](cli.md), [Compiler and diagnostics](../concepts/compiler.md).

## Register it

The agent starts the server itself; run these once in the project directory.

```sh
# Claude Code (add --scope project to write .mcp.json and share it with the team)
claude mcp add lumen -- npx lumen mcp

# Codex
codex mcp add lumen -- npx lumen mcp
```

Agents configured with a JSON file (Claude Code's `.mcp.json`, Cursor's `.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "lumen": { "command": "npx", "args": ["lumen", "mcp"] }
  }
}
```

VS Code (`.vscode/mcp.json`):

```json
{
  "servers": {
    "lumen": { "type": "stdio", "command": "npx", "args": ["lumen", "mcp"] }
  }
}
```

The server runs until the agent disconnects. It exits with `2` when the project root does not
exist. stdout carries the protocol; console output of app code goes to stderr and to `dev_logs`.

## Tools

| Tool          | Input                                                 | Returns                                                                                                                                                                                                                                                                      |
| ------------- | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs_search` | `query`, `limit?` (10)                                | `{ query, results: [{ topic, title, summary, score, snippet }] }`, best first; every term must occur in a page.                                                                                                                                                              |
| `docs_get`    | `topic`                                               | The page as Markdown. A topic is a path (`concepts/signals`), a bare name (`signals`), a code (`LUM2001`) or `""` for the index. An exported name (`fetchJSON`) returns its reference section.                                                                               |
| `check`       | `files?`, `project?`                                  | `lumen check` as `{ ok, summary, diagnostics, notes? }`. With `files`, only their diagnostics, and `projectSummary` for the whole project.                                                                                                                                   |
| `routes`      | none                                                  | `lumen routes --format json`: `{ routesDir, defaultMode, routes: [{ pattern, file, kind, mode, ssr?, layouts, params }], diagnostics, summary }`.                                                                                                                            |
| `components`  | `file?`                                               | `{ files: [{ file, components, islands, fileScope, hasStyles, errors }] }` for one file, or for every `.stsx`/`.tsx` file under `src/`.                                                                                                                                      |
| `compile`     | `file?` or `source`, `target?` (`both`)               | `{ file, client: { code, css, cssDeps }, server: { code }, diagnostics }`: what the Vite plugin compiles, without source maps.                                                                                                                                               |
| `render`      | `path`, `method?`, `headers?`, `maxLength?`, `strip?` | `{ url, status, headers, body, truncated }` from an in-process dev server. Redirects are returned, not followed. `strip: true` returns only the visible markup of an HTML page (no scripts, styles, link/meta tags, templates, hydration comments or `data-l-*` attributes). |
| `dev_logs`    | `since?`, `level?`, `limit?` (100)                    | `{ available, entries: [{ id, time, level, source, message }] }`: the logs of the dev server that `render` started.                                                                                                                                                          |

- **Diagnostics** (`check`, `compile`, `components`) have the shape of `lumen check --format json`:
  `source`, `code`, `severity`, `file`, 1-based `line`/`column`/`endLine`/`endColumn`, `message`,
  and optional `help`, `docs` (a topic for `docs_get`) and `fix`. A `fix` is
  `{ message, edits: [{ line, column, endLine, endColumn, text }] }`; apply all its edits together.
- **Components** list each component's `name`, `exported`, `async`, `location`, `props` and
  `styleScopes`. `props` is the first parameter as written (`{ parameter: "props: CardProps" }`),
  plus the `type` declaration when the props type is an interface or type alias of the same file;
  it is `null` for a component without props. `styleScopes` are the `data-l-*` attributes of the
  elements that hold `<style>` blocks. `islands` are the file's `client:*` call sites with their
  `ref`, `module`, `export` and `strategy`.
- **`compile`** takes the file's text from `source` when given (the file need not exist), and
  folds `$` constants imported from other modules like the build does.
- **`render`** starts the dev server on first use, on a free port of `127.0.0.1`, and keeps it
  running: later calls see file changes like `lumen dev` does. Pages return their HTML; endpoints
  their response body. Render errors return the dev error page, and their details are in
  `dev_logs`.
- **`dev_logs`** returns `available: false` with an explanation until `render` started the dev
  server: the logs of a `lumen dev` started in a terminal are not visible to the MCP server. Pass
  the last `id` you saw as `since` to read only newer entries; `level` is the minimum (`info`,
  `warn`, `error`); `source` is `vite` (the dev server and Lumen's plugins) or `console` (app
  code).

## Resources

| URI                    | Content                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `lumen://docs/<topic>` | Each docs page as Markdown, e.g. `lumen://docs/concepts/signals`. |
| `lumen://routes`       | The route manifest, as the `routes` tool returns it (JSON).       |

## Workflow for agents

1. Look the feature up: `docs_search`, then `docs_get` (the docs match the installed version).
2. Make the change.
3. `check` and fix every error; `docs_get` with a diagnostic's `docs` topic explains it.
4. `render` the affected routes to see the HTML; `dev_logs` with `level: "warn"` shows problems.
