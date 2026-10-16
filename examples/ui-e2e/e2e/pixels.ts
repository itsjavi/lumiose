// The pixels of a Playwright screenshot, for what computed styles cannot tell: whether a native
// part (a `<progress>` bar, a `<meter>` value) paints at all. Reads the 8-bit RGB or RGBA,
// non-interlaced PNGs Playwright writes; nothing else.
import { inflateSync } from "node:zlib";

/** The screenshot's pixels, as `[r, g, b]` triples. */
export function pixels(png: Buffer): [number, number, number][] {
  let at = 8;
  let width = 0;
  let height = 0;
  let channels = 0;
  const data: Buffer[] = [];
  while (at < png.length) {
    const length = png.readUInt32BE(at);
    const type = png.toString("ascii", at + 4, at + 8);
    const body = png.subarray(at + 8, at + 8 + length);
    if (type === "IHDR") {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const [depth, colour, , , interlace] = body.subarray(8, 13);
      if (depth !== 8 || interlace !== 0 || (colour !== 2 && colour !== 6)) {
        throw new Error(`Unsupported PNG: depth ${depth}, colour type ${colour}`);
      }
      channels = colour === 6 ? 4 : 3;
    } else if (type === "IDAT") data.push(body);
    at += 12 + length;
  }
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const out = new Uint8Array(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    const row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? out[y * stride + x - channels]! : 0;
      const up = y > 0 ? out[(y - 1) * stride + x]! : 0;
      const corner = x >= channels && y > 0 ? out[(y - 1) * stride + x - channels]! : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - corner;
        const [pa, pb, pc] = [Math.abs(p - left), Math.abs(p - up), Math.abs(p - corner)];
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      out[y * stride + x] = (row[x]! + predicted) & 0xff;
    }
  }
  const result: [number, number, number][] = [];
  for (let i = 0; i < out.length; i += channels) result.push([out[i]!, out[i + 1]!, out[i + 2]!]);
  return result;
}

/** How many pixels have a hue: not white, black or a grey between them. */
export const chromatic = (png: Buffer) =>
  pixels(png).filter((rgb) => Math.max(...rgb) - Math.min(...rgb) > 40).length;
