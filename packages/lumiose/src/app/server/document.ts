// Document rendering (spec §8 Document): the default `<html>`/`<head>`/`<body>` wrapper, or
// `src/document.stsx`, which renders as the root component of the page tree (see
// `composePageTree`) with `head`/`body` placeholders. The handler then splits the shell around the
// body's end so the Suspense stream lands inside `<body>`.
//
// Head defaults (TASK-238): the `<title>` and `<meta>` tags the document writes in its `<head>` (the
// default document's charset and viewport, or plain tags in `src/document.stsx`) are the shallowest
// head level. A collected tag with the same key (a `<Title>`; a `<Meta>` with the same charset,
// name, property, http-equiv or itemprop) replaces the default where the document put it, so the
// page has one of each and keeps the document's tag order.

import type { Component } from "../../contract/client.ts";
import type { DocumentProps } from "./context.ts";

/** `src/document.stsx` default export: renders `head` and `body` where they belong. */
export type DocumentComponent = Component<DocumentProps>;

/** Placeholder for the collected head (plus head assets) in a custom document. */
export const HEAD_SLOT = "<!--lumiose:head-->";
/** Marks the end of the body in a custom document: the stream is spliced in there. */
export const BODY_SLOT = "<!--lumiose:body-->";

const DOCTYPE = /^\s*<!doctype html/i;
const DEFAULT_HEAD =
  '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width, initial-scale=1">';

/** The document around the stream: `before + stream + after`. */
export interface DocumentParts {
  before: string;
  after: string;
}

/**
 * Builds the document from the rendered shell. With a custom document, `shellBody` is the whole
 * document with the slots; otherwise it is the page body and the default document wraps it.
 */
export function documentParts(shellBody: string, head: string, custom: boolean): DocumentParts {
  if (!custom) {
    const [defaults, rest] = replaceDefaults(DEFAULT_HEAD, DEFAULT_TAGS, head);
    return { before: `${defaults}${rest}</head><body>${shellBody}`, after: "</body></html>" };
  }
  [shellBody, head] = replaceCustomDefaults(shellBody, head);
  const bodyAt = slot(shellBody, BODY_SLOT, "{props.body}");
  const headAt = slot(shellBody, HEAD_SLOT, "{props.head}");
  let before = shellBody.slice(0, bodyAt);
  let after = shellBody.slice(bodyAt + BODY_SLOT.length);
  if (headAt < bodyAt) {
    before = before.slice(0, headAt) + head + before.slice(headAt + HEAD_SLOT.length);
  } else {
    const at = headAt - bodyAt - BODY_SLOT.length;
    after = after.slice(0, at) + head + after.slice(at + HEAD_SLOT.length);
  }
  return { before: DOCTYPE.test(before) ? before : `<!doctype html>${before}`, after };
}

// --- Head defaults -------------------------------------------------------------------------------

interface HeadTag {
  at: number;
  html: string;
  /** The dedupe key of the head components: "title", "charset" or `<attribute>:<value>`. */
  key: string;
  /** Text that a tag with this key contains ("title", "charset" or the value). */
  needle: string;
}

// In source order: comments and raw text elements (skipped, so their content never matches),
// titles, and metas (attribute values may contain `>`).
const HEAD_TAG =
  /<!--[\s\S]*?-->|<(script|style|template|noscript)\b[\s\S]*?<\/\1\s*>|<title\b[^>]*>[\s\S]*?<\/title\s*>|<meta\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
const ATTRIBUTE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>=`]+)))?/g;
const META_KEYS = ["charset", "name", "property", "http-equiv", "itemprop"];
const HEAD_OPEN = /<head[\s>]/i;

/** The keyed `<title>` and `<meta>` tags of `html`. */
function headTags(html: string): HeadTag[] {
  const tags: HeadTag[] = [];
  for (const match of html.matchAll(HEAD_TAG)) {
    const tag = match[0];
    if (match[1] !== undefined || tag[1] === "!") continue;
    const key = tagKey(tag);
    if (key !== undefined) {
      tags.push({ at: match.index, html: tag, key, needle: key.slice(key.indexOf(":") + 1) });
    }
  }
  return tags;
}

function tagKey(tag: string): string | undefined {
  if (tag[1] === "t" || tag[1] === "T") return "title";
  const attributes = new Map<string, string>();
  for (const [, name, double, single, bare] of tag.slice(5).matchAll(ATTRIBUTE)) {
    attributes.set(name!.toLowerCase(), double ?? single ?? bare ?? "");
  }
  const name = META_KEYS.find((key) => attributes.has(key));
  if (name === undefined) return undefined;
  return name === "charset" ? name : `${name}:${attributes.get(name)}`;
}

const DEFAULT_TAGS = headTags(DEFAULT_HEAD);

/**
 * Replaces the default tags of `html` (`defaults`, its keyed tags) with the tags of `head` that have
 * the same key: the first one in place, later ones dropped. Returns both, minus the moved tags.
 */
function replaceDefaults(
  html: string,
  defaults: readonly HeadTag[],
  head: string,
): [html: string, head: string] {
  // Most pages set none of the defaults: skip the scan (Lumiose writes tags in lowercase).
  if (!defaults.some((tag) => head.includes(tag.needle))) return [html, head];
  const collected = new Map<string, HeadTag>();
  for (const tag of headTags(head)) {
    if (!collected.has(tag.key)) collected.set(tag.key, tag);
  }
  const replaced = new Set<string>();
  let out = "";
  let from = 0;
  for (const tag of defaults) {
    const page = collected.get(tag.key);
    if (page === undefined) continue;
    out += html.slice(from, tag.at) + (replaced.has(tag.key) ? "" : page.html);
    from = tag.at + tag.html.length;
    replaced.add(tag.key);
  }
  if (replaced.size === 0) return [html, head];
  out += html.slice(from);
  let rest = "";
  from = 0;
  for (const tag of collected.values()) {
    if (!replaced.has(tag.key)) continue;
    rest += head.slice(from, tag.at);
    from = tag.at + tag.html.length;
  }
  return [out, rest + head.slice(from)];
}

// The head of a custom document rarely changes between requests: its tags are kept.
let lastRegion = "";
let lastTags: HeadTag[] = [];

/** A custom document's defaults are the tags of its `<head>` element. */
function replaceCustomDefaults(html: string, head: string): [html: string, head: string] {
  const start = html.search(HEAD_OPEN);
  const end = start === -1 ? -1 : html.indexOf("</head>", start);
  if (end === -1) return [html, head];
  const region = html.slice(start, end);
  if (region !== lastRegion) {
    lastRegion = region;
    lastTags = headTags(region);
  }
  const [defaults, rest] = replaceDefaults(region, lastTags, head);
  return defaults === region
    ? [html, rest]
    : [html.slice(0, start) + defaults + html.slice(end), rest];
}

function slot(html: string, marker: string, prop: string): number {
  const at = html.indexOf(marker);
  if (at === -1 || html.includes(marker, at + 1)) {
    throw new Error(`src/document.stsx must render ${prop} exactly once.`);
  }
  return at;
}

/** The response body: a string when the shell is complete, otherwise a byte stream. */
export function documentBody(
  parts: DocumentParts,
  stream: ReadableStream<string | Uint8Array> | null,
  onStreamError: (error: unknown) => void,
): string | ReadableStream<Uint8Array> {
  if (stream === null) return parts.before + parts.after;
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  const encode = (chunk: string | Uint8Array) =>
    typeof chunk === "string" ? encoder.encode(chunk) : chunk;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(parts.before));
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (!done) {
          controller.enqueue(encode(value));
          return;
        }
      } catch (error) {
        // Headers are gone: close the document so the page stays well-formed.
        onStreamError(error);
      }
      controller.enqueue(encoder.encode(parts.after));
      controller.close();
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
}
