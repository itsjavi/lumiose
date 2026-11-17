// Code shown on the landing page. The hero's code panel shows `counterSource`, which is the source
// of the island that runs under it (islands/Counter.stsx, read as text): what the page shows is
// what this version of the compiler builds for it. content.test.ts compiles it too.
import { highlight } from "@lumiose/site-kit/highlight";
import counterSource from "../islands/Counter.stsx?raw";

export { counterSource };

/** The parts of the counter the hero underlines: where the signal is made, and where it is read. */
export const COUNTER_EMPHASIS = ["signal(0)", "count()"] as const;

/**
 * Wraps the first occurrence of each fragment of `source` in `<u>`, in the HTML a highlighter made
 * from it. A fragment may span several tokens: each run of text inside it gets its own `<u>`.
 */
export function emphasize(html: string, source: string, fragments: readonly string[]): string {
  const ranges = fragments.map((fragment) => {
    const start = source.indexOf(fragment);
    if (start < 0) throw new Error(`The sample does not contain "${fragment}".`);
    return [start, start + fragment.length] as const;
  });
  let offset = 0;
  let out = "";
  for (const part of html.split(/(<[^>]+>)/)) {
    if (part.startsWith("<")) {
      out += part;
      continue;
    }
    let open = false;
    // One unit of the HTML's text is one character of the source: an entity or a character.
    for (const [unit] of part.matchAll(/&[a-z]+;|[\s\S]/g)) {
      const inside = ranges.some(([start, end]) => offset >= start && offset < end);
      if (inside !== open) out += inside ? "<u>" : "</u>";
      open = inside;
      out += unit;
      offset += 1;
    }
    if (open) out += "</u>";
  }
  return out;
}

/** The counter's source as highlighted HTML, with its emphasis. */
export function counterHtml(): string {
  const source = counterSource.replace(/\n$/, "");
  return emphasize(highlight(source, "stsx"), source, COUNTER_EMPHASIS);
}

/** The closing box's install command (the docs list the other package managers). */
export const installCommand = "npm create lumiose@latest my-app";
