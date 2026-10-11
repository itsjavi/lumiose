// The version this site documents, from the lumiose package, for the hero's pre-release badge.
// Server-only: the pages prerender it.
import manifest from "../../../../packages/lumiose/package.json?raw";

export const version: string = (JSON.parse(manifest) as { version: string }).version;

/** Before 1.0.0 every release is a pre-release: the APIs may still change. */
export const prerelease = version.startsWith("0.");
