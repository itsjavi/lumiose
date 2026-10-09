// The MCP server's dev session (TASK-34): an in-process `lumen dev` server, started on first use
// by the `render` tool, whose Vite logs (compiler diagnostics, render errors, HMR) and console
// output are kept for `dev_logs`. It listens on a free port of 127.0.0.1 and logs nothing to
// stdout, which carries the MCP protocol.

import { stripVTControlCharacters } from "node:util";
import type { Logger } from "vite";
import { CheckFailure } from "../check/diagnostics.ts";
import { writeLumenTsconfig } from "../check/layout.ts";
import type { DevServer } from "../../app/dev/server.ts";

export type LogLevel = "info" | "warn" | "error";

export interface LogEntry {
  /** Increasing per session: pass the last one seen as `since` to read only newer entries. */
  id: number;
  time: string;
  level: LogLevel;
  /** `vite` (the dev server and the Lumen plugins) or `console` (app code). */
  source: "vite" | "console";
  message: string;
}

export interface RenderResult {
  url: string;
  status: number;
  headers: Record<string, string>;
  body: string;
  /** The body was longer than `maxLength` and was cut. */
  truncated: boolean;
}

/** Entries kept; older ones are dropped. */
const MAX_LOGS = 1000;

export class DevSession {
  readonly root: string;
  #server: Promise<DevServer> | undefined;
  #logs: LogEntry[] = [];
  #nextId = 1;

  constructor(root: string) {
    this.root = root;
  }

  /** Whether the dev server was started (it may still be starting). */
  get started(): boolean {
    return this.#server !== undefined;
  }

  /** Starts the dev server once; a failed start is retried on the next call. */
  server(): Promise<DevServer> {
    this.#server ??= this.#start().catch((error: unknown) => {
      this.#server = undefined;
      this.log("error", "vite", `The dev server could not start: ${messageOf(error)}`);
      throw error;
    });
    return this.#server;
  }

  async #start(): Promise<DevServer> {
    await writeLumenTsconfig(this.root);
    const { createDevServer } = await import("../../app/dev/server.ts");
    const server = await createDevServer({
      root: this.root,
      port: 0,
      host: "127.0.0.1",
      customLogger: this.#logger(),
    });
    this.log("info", "vite", `Dev server started at ${server.url}`);
    return server;
  }

  /** Requests `path` from the dev server (starting it if needed), without following redirects. */
  async render(
    path: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      maxLength?: number;
      /** Only the visible markup of an HTML body (see {@link stripHtml}). */
      strip?: boolean;
    } = {},
  ): Promise<RenderResult> {
    // Only a path of this dev server: never an absolute URL or a `//host` (protocol-relative)
    // one, which would send the request, with the caller's headers, to another origin.
    if (!/^\/(?![/\\])/.test(path)) {
      throw new CheckFailure(
        `"${path}" is not a URL path: pass one that starts with a single "/".`,
        {
          help: 'For example "/" or "/blog/hello?page=2". Only the in-process dev server is requested.',
        },
      );
    }
    const server = await this.server();
    const origin = new URL(server.url).origin;
    const url = new URL(path, origin);
    if (url.origin !== origin) {
      throw new CheckFailure(`"${path}" does not resolve to the dev server (${origin}).`);
    }
    const response = await fetch(url, {
      method: options.method ?? "GET",
      ...(options.headers === undefined ? {} : { headers: options.headers }),
      redirect: "manual",
    });
    const html = response.headers.get("content-type")?.includes("text/html") ?? false;
    const text = options.strip && html ? stripHtml(await response.text()) : await response.text();
    const maxLength = options.maxLength ?? 100_000;
    return {
      url: url.pathname + url.search,
      status: response.status,
      headers: Object.fromEntries(response.headers),
      body: text.length > maxLength ? text.slice(0, maxLength) : text,
      truncated: text.length > maxLength,
    };
  }

  log(level: LogLevel, source: LogEntry["source"], message: string): void {
    this.#logs.push({
      id: this.#nextId++,
      time: new Date().toISOString(),
      level,
      source,
      message: stripVTControlCharacters(message).trimEnd(),
    });
    if (this.#logs.length > MAX_LOGS) this.#logs.splice(0, this.#logs.length - MAX_LOGS);
  }

  /** Log entries after `since`, at `level` or above, the last `limit` of them. */
  logs(options: { since?: number; level?: LogLevel; limit?: number } = {}): LogEntry[] {
    const minimum = LEVELS.indexOf(options.level ?? "info");
    const matching = this.#logs.filter(
      (entry) => entry.id > (options.since ?? 0) && LEVELS.indexOf(entry.level) >= minimum,
    );
    return matching.slice(-(options.limit ?? 100));
  }

  async close(): Promise<void> {
    const server = this.#server;
    this.#server = undefined;
    if (server) await (await server.catch(() => undefined))?.close();
  }

  /** A Vite logger that records into the session instead of printing. */
  #logger(): Logger {
    const warned = new Set<string>();
    const logged = new WeakSet<object>();
    const logger: Logger = {
      hasWarned: false,
      info: (message) => this.log("info", "vite", message),
      warn: (message) => {
        logger.hasWarned = true;
        this.log("warn", "vite", message);
      },
      warnOnce(message) {
        if (warned.has(message)) return;
        warned.add(message);
        logger.warn(message);
      },
      error: (message, options) => {
        if (options?.error) logged.add(options.error);
        this.log("error", "vite", message);
      },
      clearScreen() {},
      hasErrorLogged: (error) => logged.has(error),
    };
    return logger;
  }
}

const LEVELS: readonly LogLevel[] = ["info", "warn", "error"];

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * The visible markup of a page, for reading what it renders: no `<script>`, `<style>`, `<link>`,
 * `<meta>` or `<template>` elements (island records, CSS, slots sent for later), no comments
 * (hydration markers) and no `data-l-*` attributes; blank lines collapsed.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<(?:link|meta)\b[^>]*>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+data-l-[\w-]*(?:=(?:"[^"]*"|'[^']*'|[^\s>]*))?/g, "")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{2,}/g, "\n");
}
