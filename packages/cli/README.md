# @lumiose/cli

The `lumiose` command for [Lumiose](https://itsjavi.com/lumiose/) projects.

```sh
pnpm add -D @lumiose/cli
```

| Command                     | What it does                                                     |
| --------------------------- | ---------------------------------------------------------------- |
| `lumiose dev`               | The dev server                                                   |
| `lumiose build`             | The production build                                             |
| `lumiose preview`           | Serves the build locally                                         |
| `lumiose check`             | Types and compiler diagnostics for the whole project             |
| `lumiose lint`, `fmt`       | oxlint and oxfmt, with `.stsx` support                           |
| `lumiose typegen`, `routes` | Generated route types; the route table                           |
| `lumiose docs <topic>`      | The docs of the installed version, in the terminal               |
| `lumiose explain <code>`    | The long explanation of a `LUMxxxx` diagnostic                   |
| `lumiose agents init`       | `AGENTS.md`, `CLAUDE.md` and the Lumiose skill for coding agents |
| `lumiose mcp`               | The docs and diagnostics as an MCP server                        |

Every command and option: [CLI reference](https://itsjavi.com/lumiose/docs/reference/cli/).

## License

[MIT](https://github.com/itsjavi/lumiose/blob/main/LICENSE)
