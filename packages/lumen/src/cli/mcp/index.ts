// `lumen mcp` (TASK-34, spec §10, decision-10): a stdio MCP server that gives coding agents direct,
// structured access to the version-matched docs, diagnostics and project structure.
//
// Tools: docs_search, docs_get, check, routes, components, compile, render, dev_logs.
// Resources: every docs page (`lumen://docs/<topic>`) and the route manifest (`lumen://routes`).
// stdout carries the protocol: nothing else may print there (console output goes to stderr and to
// `dev_logs`).

import type { McpServer as McpServerType } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { inspect } from "node:util";
import { z } from "zod";
import pkg from "../../../package.json" with { type: "json" };
import { summarize } from "../check/diagnostics.ts";
import { check } from "../check/index.ts";
import {
  diagnosticCode,
  loadDocs,
  printable,
  relatedTopics,
  resolveExport,
  resolveTopic,
  searchDocs,
  type Doc,
} from "../docs/index.ts";
import { EXIT_FAILURE, EXIT_OK, failureOf } from "../output.ts";
import { projectRoot } from "../project.ts";
import { listRoutes } from "../routes.ts";
import { DevSession } from "./dev.ts";
import { compileSource, listComponents } from "./source.ts";

export { DevSession } from "./dev.ts";

export const INSTRUCTIONS = `Lumen project tools. Lumen is a TypeScript 7 web framework with .stsx components (TSX plus raw-CSS <style> blocks), signals, file routes and islands; it is not React, Solid or Svelte.
- Before writing Lumen code, look it up: docs_search, then docs_get (the docs match the installed version).
- After editing, run check and fix every error (each diagnostic has help, a docs topic and sometimes a fix).
- routes and components describe the project; compile shows what the compiler makes of a file; render returns a route's server-rendered HTML from an in-process dev server, whose logs dev_logs returns.`;

export interface LumenMcpOptions {
  /** The project root. */
  root: string;
  /** Docs directory (tests). */
  docsDir?: string;
}

export interface LumenMcp {
  server: McpServerType;
  dev: DevSession;
  /** Waits for the tool calls in flight, then closes the dev server if one was started. */
  close(): Promise<void>;
}

/** The MCP server for a project, not yet connected to a transport. */
export async function createLumenMcpServer(options: LumenMcpOptions): Promise<LumenMcp> {
  const { McpServer, ResourceTemplate } = await import("@modelcontextprotocol/sdk/server/mcp.js");
  const root = projectRoot(options.root);
  const server = new McpServer(
    { name: "lumen", title: "Lumen", version: pkg.version },
    { instructions: INSTRUCTIONS },
  );
  const dev = new DevSession(root);
  let docsCache: Doc[] | undefined;
  const docs = () => (docsCache ??= loadDocs(options.docsDir));
  const readOnly = { readOnlyHint: true, openWorldHint: false } as const;
  // Tool calls in flight, so that the server can finish them before it stops.
  const pending = new Set<Promise<CallToolResult>>();
  const run = (task: () => Promise<CallToolResult>): Promise<CallToolResult> => {
    const call = task().catch(failure);
    pending.add(call);
    void call.finally(() => pending.delete(call));
    return call;
  };

  server.registerTool(
    "docs_search",
    {
      title: "Search the Lumen docs",
      description:
        "Full-text search of the Lumen docs for the installed version: concepts, API reference and diagnostic pages. Returns topics with titles and a matching line; read one with docs_get.",
      inputSchema: {
        query: z.string().describe('Words to find, e.g. "await island" or "form action"'),
        limit: z.number().int().min(1).max(50).optional().describe("Maximum results (10)"),
      },
      annotations: readOnly,
    },
    ({ query, limit }) => json({ query, results: searchDocs(query, docs(), limit ?? 10) }),
  );

  server.registerTool(
    "docs_get",
    {
      title: "Read a Lumen docs page",
      description:
        'A Lumen docs page as Markdown, by topic: "concepts/signals", "reference/app", a bare name ("signals"), a diagnostic code ("LUM2001") or "" for the index. An exported name ("fetchJSON", "Link") returns its API reference section.',
      inputSchema: {
        topic: z.string().describe('Docs topic, bare name or diagnostic code, e.g. "LUM2001"'),
      },
      annotations: readOnly,
    },
    ({ topic }) => {
      const all = docs();
      const exported = resolveExport(topic, all);
      if (exported) {
        return text(
          `<!-- lumen docs: ${exported.topic} -->\n${exported.content}\n---\nFrom ${exported.topic}; read the whole page with docs_get("${exported.topic}").\n`,
        );
      }
      const doc = resolveTopic(topic, all);
      if (doc) {
        const related = relatedTopics(doc, all);
        const footer = related.length > 0 ? `\n---\nRelated topics: ${related.join(", ")}\n` : "";
        return text(`<!-- lumen docs: ${doc.topic} -->\n${printable(doc.content)}${footer}`);
      }
      const code = diagnosticCode(topic);
      const results = code === undefined ? searchDocs(topic, all, 5) : [];
      return error(
        code === undefined
          ? `No docs topic "${topic}".${results.length > 0 ? ` Pages that mention it: ${results.map((result) => result.topic).join(", ")}.` : " Search with docs_search."}`
          : `Unknown diagnostic code ${code}. The codes are listed in the "errors" topic.`,
      );
    },
  );

  server.registerTool(
    "check",
    {
      title: "Check the project",
      description:
        "Runs lumen check: route typegen, shadow TSX, TypeScript and the Lumen compiler's diagnostics. Returns { ok, summary, diagnostics } with 1-based positions (with files: of those files, plus projectSummary); Lumen diagnostics carry help, a docs topic (read it with docs_get) and, when mechanical, a fix of text edits.",
      inputSchema: {
        files: z
          .array(z.string())
          .optional()
          .describe("Only report diagnostics of these project-relative files (all are checked)"),
        project: z.string().optional().describe("tsconfig path relative to the root"),
      },
      annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
    },
    ({ files, project }) =>
      run(async () => {
        const result = await check({ root, ...(project === undefined ? {} : { project }) });
        const wanted = files?.map((file) => file.replace(/^\.\//, ""));
        const diagnostics =
          wanted === undefined
            ? result.diagnostics
            : result.diagnostics.filter((diagnostic) => wanted.includes(diagnostic.file));
        const summary = wanted === undefined ? result.summary : summarize(diagnostics);
        return json({
          ok: summary.errors === 0,
          summary,
          ...(wanted === undefined ? {} : { projectSummary: result.summary }),
          ...(result.notes.length > 0 ? { notes: result.notes } : {}),
          diagnostics,
        });
      }),
  );

  server.registerTool(
    "routes",
    {
      title: "List the routes",
      description:
        "The file routes in match priority order: pattern, page or endpoint, render mode (static, server, spa), file, layouts and params, plus route diagnostics.",
      inputSchema: {},
      annotations: readOnly,
    },
    () =>
      run(async () => {
        return json(await listRoutes(root));
      }),
  );

  server.registerTool(
    "components",
    {
      title: "List components",
      description:
        "Compiler metadata of a .stsx/.tsx file, or of every file under src/: components (exported, async, the props parameter and its type when declared in the file, style scope attributes), island call sites (ref, client:* strategy) and the file's style scope.",
      inputSchema: {
        file: z.string().optional().describe("Project-relative path; omit for every file in src/"),
      },
      annotations: readOnly,
    },
    ({ file }) =>
      run(async () => {
        return json({ files: await listComponents(root, { file }) });
      }),
  );

  server.registerTool(
    "compile",
    {
      title: "Compile a file",
      description:
        "Compiles a .stsx/.tsx file (or source text) like the Vite plugin: the client JavaScript (lumen/dom), the server JavaScript (lumen/server), the scoped CSS of its <style> blocks and the compiler's diagnostics.",
      inputSchema: {
        file: z.string().optional().describe("Project-relative path of a .stsx or .tsx file"),
        source: z
          .string()
          .optional()
          .describe("Source text to compile instead of the file's contents"),
        target: z.enum(["client", "server", "both"]).optional().describe("Default both"),
      },
      annotations: readOnly,
    },
    (input) =>
      run(async () => {
        return json(await compileSource(root, input));
      }),
  );

  server.registerTool(
    "render",
    {
      title: "Render a route",
      description:
        "Requests a URL path from an in-process dev server (started on first use, reloading changed files like lumen dev) and returns the status, headers and body: the server-rendered HTML of a page, or an endpoint's response. Redirects are returned, not followed. Errors are logged to dev_logs.",
      inputSchema: {
        path: z.string().describe('URL path with an optional query, e.g. "/blog/hello?page=2"'),
        method: z.string().optional().describe("HTTP method (GET)"),
        headers: z.record(z.string(), z.string()).optional().describe("Request headers"),
        maxLength: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Cut the body after this many characters (100000)"),
        strip: z
          .boolean()
          .optional()
          .describe(
            "HTML only: return the visible markup, without scripts, styles, link/meta tags, templates, hydration comments and data-l-* attributes",
          ),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    ({ path, method, headers, maxLength, strip }) =>
      run(async () => {
        return json(
          await dev.render(path, {
            ...(method === undefined ? {} : { method }),
            ...(headers === undefined ? {} : { headers }),
            ...(maxLength === undefined ? {} : { maxLength }),
            ...(strip === undefined ? {} : { strip }),
          }),
        );
      }),
  );

  server.registerTool(
    "dev_logs",
    {
      title: "Read the dev server logs",
      description:
        "Logs of the dev server that render started in this MCP session (compiler diagnostics, render errors, reloads) and console output of app code. Not the logs of a lumen dev started elsewhere.",
      inputSchema: {
        since: z.number().int().optional().describe("Only entries with a larger id"),
        level: z.enum(["info", "warn", "error"]).optional().describe("Minimum level (info)"),
        limit: z.number().int().min(1).optional().describe("The last n entries (100)"),
      },
      annotations: readOnly,
    },
    ({ since, level, limit }) => {
      const entries = dev.logs({
        ...(since === undefined ? {} : { since }),
        ...(level === undefined ? {} : { level }),
        ...(limit === undefined ? {} : { limit }),
      });
      if (!dev.started && entries.length === 0) {
        return json({
          available: false,
          entries,
          help: "No dev server runs in this MCP session yet: the render tool starts one, and its logs appear here. The output of a `lumen dev` started in a terminal is not visible to the MCP server; read it there (`lumen dev --format json` writes Vite's logs to stderr).",
        });
      }
      return json({ available: true, entries });
    },
  );

  server.registerResource(
    "docs",
    new ResourceTemplate("lumen://docs/{+topic}", {
      list: () => ({
        resources: docs().map((doc) => ({
          uri: `lumen://docs/${doc.topic}`,
          name: doc.topic,
          title: doc.title,
          ...(doc.summary === undefined ? {} : { description: doc.summary }),
          mimeType: "text/markdown",
        })),
      }),
      complete: {
        topic: (value) =>
          docs()
            .map((doc) => doc.topic)
            .filter((topic) => topic.startsWith(value)),
      },
    }),
    {
      title: "Lumen docs",
      description: "The Lumen docs for the installed version, one page per topic",
      mimeType: "text/markdown",
    },
    (uri, { topic }) => {
      const doc = resolveTopic(String(topic), docs());
      if (!doc) throw new Error(`No docs topic "${String(topic)}".`);
      return {
        contents: [{ uri: uri.href, mimeType: "text/markdown", text: printable(doc.content) }],
      };
    },
  );

  server.registerResource(
    "routes",
    "lumen://routes",
    {
      title: "Route manifest",
      description: "The project's file routes with modes, layouts and params (JSON)",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(await listRoutes(root), null, 2),
        },
      ],
    }),
  );

  return {
    server,
    dev,
    async close() {
      while (pending.size > 0) await Promise.allSettled(pending);
      await dev.close();
    },
  };
}

function text(value: string): CallToolResult {
  return { content: [{ type: "text", text: value }] };
}

function json(value: unknown): CallToolResult {
  return text(JSON.stringify(value));
}

function error(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

function failure(caught: unknown): CallToolResult {
  const { message, help } = failureOf(caught);
  return error(help === undefined ? message : `${message}\n${help}`);
}

// --- the command ------------------------------------------------------------------------------------

export interface McpCommandOptions {
  root: string;
  writeError: (text: string) => void;
}

/**
 * `lumen mcp`: serves the project over stdio until the client disconnects (stdin ends) or the
 * process is interrupted. Exit 0 then; 2 when the server cannot start (a missing root).
 */
export async function mcpCommand(options: McpCommandOptions): Promise<number> {
  let mcp: LumenMcp;
  try {
    mcp = await createLumenMcpServer({ root: options.root });
  } catch (caught) {
    const { message, help } = failureOf(caught);
    options.writeError(`lumen mcp: ${message}\n${help === undefined ? "" : `${help}\n`}`);
    return EXIT_FAILURE;
  }
  routeConsole(mcp.dev, options.writeError);
  const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");
  const transport = new StdioServerTransport();
  const stopped = new Promise<void>((resolve) => {
    process.stdin.once("end", resolve);
    process.stdin.once("close", resolve);
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });
  await mcp.server.connect(transport);
  await stopped;
  await mcp.close();
  await mcp.server.close();
  return EXIT_OK;
}

/** Console output of app code goes to stderr and the dev logs: stdout is the protocol's. */
function routeConsole(dev: DevSession, writeError: (text: string) => void): void {
  const levels = {
    log: "info",
    info: "info",
    debug: "info",
    warn: "warn",
    error: "error",
  } as const;
  for (const [method, level] of Object.entries(levels)) {
    console[method as keyof typeof levels] = (...args: unknown[]) => {
      const message = args.map((arg) => (typeof arg === "string" ? arg : inspect(arg))).join(" ");
      dev.log(level, "console", message);
      writeError(`${message}\n`);
    };
  }
}
