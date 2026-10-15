// Development flag for runtime diagnostics. Vite replaces `import.meta.env` at build time; the
// global typing below keeps `lumiose` type-checkable for consumers without `vite/client` or
// `lumiose/env` types (identical declarations merge with theirs).
declare global {
  interface ImportMetaEnv {
    DEV: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const DEV: boolean = import.meta.env?.DEV === true;

/**
 * Whether the runtime reports to the in-page inspector's registry (./devtools.ts, decision-59):
 * `lumiose dev` defines `import.meta.env.LUMIOSE_INSPECTOR` unless `lumiose({ inspector: false })`.
 *
 * Guard every call as `if (import.meta.env?.DEV && INSPECTED)`. Vite's define turns the first
 * operand into a literal `false` in builds, so the bundler drops the call before it splits chunks;
 * `INSPECTED` alone is folded only later, after a chunk (an island's, holding a runtime module only
 * that island uses) may already have made another export the registry function it calls.
 */
// Truthy rather than `true`: Vitest reads `import.meta.env` from process.env, as strings.
export const INSPECTED: boolean =
  DEV &&
  !!(import.meta.env as { LUMIOSE_INSPECTOR?: boolean | string } | undefined)?.LUMIOSE_INSPECTOR;
