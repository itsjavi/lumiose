// Shareable URLs: the playground's state lives in the URL hash, `#v1=<data>`, where data is the
// JSON state, deflated (CompressionStream "deflate-raw") and base64url-encoded. Nothing is sent to
// a server; the hash never leaves the browser.

export interface PlaygroundState {
  /** The `.stsx` source. */
  code: string;
  /** The open output tab. */
  tab?: string;
}

const PREFIX = "#v1=";

export async function encodeState(state: PlaygroundState): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return PREFIX + toBase64Url(await transform(bytes, new CompressionStream("deflate-raw")));
}

/** The state in a hash, or undefined when the hash holds none (or a damaged one). */
export async function decodeState(hash: string): Promise<PlaygroundState | undefined> {
  if (!hash.startsWith(PREFIX)) return undefined;
  try {
    const bytes = await transform(
      fromBase64Url(hash.slice(PREFIX.length)),
      new DecompressionStream("deflate-raw"),
    );
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof value !== "object" || value === null) return undefined;
    const { code, tab } = value as Record<string, unknown>;
    if (typeof code !== "string") return undefined;
    return typeof tab === "string" ? { code, tab } : { code };
  } catch {
    return undefined;
  }
}

async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array<ArrayBuffer>> {
  const output = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(output).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll("-", "+").replaceAll("_", "/"));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
