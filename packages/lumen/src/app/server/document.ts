// Document rendering (spec §8 Document): wraps the rendered shell in <html>/<head>/<body>, using
// the default document or `src/document.stsx`, and splices the Suspense stream into <body>.

import type { SSRNode } from "../../contract/server.ts";
import type { DocumentProps } from "./context.ts";
import type { RenderedShell } from "./render.ts";

/** `src/document.stsx` default export: renders `head` and `body` where they belong. */
export type DocumentComponent = (props: DocumentProps) => SSRNode | Promise<SSRNode>;

// Stands in for the body while the custom document renders, then marks where to split it.
const BODY_SLOT = "<!--lumen:document-body-->";
const DOCTYPE = /^\s*<!doctype html/i;

/** Splits the document around the body: `before + body + stream + after`. */
export interface DocumentParts {
  before: string;
  after: string;
}

export async function renderDocument(
  head: string,
  document: DocumentComponent | undefined,
): Promise<DocumentParts> {
  if (document === undefined) {
    return {
      before:
        '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
        `<meta name="viewport" content="width=device-width, initial-scale=1">${head}</head><body>`,
      after: "</body></html>",
    };
  }
  const html = (await document({ head: { t: head }, body: { t: BODY_SLOT } })).t;
  const at = html.indexOf(BODY_SLOT);
  if (at === -1 || html.indexOf(BODY_SLOT, at + 1) !== -1) {
    throw new Error("src/document.stsx must render {props.body} exactly once.");
  }
  const before = html.slice(0, at);
  return {
    before: DOCTYPE.test(before) ? before : `<!doctype html>${before}`,
    after: html.slice(at + BODY_SLOT.length),
  };
}

/** The response body: a string when the shell is complete, otherwise a byte stream. */
export function documentBody(
  parts: DocumentParts,
  shell: RenderedShell,
  onStreamError: (error: unknown) => void,
): string | ReadableStream<Uint8Array> {
  const opening = parts.before + shell.body;
  if (shell.stream === null) return opening + parts.after;
  const encoder = new TextEncoder();
  const reader = shell.stream.getReader();
  const encode = (chunk: string | Uint8Array) =>
    typeof chunk === "string" ? encoder.encode(chunk) : chunk;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(opening));
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
