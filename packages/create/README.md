# create-lumiose

Creates a [Lumiose](https://itsjavi.com/lumiose/) app.

```sh
npm create lumiose@latest my-app
pnpm create lumiose my-app --template ssr
```

| Template  | What you get                                                |
| --------- | ----------------------------------------------------------- |
| `minimal` | One page                                                    |
| `static`  | A layout, pages, a blog with `staticPaths()` and a 404 page |
| `ssr`     | Streaming, a form action, a JSON endpoint and a Node server |
| `spa`     | Pages and a persistent layout rendered in the browser       |

Every project starts agent-ready: `AGENTS.md`, `CLAUDE.md` and the `lumiose` skill. `--mcp` also
registers the Lumiose MCP server for Claude Code and Codex. `create-lumiose --help` lists every
option (`--yes`, `--force`, `--mcp`, `--format json`).

Every template sets `lumiose({ csp: "strict" })` in `vite.config.ts`: a strict Content Security
Policy from the first page ([Security](https://itsjavi.com/lumiose/docs/concepts/security/)).

Next: [Getting started](https://itsjavi.com/lumiose/docs/getting-started/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
