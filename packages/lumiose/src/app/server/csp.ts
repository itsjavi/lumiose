// `lumiose({ csp: "strict" })` (spec §7.4, TASK-138): a Content Security Policy that allows only the
// scripts and styles Lumiose and the app emit on purpose.
//
// - Rendered per request (`server` routes, `lumiose dev`): a fresh nonce per response. Every inline
//   `<script>`/`<style>` and module preload Lumiose writes carries it (the page's stylesheets, the
//   `style`-prop rules, the island loader, streamed Suspense swaps, speculation rules, the View
//   Transitions opt-in), `cspNonce()` hands it to the app (a document's own inline script), and
//   `<meta property="csp-nonce">` to the client's preload helper. The policy goes in the
//   `Content-Security-Policy` header: `script-src 'nonce-…' 'strict-dynamic'`, so the scripts these
//   load may load others, and `style-src 'self' 'nonce-…'`.
// - Prerendered pages (`lumiose build`) are files: a nonce would be the same for every visitor. They
//   get `<meta http-equiv="Content-Security-Policy">` instead, with the SHA-256 hashes of their
//   inline scripts and styles, and `'self'` for the external ones.
//
// Inline `style` attributes are not allowed: in strict mode, `style` props render as rules of a
// nonce'd (or hashed) `<style>` (`data-l-v`), and the client sets styles through the CSSOM.

import { createHash, randomBytes } from "node:crypto";

/** `lumiose({ csp })`: `"strict"`, or absent for no policy. */
export type CspOption = "strict";

/** A fresh nonce: 128 random bits, base64. */
export function createNonce(): string {
  return randomBytes(16).toString("base64");
}

/** The policy of a page rendered for one request. */
export function noncePolicy(nonce: string): string {
  return [
    `script-src 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${nonce}'`,
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/**
 * The policy of a prerendered page: by hash, the inline scripts and styles that carry `marker` as
 * their nonce, which are those Lumiose and JSX emitted while prerendering (decision-27). Other inline
 * scripts and styles (raw HTML strings) are not allowed, as with a per-request nonce (TASK-165).
 */
export function hashPolicy(html: string, marker: string): string {
  const scripts = new Set<string>();
  const styles = new Set<string>();
  const marked = (attributes: string) => attributes.includes(` nonce="${marker}"`);
  for (const match of html.matchAll(INLINE_SCRIPT)) {
    if (marked(match[1]!) && isExecutable(match[1]!)) scripts.add(hash(match[2]!));
  }
  for (const match of html.matchAll(INLINE_STYLE)) {
    if (marked(match[1]!)) styles.add(hash(match[2]!));
  }
  return [
    ["script-src 'self'", ...scripts].join(" "),
    ["style-src 'self'", ...styles].join(" "),
    "object-src 'none'",
    "base-uri 'self'",
  ].join("; ");
}

/**
 * A prerendered document with its hash policy first in `<head>` (after `<meta charset>`), and the
 * `marker` nonces it was rendered with removed: a file served to everyone has no nonce.
 */
export function withHashPolicy(html: string, marker: string): string {
  const policy = hashPolicy(html, marker);
  html = html.replaceAll(` nonce="${marker}"`, "");
  const head = /<head(?:\s[^>]*)?>/i.exec(html);
  if (head === null) return html;
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
  let at = head.index + head[0].length;
  // After a leading `<meta charset>`, which must come early.
  at += /^\s*<meta\s+charset\b[^>]*>/i.exec(html.slice(at))?.[0].length ?? 0;
  return html.slice(0, at) + meta + html.slice(at);
}

/**
 * `html` (markup Lumiose wrote) with `nonce` on its `<script>` and `<style>` elements and module
 * preloads that have none.
 */
export function addNonce(html: string, nonce: string | undefined): string {
  if (nonce === undefined || html === "") return html;
  const attr = ` nonce="${nonce}"`;
  return html.replace(NONCE_TARGET, (tag: string, name: string) =>
    /\snonce=/i.test(tag) || (name === "link" && !/rel="?modulepreload/i.test(tag))
      ? tag
      : `<${name}${attr}${tag.slice(name.length + 1)}`,
  );
}

/** `<meta property="csp-nonce">`, which the client's preload helper and Vite read. */
export function nonceMeta(nonce: string): string {
  return `<meta property="csp-nonce" nonce="${nonce}">`;
}

const NONCE_TARGET = /<(script|style|link)\b[^>]*>/gi;
const INLINE_SCRIPT = /<script((?:\s[^>]*)?)>([\s\S]*?)<\/script>/gi;
const INLINE_STYLE = /<style((?:\s[^>]*)?)>([\s\S]*?)<\/style>/gi;

/** Whether a `<script>` with these attributes runs: no `src`, and not a data block. */
function isExecutable(attributes: string): boolean {
  if (/\ssrc\s*=/i.test(attributes)) return false;
  const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attributes)?.[1]?.toLowerCase();
  return (
    type === undefined ||
    type === "module" ||
    type === "speculationrules" ||
    type === "importmap" ||
    type.includes("javascript") ||
    type.includes("ecmascript")
  );
}

function hash(text: string): string {
  return `'sha256-${createHash("sha256").update(text).digest("base64")}'`;
}
