# Compiler and diagnostics

> A Rust compiler turns `.stsx` and `.tsx` files into fine-grained DOM code for the browser and string-building code for the server.

## Concept

### One file in

The compiler masks each `<style>` block with spaces, so the rest of the file is valid TSX at the
same offsets. `$pad` stays in place as a TypeScript expression, so TypeScript checks it too.

```stsx check
export function Box() {
  const pad = "1rem";
  return (
    <div class="box">
      Content
      <style>
        .box { padding: $pad; }
      </style>
    </div>
  );
}
```

> **Details:** the pipeline, the masking invariant, the scanner rules and the tools built on them:
> [How the compiler works](../reference/vite.md#how-the-compiler-works).

### Diagnostics out

Every problem has a stable code, in the Vite overlay, `lumiose check` and the editor. The first
digit names the area, and each code has a [page](../errors/README.md).

| Range | Area                                                                        |
| ----- | --------------------------------------------------------------------------- |
| 1xxx  | File format: syntax, scanner, `<style>` blocks                              |
| 2xxx  | Reactivity: stale values, writes during render, early returns               |
| 3xxx  | Styles: placement, `$name` references, unused CSS                           |
| 4xxx  | Islands and boundaries: exports, serialization, server-only code, hydration |
| 5xxx  | Routing and server: route files, prerender, streaming                       |
| 6xxx  | Tooling and config: the project's tsconfig                                  |

## API

| API                                   | Use                                                  |
| ------------------------------------- | ---------------------------------------------------- |
| `lumiose check [--format json]`       | Type-check and report diagnostics; exit 1 on errors. |
| `lumiose explain <code>`              | Print a diagnostic's explanation.                    |
| `lumiose docs <topic>`                | Print or search these docs.                          |
| `@lumiose/vite`                       | The plugin that runs the compiler in Vite.           |
| `.lumiose/shadow/`, `.lumiose/types/` | Generated shadow TSX and route types (git-ignored).  |

## Example

Check the project, then ask what a code means.

```sh
$ lumiose check --format json
{ "command": "check", "ok": true, "diagnostics": [], "summary": { "errors": 0, "warnings": 0, "hints": 0, "files": 0 } }
$ lumiose explain LUM3010
```

## Common mistakes

Each in full: [How the compiler works](../reference/vite.md#how-the-compiler-works).

- **Running bare `tsc`.** `.stsx` imports resolve only once `lumiose check` wrote the shadow files.
- **A `tsconfig.json` that does not extend `.lumiose/tsconfig.generated.json`** (`LUM6001`), also
  for `.stsx` imported from outside `src/`: [tsconfig](../reference/jsx.md#tsconfigjson).
- **Ignoring a short message.** `lumiose explain <code>` gives the cause and the fix.
- **Expecting TypeScript plugins.** There is none to configure.

## Related diagnostics

- [LUM1001](../errors/LUM1001.md): syntax error.
- [LUM1002](../errors/LUM1002.md): unsupported by this compiler version.
- [LUM1003](../errors/LUM1003.md): scanner ambiguity.
- [All diagnostics](../errors/README.md).

See also: [Styles](styles.md), [reference: CLI](../reference/cli.md).
