// `.md` and `.html` imports as components (decision-22, TASK-69; owner: Halo, in Photon's plugin).

/** `lumen({ md })`: Markdown imports. */
export interface MarkdownOptions {
  /**
   * Validates or transforms each file's frontmatter at build time; the returned value is the
   * module's `frontmatter` export (`undefined` keeps `data`). Throwing fails the build with the
   * file's name. May be async.
   *
   * @example frontmatter: (data) => PostSchema.parse(data)
   */
  frontmatter?: (data: Record<string, unknown>, context: { file: string }) => unknown;
}

/** Validated `lumen({ md, html })`. */
export interface ContentOptions {
  md: false | MarkdownOptions;
  html: boolean;
}

/** Validates `lumen({ md, html })`. */
export function contentOptionsOf(md: unknown, html: unknown): ContentOptions {
  if (html !== undefined && typeof html !== "boolean") {
    throw new TypeError(`lumen({ html }): expected true or false, got ${describe(html)}.`);
  }
  const options: ContentOptions = { md: false, html: html ?? false };
  if (md === undefined || md === false) return options;
  if (md === true) return { ...options, md: {} };
  if (!isObject(md)) {
    throw new TypeError(
      `lumen({ md }): expected true, false or { frontmatter }, got ${describe(md)}.`,
    );
  }
  for (const [key, value] of Object.entries(md)) {
    if (key !== "frontmatter") {
      throw new TypeError(`lumen({ md.${key} }): unknown option. Known options: frontmatter.`);
    }
    if (value !== undefined && typeof value !== "function") {
      throw new TypeError(
        `lumen({ md.frontmatter }): expected a function, got ${describe(value)}.`,
      );
    }
  }
  return { ...options, md: md as MarkdownOptions };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return "an array";
  if (typeof value === "function") return "a function";
  if (value === null || typeof value !== "object") return String(value);
  return "an object";
}
