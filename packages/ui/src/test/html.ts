// Helpers for the server-HTML tests of the components.

/** The attributes of the first `<tag …>` in `html` (or of the first that `match` accepts). */
export function attrs(
  html: string,
  tag: string,
  match: (attributes: Record<string, string>) => boolean = () => true,
): Record<string, string> {
  for (const [, body] of html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, "g"))) {
    const out: Record<string, string> = {};
    for (const [, name, value] of body!.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)) {
      out[name!] = value ?? "";
    }
    if (match(out)) return out;
  }
  throw new Error(`no matching <${tag}> in ${html}`);
}
