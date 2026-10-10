<!-- Generated from crates/lumiose_compiler/src/diagnostics/registry.rs by packages/lumiose/scripts/gen-error-docs.ts. Edit the explanation below the end marker. -->

# Diagnostics

> Every `LUMxxxx` code the Lumiose tools report, with its long-form explanation.

Codes are stable forever and never reused. Print one with `lumiose explain LUM1004`, or open
`errors/LUM1004.md`. Each diagnostic carries `{ code, severity, message, span, labels, help,
fix?, docs }`; `lumiose check --format json` prints them.

## File format (1xxx)

| Code                  | Severity | Title                                |
| --------------------- | -------- | ------------------------------------ |
| [LUM1001](LUM1001.md) | error    | Syntax error                         |
| [LUM1002](LUM1002.md) | error    | Unsupported by this compiler version |
| [LUM1003](LUM1003.md) | warning  | Scanner ambiguity                    |
| [LUM1004](LUM1004.md) | error    | Unclosed `<style>` block             |
| [LUM1005](LUM1005.md) | error    | Unknown `<style>` attribute          |
| [LUM1006](LUM1006.md) | error    | Raw CSS in a `.tsx` file             |
| [LUM1007](LUM1007.md) | error    | `await using` in a component         |
| [LUM1008](LUM1008.md) | error    | `<script>` in a Markdown file        |
| [LUM1009](LUM1009.md) | error    | Content nested too deeply            |
| [LUM1010](LUM1010.md) | error    | Source nested too deeply             |

## Reactivity (2xxx)

| Code                  | Severity | Title                               |
| --------------------- | -------- | ----------------------------------- |
| [LUM2001](LUM2001.md) | warning  | Stale derived value                 |
| [LUM2002](LUM2002.md) | error    | Signal write during render          |
| [LUM2003](LUM2003.md) | error    | Reactive early return               |
| [LUM2004](LUM2004.md) | error    | Component called as a function      |
| [LUM2005](LUM2005.md) | warning  | Children inserted twice             |
| [LUM2006](LUM2006.md) | warning  | Reactive index escapes its callback |
| [LUM2007](LUM2007.md) | warning  | Own signal read in an async body    |

## Styles (3xxx)

| Code                  | Severity | Title                                     |
| --------------------- | -------- | ----------------------------------------- |
| [LUM3005](LUM3005.md) | warning  | Unused scoped selector                    |
| [LUM3008](LUM3008.md) | error    | Non-constant `$` reference                |
| [LUM3009](LUM3009.md) | error    | Hyphenated `$` reference                  |
| [LUM3010](LUM3010.md) | error    | Misplaced `<style>` block                 |
| [LUM3011](LUM3011.md) | error    | `<style>` as the root or in an expression |
| [LUM3012](LUM3012.md) | warning  | Custom property set but never read        |
| [LUM3013](LUM3013.md) | error    | `$` reference before its declaration      |
| [LUM3014](LUM3014.md) | error    | CSS syntax error                          |
| [LUM3015](LUM3015.md) | warning  | Invalid CSS ignored                       |
| [LUM3016](LUM3016.md) | error    | Invalid `:global()` or `:deep()` selector |
| [LUM3017](LUM3017.md) | warning  | Invalid CSS value                         |
| [LUM3018](LUM3018.md) | warning  | Unitless number from a `$` reference      |
| [LUM3019](LUM3019.md) | warning  | Unit separated from a `$` reference       |
| [LUM3020](LUM3020.md) | warning  | Unknown CSS property                      |
| [LUM3021](LUM3021.md) | error    | Unsafe `$` constant value                 |

## Islands and boundaries (4xxx)

| Code                  | Severity | Title                                  |
| --------------------- | -------- | -------------------------------------- |
| [LUM4001](LUM4001.md) | error    | Island component is not exported       |
| [LUM4002](LUM4002.md) | error    | Non-serializable island prop           |
| [LUM4003](LUM4003.md) | error    | Server-only module in a client graph   |
| [LUM4004](LUM4004.md) | warning  | Browser API at module scope            |
| [LUM4006](LUM4006.md) | error    | Hydration mismatch                     |
| [LUM4007](LUM4007.md) | error    | Non-serializable awaited value         |
| [LUM4008](LUM4008.md) | warning  | Module-scope signal written during SSR |
| [LUM4009](LUM4009.md) | warning  | Unsafe URL blocked in a URL attribute  |

## Routing and server (5xxx)

| Code                  | Severity | Title                                            |
| --------------------- | -------- | ------------------------------------------------ |
| [LUM5001](LUM5001.md) | error    | Request API used during prerender                |
| [LUM5002](LUM5002.md) | error    | Invalid route file                               |
| [LUM5003](LUM5003.md) | error    | Duplicate route                                  |
| [LUM5004](LUM5004.md) | error    | Head or status change inside a streamed boundary |
| [LUM5005](LUM5005.md) | error    | Non-GET method in a static endpoint              |

## Tooling and config (6xxx)

| Code                  | Severity | Title                                        |
| --------------------- | -------- | -------------------------------------------- |
| [LUM6001](LUM6001.md) | warning  | tsconfig missing options required by Lumiose |
