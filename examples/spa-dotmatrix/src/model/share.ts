// Share links: the song travels in the URL itself (`/?song=…`): compact JSON, deflated with the
// browser's CompressionStream and base64url-encoded. Nothing is uploaded anywhere.
import { sanitizeSong } from "./song.ts";
import type { Song } from "./types.ts";

const VERSION = "1";

/** Notes become flat [step, length, pitch, …] arrays: about a third of the size. */
function compact(song: Song): unknown {
  return {
    ...song,
    tracks: song.tracks.map((t) => ({ ...t, notes: t.notes.flatMap((n) => [n.s, n.l, n.p]) })),
  };
}

function expand(data: { tracks?: { notes?: unknown }[] }): unknown {
  if (!Array.isArray(data.tracks)) return data;
  return {
    ...data,
    tracks: data.tracks.map((t) => {
      const flat = Array.isArray(t?.notes) ? (t.notes as number[]) : [];
      const notes = [];
      for (let i = 0; i + 2 < flat.length; i += 3)
        notes.push({ s: flat[i], l: flat[i + 1], p: flat[i + 2] });
      return { ...t, notes };
    }),
  };
}

async function pipe(
  bytes: Uint8Array,
  stream: CompressionStream | DecompressionStream,
): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function encodeSong(song: Song): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(compact(song)));
  return `${VERSION}.${toBase64Url(await pipe(json, new CompressionStream("deflate-raw")))}`;
}

/** Decodes and validates a shared song; throws on anything that is not one. */
export async function decodeSong(code: string): Promise<Song> {
  const [version, body] = code.split(".");
  if (version !== VERSION || !body) throw new Error("Unknown share link format");
  const bytes = await pipe(fromBase64Url(body), new DecompressionStream("deflate-raw"));
  if (bytes.length > 512 * 1024) throw new Error("Shared song is too large");
  return sanitizeSong(expand(JSON.parse(new TextDecoder().decode(bytes)) as never));
}
