# Type checking and editors

> TypeScript checks `.stsx` files through shadow TSX files that `stsx typegen` and the Vite plugin write to `.lumiose/stsx`. The Lumiose language server and VS Code extension give `.stsx` files TypeScript and CSS features in any project.

## Shadows

TypeScript does not know `.stsx`. For each `.stsx` file, a TSX copy (the "shadow") is written to
`.lumiose/stsx/<the file's path>.stsx.tsx`. Its style blocks are blanked out and every other
character keeps its position, so the shadow type-checks like the component and every line and
column matches the `.stsx` file. With `rootDirs`, `import "./Card.stsx"` resolves to the shadow:

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "rootDirs": [".", ".lumiose/stsx"],
  },
  "include": ["src", ".lumiose/stsx"],
}
```

- **Who writes them.** The Vite plugin writes every shadow when the dev server or a build starts,
  and rewrites a file's shadow when you edit it. `stsx typegen` writes them all and removes those
  of deleted files, for CI and other scripts.
- **The tsconfig hint.** Without the `rootDirs` entry, `stsx typegen` prints the line to add.
- **Version control.** Add `.lumiose/` to `.gitignore`: the shadows are generated.
- **Another directory.** Name it `stsx` in `rootDirs`, as in `[".", ".types/stsx"]`. The plugin and
  `stsx typegen` use it; the language server reads `.lumiose/stsx` only.

```sh
stsx typegen && tsc
```

`tsc` names the shadow in its errors (`.lumiose/stsx/src/Card.stsx.tsx(12,7)`), at the line and
column of the `.stsx` file.

## Constants in CSS

`$name` references in style blocks become expressions in the shadow, so TypeScript checks them
too: a missing export or member (`var($vars.brnd)`) is a type error at the reference, and go to
definition and rename work on it.

## Editors

The Lumiose VS Code extension handles `.stsx` files in any project; other editors run
`@lumiose/language-server`, which it bundles. In a project that depends on `@lumiose/stsx` and
not on `lumiose`, the server runs in **stsx mode**:

- **TypeScript:** completion, hover, go to definition, references, rename and type errors,
  through the shadows;
- **CSS** in style blocks: completion, hover, colors and syntax errors;
- **Class names** between the JSX (`class`, `className`, Solid's `classList`) and the blocks:
  completion, go to definition, rename and unused-selector warnings;
- **None of Lumiose's own checks:** no reactivity or island diagnostics and no
  execution-contract hovers, since your framework's JSX is not Lumiose's.

GitHub highlights `.stsx` as TSX with a line in `.gitattributes`:

```text
*.stsx linguist-language=TSX
```
