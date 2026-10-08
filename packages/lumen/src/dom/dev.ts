// Development flag for runtime diagnostics. Vite replaces `import.meta.env` at build time; the
// global typing below keeps `lumen` type-checkable for consumers without `vite/client` or
// `lumen/env` types (identical declarations merge with theirs).
declare global {
  interface ImportMetaEnv {
    DEV: boolean;
  }
  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

export const DEV: boolean = import.meta.env?.DEV === true;
