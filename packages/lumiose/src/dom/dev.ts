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
 * False in builds, like `DEV`, so they drop every guarded call.
 */
// Truthy rather than `true`: Vitest reads `import.meta.env` from process.env, as strings.
export const INSPECTED: boolean =
  DEV &&
  !!(import.meta.env as { LUMIOSE_INSPECTOR?: boolean | string } | undefined)?.LUMIOSE_INSPECTOR;
