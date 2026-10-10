// VS Code platform targets of the .vsix (`vsce package --target`) and the napi-rs platform suffix
// of the native compiler binary each one ships (packages/compiler: compiler.<suffix>.node). Only
// targets that @lumiose/compiler builds for (its package.json "napi.targets") are listed.

export const NAPI_PLATFORMS = {
  "darwin-arm64": "darwin-arm64",
  "darwin-x64": "darwin-x64",
  "linux-x64": "linux-x64-gnu",
  "linux-arm64": "linux-arm64-gnu",
  "win32-x64": "win32-x64-msvc",
} as const;

export type Target = keyof typeof NAPI_PLATFORMS;

function isTarget(value: string): value is Target {
  return Object.hasOwn(NAPI_PLATFORMS, value);
}

/** This machine's target. Exits on platforms without a compiler build. */
export function hostTarget(): Target {
  const target = `${process.platform}-${process.arch}`;
  if (isTarget(target)) return target;
  console.error(`No Lumiose compiler build for ${target}; pass --target.`);
  process.exit(1);
}

/** The `--target <t>` (or `--target=<t>`) argument, validated; undefined when absent. */
export function parseTarget(argv: readonly string[]): Target | undefined {
  const at = argv.findIndex((arg) => arg === "--target" || arg.startsWith("--target="));
  if (at === -1) return undefined;
  const value = argv[at]!.includes("=") ? argv[at]!.slice("--target=".length) : argv[at + 1];
  if (value !== undefined && isTarget(value)) return value;
  console.error(`--target must be one of ${Object.keys(NAPI_PLATFORMS).join(", ")}.`);
  process.exit(1);
}
