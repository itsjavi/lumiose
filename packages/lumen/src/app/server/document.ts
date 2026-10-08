// Document rendering (spec §8 Document): the default `<html>`/`<head>`/`<body>` wrapper, or
// `src/document.stsx`, which renders as the root component of the page tree (see
// `composePageTree`) with `head`/`body` placeholders. The handler then splits the shell around the
// body's end so the Suspense stream lands inside `<body>`.

import type { Component } from "../../contract/client.ts";
import type { DocumentProps } from "./context.ts";

/** `src/document.stsx` default export: renders `head` and `body` where they belong. */
export type DocumentComponent = Component<DocumentProps>;

/** Placeholder for the collected head (plus head assets) in a custom document. */
export const HEAD_SLOT = "<!--lumen:head-->";
/** Marks the end of the body in a custom document: the stream is spliced in there. */
export const BODY_SLOT = "<!--lumen:body-->";

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
    return { before: `${DEFAULT_HEAD}${head}</head><body>${shellBody}`, after: "</body></html>" };
  }
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
