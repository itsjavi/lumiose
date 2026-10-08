// Temporary test renderer standing in for lumen/server (TASK-16) behind the PageRenderer seam.
// Test components return raw HTML strings (or SSR nodes); testHead() mimics <Title>/<Meta> and
// testDefer() mimics a <Suspense> boundary whose content streams after the shell.

import { AsyncLocalStorage } from "node:async_hooks";
import { composePageTree, type PageRenderer } from "../render.ts";

interface Frame {
  head: string[];
  deferred: Array<Promise<string>>;
}

const frames = new AsyncLocalStorage<Frame>();

function frame(): Frame {
  const current = frames.getStore();
  if (current === undefined) throw new Error("testHead()/testDefer() outside a render");
  return current;
}

/** Collects head HTML while the shell renders. Returns "" so it can sit inside templates. */
export function testHead(html: string): string {
  frame().head.push(html);
  return "";
}

/** A boundary: renders a fallback marker now and streams `content()` after the shell. */
export function testDefer(content: () => Promise<string>): string {
  const { deferred } = frame();
  const chunk = content();
  // The stream reports the rejection; avoid an unhandled rejection before it is pulled.
  chunk.catch(() => {});
  deferred.push(chunk);
  return `<!--defer:${deferred.length - 1}-->`;
}

async function resolve(value: unknown): Promise<string> {
  const settled = await value;
  if (settled === null || settled === undefined || typeof settled === "boolean") return "";
  if (Array.isArray(settled)) return (await Promise.all(settled.map(resolve))).join("");
  if (typeof settled === "object" && "t" in settled) return String(settled.t);
  return String(settled);
}

export function createStringRenderer(): PageRenderer {
  return (tree, options) => {
    const current: Frame = { head: [], deferred: [] };
    return frames.run(current, async () => {
      const root = composePageTree(tree, (component, props) => component(props));
      let body = await resolve(root());
      const head = current.head.join("");
      if (current.deferred.length === 0) return { head, body, stream: null };
      if (options.resolveAll) {
        const chunks = await Promise.all(current.deferred);
        body = body.replace(/<!--defer:(\d+)-->/g, (_, index: string) => chunks[Number(index)]!);
        return { head, body, stream: null };
      }
      const pending = current.deferred.entries();
      const stream = new ReadableStream<string>({
        async pull(controller) {
          const next = pending.next();
          if (next.done) {
            controller.close();
            return;
          }
          const [index, chunk] = next.value;
          controller.enqueue(`<template for="defer:${index}">${await chunk}</template>`);
        },
      });
      return { head, body, stream };
    });
  };
}
