# Compiler and diagnostics

> A Rust compiler (OXC and Lightning CSS) turns `.stsx` and `.tsx` into fine-grained client code or string-concatenating server code. Every rule it enforces has a stable `LUMxxxx` code with a docs page.

## Concept

**Pipeline.** For each `.stsx`/`.tsx` module the Vite plugin calls the compiler, which:

1. **scans** the file for `<style>` blocks and masks them (replaces them with spaces, keeping every
   offset), so the rest is valid TSX;
2. parses and analyses the TSX: components, props, compiled idioms, `await` sites, islands and
   `$name` references;
3. compiles the CSS (scoping by placement, `$name` substitution, constant math folding, targets,
   minification);
4. generates JS for the **client** (cloned templates, bindings, delegated events) or the **server**
   (string concatenation with escaping), with source maps. Types are stripped.

Vite's own JSX transform is disabled for Lumiose files, and `node_modules` is excluded.

**The masking invariant.** Masked TSX parses as valid TSX with identical offsets. Tools rely on it:
TypeScript type-checks _shadow files_ (`.lumiose/shadow/<path>.stsx.tsx`, the masked text), so
errors map back to the same line and column of the `.stsx`. `$name` references stay in place as
real TS expressions (`$radius.lg` becomes `{radius.lg}` inside JSX, `;radius.lg;` at top level), so
TypeScript checks them too.

**Scanner rules.**

- `<style` must be followed by whitespace or `>`; it is recognised wherever a JSX element can
  start. Inside JSX text, quotes (as in `Don't`) do not start strings.
- The only attribute is `global`; content runs to the first `</style>`.
- A `<style>` inside `<svg>` is native SVG CSS: emitted verbatim and unscoped.

**Diagnostics.** Every diagnostic has the shape
`{ code, severity, message, span, labels, help, fix?, docs }`. Codes are stable forever and never
reused; the compiler's registry is the source of truth, and the [error pages](../errors/README.md)
are generated from it. They appear in the Vite overlay, in `lumiose check`, in the editor and in
`--format json` output.

| Range | Area                                                                        |
| ----- | --------------------------------------------------------------------------- |
| 1xxx  | File format: syntax, scanner, `<style>` blocks                              |
| 2xxx  | Reactivity: stale values, writes during render, early returns               |
| 3xxx  | Styles: placement, `$name` references, unused CSS                           |
| 4xxx  | Islands and boundaries: exports, serialization, server-only code, hydration |
| 5xxx  | Routing and server: route files, prerender, streaming                       |

**Tooling on top.** `lumiose check` (typegen, shadow files, `tsc --noEmit`, scanner and compiler
diagnostics), `lumiose lint` (oxlint on shadows, optional stylelint on blocks), `lumiose fmt` (oxfmt
plus each block's CSS), and the language server (a TypeScript LSP proxy plus CSS features in
blocks, the compiler's diagnostics as you type and each JSX expression's execution contract in
hovers) all share the one scanner. TypeScript plugins
are not used.

## API

| API                                   | Use                                                  |
| ------------------------------------- | ---------------------------------------------------- |
| `lumiose check [--format json]`       | Type-check and report diagnostics; exit 1 on errors. |
| `lumiose explain <code>`              | Print a diagnostic's explanation.                    |
| `lumiose docs <topic>`                | Print or search these docs.                          |
| `lumiose/vite`                        | The plugin that runs the compiler in Vite.           |
| `.lumiose/shadow/`, `.lumiose/types/` | Generated shadow TSX and route types (git-ignored).  |

## Example

```stsx check
// The masked view TypeScript sees: the block becomes spaces, `$pad` stays as `{pad}`.
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

```sh
$ lumiose check --format json
{ "command": "check", "ok": true, "diagnostics": [], "summary": { "errors": 0, "warnings": 0, "hints": 0, "files": 0 } }
$ lumiose explain LUM3010
```

## Common mistakes

- **Running bare `tsc` without shadow files.** `import "./X.stsx"` only resolves after shadows
  exist. Run `lumiose check` (or `lumiose typegen`), or keep the dev server or editor running.
- **A `tsconfig.json` that neither extends `.lumiose/tsconfig.generated.json` nor sets `rootDirs`
  and `.lumiose/shadow`.** `lumiose check` reports the missing options (`LUM6001`); extend the
  generated file ([tsconfig](../reference/jsx.md#tsconfigjson)).
- **Importing `.stsx` across `src/` or from a workspace package with a standalone tsconfig.** Its
  `rootDirs` only pair `src`. Extend `.lumiose/tsconfig.generated.json` instead
  ([tsconfig](../reference/jsx.md#imports-outside-src-and-stsx-from-other-packages)).
- **Ignoring a code because the message is short.** Run `lumiose explain <code>` for the cause and
  the fix.
- **Expecting TypeScript plugins.** Lumiose uses stock `tsc` and a language server; there is no TS
  plugin to configure.

## Related diagnostics

- [LUM1001](../errors/LUM1001.md): syntax error.
- [LUM1002](../errors/LUM1002.md): unsupported by this compiler version.
- [LUM1003](../errors/LUM1003.md): scanner ambiguity.
- [All diagnostics](../errors/README.md).

See also: [Styles](styles.md), [reference: CLI](../reference/cli.md).
