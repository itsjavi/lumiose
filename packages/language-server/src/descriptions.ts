// Descriptions of Lumiose syntax that TypeScript cannot document: `<style>` blocks (masked out of
// the TSX TypeScript sees) and the JSX attributes whose JSDoc TypeScript does not show (the
// `on:` members of a mapped type, and `key`, merged from two declarations). The other Lumiose
// attributes (`client:*`, `bind:*`, `ref`, `attach`) are documented by JSDoc in the JSX types.

export const STYLE_DOC = [
  "**`<style>`**: a Lumiose style block of plain CSS. Where it sits decides its scope:",
  "",
  "- inside JSX: its enclosing element and everything written inside that element;",
  "- at the file top level: every template in the file;",
  "- `<style global>`: the whole app, unscoped.",
  "",
  "`$name` and `$obj.key` read JS constants, inlined at build time.",
].join("\n");

export const GLOBAL_DOC = [
  "**`<style global>`**: unscoped, app-wide CSS. Its selectors are not rewritten, so they match",
  "every element of the app, and its classes are offered in every file of the project. Usually",
  "in the root `layout.stsx`. It is the only attribute a `<style>` block takes.",
].join("\n");

export const NATIVE_EVENT_DOC = [
  "`on:event={handler}`: a native `addEventListener` listener for the exact event name, on this",
  "element (not delegated). Use it for custom and web-component events (`on:my-event`); standard",
  "events also have `onClick`-style props, delegated for bubbling events.",
].join("\n");

export const KEY_DOC = [
  "`key`: the identity of a row in a `.map` list, so a reordered list moves rows instead of",
  "re-creating them. Optional: rows are keyed by item reference otherwise.",
].join("\n");

/**
 * The description of a Lumiose JSX attribute from TypeScript's hover or completion detail
 * (`(property) "on:click"?: …`, `(property) key?: unknown`), for those TypeScript leaves
 * undocumented.
 */
export function attributeDoc(signature: string): string | undefined {
  const line = signature.trim().split("\n")[0]!;
  if (/^\(property\) "on:[^"]+"\??:/.test(line)) return NATIVE_EVENT_DOC;
  if (
    /^\(property\) (?:JSX\.IntrinsicAttributes\.|LumioseProps<[^>]*>\.)?key\?: unknown$/.test(line)
  ) {
    return KEY_DOC;
  }
  return undefined;
}
