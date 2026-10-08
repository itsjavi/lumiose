# CLI

> The `lumen` command: `check`, `lint`, `fmt`, `docs` and `explain`, with `--format json` and stable exit codes.

```sh
lumen <command> [options]
```

Exit codes: `0` success, `1` problems found (errors, unformatted files, nothing found), `2` the
tool itself failed or was misused.

| Option                        | Applies to                 | Meaning                                                       |
| ----------------------------- | -------------------------- | ------------------------------------------------------------- |
| `--root <dir>`                | check, lint, fmt           | Project root (default: the current directory).                |
| `-p, --project <file>`        | check                      | tsconfig path relative to the root (default `tsconfig.json`). |
| `--format human \| json`      | check, lint, docs, explain | Output format (default `human`).                              |
| `--check`                     | fmt                        | List unformatted files and exit 1 instead of writing.         |
| `-h, --help`, `-v, --version` |                            | Help and version.                                             |

## lumen check

Type-checks the project: runs typegen (`.lumen/types/routes.d.ts`), writes shadow TSX files for
every `.stsx` (`.lumen/shadow/`), runs `tsc --noEmit -p tsconfig.json`, maps shadow positions back
to the `.stsx` sources (same line and UTF-16 column), and merges scanner, route, tsconfig and
compiler diagnostics. For style diagnostics, the modules that `$` constants are imported from are
resolved like TypeScript resolves them (relative paths, tsconfig `paths`, package `exports`).

```sh
lumen check
lumen check --format json   # { diagnostics: [...], summary: { errors, warnings, hints, files } }
```

Each JSON diagnostic has `source` (`ts`, `lumen`, `oxlint`, `stylelint`), `code`, `severity`,
`file`, `line`, `column`, `endLine`, `endColumn`, `message`, and optional `help` and `docs`.

## lumen lint

Runs oxlint on the project, including `.stsx` files (through their shadow TSX, with diagnostics
inside style blocks dropped), and, when the project installs and configures stylelint, on each
block's CSS with `$` references replaced by same-length identifiers.

## lumen fmt

```sh
lumen fmt [paths...]        # default path: src
lumen fmt --check
```

Formats `.stsx` files: the TSX with oxfmt (each block replaced by a placeholder), then each block's
CSS separately with its `$` references protected, then re-indents and stitches the file together.

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

## Planned commands

`lumen dev`, `build`, `preview`, `typegen`, `routes`, `mcp`, `agents init` and `upgrade` are
designed (spec §3, §10) and in progress; they are not in this version.
