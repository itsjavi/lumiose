// What the browser compares before it patches a page in place after a server-only edit (TASK-148,
// ./morph.ts). The dev server appends it to every HTML page as
// `<script type="application/json" data-l-dev>{…}</script>`, computed from the page's HTML, so the
// open page and the fresh copy it fetches are described the same way:
// - `shell`: the `<html>`, `<head>` and `<body>` start tags and the page's scripts (neither JSON
//   data nor streaming's `$swap`). A patch neither runs new scripts nor changes those tags.
// - `islands`: the island records (without their awaited values), the page payload and each
//   island's slot HTML (the server HTML it got as JSX props and children). Islands keep their DOM
//   and state only while all three are unchanged.
// CSP nonces differ on every response and are left out.

import { createHash } from "node:crypto";
import { jsonForScript } from "lumiose/internal/server/node.ts";

export interface DevAnnotation {
  /** The request method: the result page of a form post cannot be fetched again. */
  method: string;
  status: number;
  /** The render reported errors (the page opens Vite's error overlay). */
  errors: boolean;
  shell: string;
  islands: string;
}

const SCRIPT = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const NONCE = /\snonce\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+)/gi;
const ISLAND_START = /<!--l:(\d+)-->/g;
/** Slot boundaries in an island's range: inline slots, and templates (of slots or not). */
const SLOT_TOKEN = /<!--l:s:[^>]*?-->|<!--\/l:s-->|<template\b[^>]*>|<\/template\s*>/gi;

/** The `<script type="application/json" data-l-dev>` element describing the page `html`. */
export function devAnnotation(
  html: string,
  page: Omit<DevAnnotation, "shell" | "islands">,
): string {
  const annotation: DevAnnotation = { ...page, ...fingerprint(html) };
  return `<script type="application/json" data-l-dev>${jsonForScript(annotation)}</script>`;
}

/** The `shell` and `islands` fingerprints of the page `html`. */
export function fingerprint(html: string): Pick<DevAnnotation, "shell" | "islands"> {
  const scripts: string[] = [];
  const records: Record<string, unknown>[] = [];
  const payload: Record<string, Record<string, unknown>> = {};
  for (const [, attrs, text] of html.matchAll(SCRIPT)) {
    const type = attribute(attrs!, "type")?.trim().toLowerCase() ?? "";
    if (type.endsWith("json")) {
      const data = parse(text!);
      if (/\sdata-l-islands\b/.test(attrs!)) {
        for (const entry of Array.isArray(data) ? data : [{ id: -1, data }]) {
          const record = { ...(entry as Record<string, unknown>) };
          delete record.awaits;
          // `{ id, awaits }` entries only add awaited values to an island of an earlier chunk.
          if (Object.keys(record).length > 1) records.push(record);
        }
      } else if (/\sdata-l-payload\b/.test(attrs!)) {
        for (const [key, values] of Object.entries(data ?? {})) {
          payload[key] = { ...payload[key], ...(values as object) };
        }
      }
    } else if (!text!.startsWith("$swap")) {
      const src = attribute(attrs!, "src");
      scripts.push(src === undefined ? `${type}:${text}` : `${type}@${src}`);
    }
  }
  // Streamed chunks flush in the order their content resolves, which varies between renders.
  records.sort((a, b) => (a.id as number) - (b.id as number));
  const slots: [string, string][] = [];
  for (const match of html.matchAll(ISLAND_START)) {
    const from = match.index + match[0].length;
    const to = html.indexOf(`<!--/l:${match[1]}-->`, from);
    const slot = to === -1 ? "" : slotHtml(html.slice(from, to));
    if (slot !== "") slots.push([match[1]!, slot]);
  }
  slots.sort(([a], [b]) => Number(a) - Number(b));
  const tags = ["html", "head", "body"].map(
    (tag) => new RegExp(`<${tag}\\b[^>]*>`, "i").exec(html)?.[0].replace(NONCE, "") ?? "",
  );
  return {
    shell: hash([tags, scripts.toSorted()]),
    islands: hash([records, sortKeys(payload), slots]),
  };
}

/**
 * The slots in an island's range (the HTML between `<!--l:ID-->` and `<!--/l:ID-->`): its
 * `<template data-l-slot>` elements and inline `<!--l:s:NAME-->…<!--/l:s-->` slots, outermost
 * first. The rest is the island's own render, which its module (client code) updates.
 */
export function slotHtml(range: string): string {
  const open: boolean[] = [];
  let slots = 0;
  let from = 0;
  let out = "";
  for (const match of range.matchAll(SLOT_TOKEN)) {
    const token = match[0];
    if (token.startsWith("</") || token === "<!--/l:s-->") {
      if (open.pop() && --slots === 0) out += range.slice(from, match.index + token.length);
    } else {
      const slot = token.startsWith("<!--") || /\sdata-l-slot\b/.test(token);
      if (slot && slots++ === 0) from = match.index;
      open.push(slot);
    }
  }
  return out.replace(NONCE, "");
}

function attribute(attrs: string, name: string): string | undefined {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i").exec(
    attrs,
  );
  return match === null ? undefined : (match[1] ?? match[2] ?? match[3]);
}

/** JSON data, or `{ text }` if it does not parse. */
function parse(text: string): object | null {
  try {
    return JSON.parse(text) as object | null;
  } catch {
    return { text };
  }
}

function sortKeys(value: Record<string, Record<string, unknown>>): unknown {
  return Object.keys(value)
    .toSorted()
    .map((key) => [key, Object.entries(value[key]!).toSorted(([a], [b]) => (a < b ? -1 : 1))]);
}

function hash(value: unknown): string {
  return createHash("sha1").update(JSON.stringify(value)).digest("base64url");
}
