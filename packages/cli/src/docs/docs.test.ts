// `lumiose docs`, `lumiose explain` and the docs contract (TASK-32): the shipped docs follow the
// concept page pattern, their links resolve, and the generated files (error pages, llms.txt) are
// current with the compiler registry and the docs.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import pkg from "../../package.json" with { type: "json" };
import { main } from "../main.ts";
import { generateErrorDocs, generateLlms, parseRegistry, REGISTRY_PATH } from "./generate.ts";
import { DOCS_DIR, loadDocs, resolveExport, resolveTopic, searchDocs } from "./index.ts";

const repo = resolve(DOCS_DIR, "../../..");
const docs = loadDocs();

async function run(...argv: string[]) {
  let stdout = "";
  let stderr = "";
  const exitCode = await main(argv, {
    cwd: repo,
    color: false,
    write: (text) => void (stdout += text),
    writeError: (text) => void (stderr += text),
  });
  return { exitCode, stdout, stderr };
}

describe("lumiose docs", () => {
  it("prints the index without a topic", async () => {
    const { exitCode, stdout } = await run("docs");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("# Lumiose docs");
  });

  it("resolves paths, bare names and diagnostic codes", () => {
    expect(resolveTopic("concepts/signals", docs)?.topic).toBe("concepts/signals");
    expect(resolveTopic("docs/concepts/signals.md", docs)?.topic).toBe("concepts/signals");
    expect(resolveTopic("signals", docs)?.topic).toBe("concepts/signals");
    expect(resolveTopic("jsx", docs)?.topic).toBe("concepts/jsx");
    expect(resolveTopic("getting-started", docs)?.topic).toBe("getting-started");
    expect(resolveTopic("lum1004", docs)?.topic).toBe("errors/LUM1004");
    expect(resolveTopic("diagnostics/LUM1004", docs)?.topic).toBe("errors/LUM1004");
    expect(resolveTopic("errors", docs)?.topic).toBe("errors/README");
    expect(resolveTopic("deploy", docs)?.topic).toBe("deploy/README");
    expect(resolveTopic("docker", docs)?.topic).toBe("deploy/docker");
    expect(resolveTopic("auth", docs)?.topic).toBe("guides/auth");
    expect(resolveTopic("coming-from/react", docs)?.topic).toBe("coming-from/react");
    expect(resolveTopic("no-such-topic", docs)).toBeUndefined();
  });

  it("prints the reference section of an exported name (TASK-122)", async () => {
    expect(resolveExport("fetchJSON", docs)).toMatchObject({
      topic: "reference/app",
      heading: "fetchJSON",
    });
    // A name in a list heading, and `name()`.
    expect(resolveExport("ActionFailure", docs)?.heading).toBe("fail, ActionFailure");
    expect(resolveExport("lumiose", docs)?.topic).toBe("reference/vite");
    // Case-sensitive; topics, section names of several pages and non-names are not exports.
    expect(resolveExport("FetchJSON", docs)).toBeUndefined();
    expect(resolveExport("jsx", docs)).toBeUndefined();
    expect(resolveExport("Example", docs)).toBeUndefined();
    expect(resolveExport("bind:value", docs)).toBeUndefined();

    const { exitCode, stdout } = await run("docs", "signal");
    expect(exitCode).toBe(0);
    expect(stdout).toMatch(/^## signal\n/);
    expect(stdout).not.toContain("## computed");
    expect(stdout).toContain("From reference/reactivity: lumiose docs reference/reactivity");
    const json = JSON.parse((await run("docs", "Link", "--format", "json")).stdout);
    expect(json).toMatchObject({ ok: true, topic: "reference/router", heading: "Link" });
    expect(json.content).toMatch(/^### Link\n/);
  });

  it("prints a topic and points at same-named topics", async () => {
    const { exitCode, stdout } = await run("docs", "jsx");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("# JSX\n");
    expect(stdout).toContain("See also: lumiose docs reference/jsx");
  });

  it("searches when no topic matches", async () => {
    const { exitCode, stdout } = await run("docs", "bind:value");
    expect(exitCode).toBe(0);
    expect(stdout).toContain('No topic "bind:value"');
    expect(stdout).toContain("concepts/jsx");
    const top = searchDocs("submitting fail", docs)
      .slice(0, 3)
      .map((result) => result.topic);
    expect(top).toContain("concepts/data-and-actions");
    expect(top).toContain("reference/app");
  });

  it("prints JSON for topics, lists and searches", async () => {
    const topic = JSON.parse((await run("docs", "signals", "--format", "json")).stdout);
    expect(topic).toMatchObject({ topic: "concepts/signals", title: "Signals and reactivity" });
    expect(topic.content).toContain("## Common mistakes");
    const list = JSON.parse((await run("docs", "--format", "json")).stdout);
    expect(list.topics.map((entry: { topic: string }) => entry.topic)).toContain("reference/app");
    const search = JSON.parse((await run("docs", "client:visible", "--format", "json")).stdout);
    expect(search.results[0]).toMatchObject({ topic: "concepts/islands" });
  });

  it("exits 1 when nothing matches", async () => {
    const { exitCode, stderr } = await run("docs", "zzqqxx");
    expect(exitCode).toBe(1);
    expect(stderr).toContain('no docs match "zzqqxx"');
  });
});

describe("lumiose explain", () => {
  it("prints the page of a code, in any case", async () => {
    const { exitCode, stdout } = await run("explain", "lum2001");
    expect(exitCode).toBe(0);
    expect(stdout).toContain("# LUM2001: Stale derived value");
    expect(stdout).toContain("## How to fix it");
  });

  it("prints JSON with the registry metadata", async () => {
    const { stdout } = await run("explain", "LUM3010", "--format", "json");
    expect(JSON.parse(stdout)).toMatchObject({
      code: "LUM3010",
      title: "Misplaced `<style>` block",
      severity: "error",
      category: "styles (3xxx)",
      topic: "errors/LUM3010",
    });
  });

  it("rejects unknown codes and non-codes", async () => {
    expect((await run("explain", "LUM9999")).exitCode).toBe(1);
    expect((await run("explain", "signals")).exitCode).toBe(2);
    expect((await run("explain")).exitCode).toBe(2);
  });
});

describe("docs contract", () => {
  const CONCEPT_SECTIONS = ["Concept", "API", "Example", "Common mistakes", "Related diagnostics"];

  it("gives every concept page the five sections, in order", () => {
    const concepts = docs.filter((doc) => doc.topic.startsWith("concepts/"));
    expect(concepts.length).toBeGreaterThanOrEqual(13);
    for (const doc of concepts) {
      const sections = [...doc.content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
      expect(sections, doc.topic).toEqual(CONCEPT_SECTIONS);
      expect(doc.summary, `${doc.topic} summary`).toBeTruthy();
    }
  });

  it("gives every Coming from guide the shared outline, in order (TASK-301)", () => {
    const guides = docs.filter((doc) => doc.topic.startsWith("coming-from/"));
    expect(guides.map((doc) => doc.topic)).toContain("coming-from/react");
    for (const doc of guides) {
      const framework = doc.title.replace(/^Coming from /, "");
      const sections = [...doc.content.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
      expect(sections, doc.topic).toEqual([
        "Mental model",
        `From ${framework} to Lumiose`,
        "What has no equivalent",
        "Example",
        "Common mistakes",
        "Related",
      ]);
      expect(doc.summary, `${doc.topic} summary`).toBeTruthy();
    }
  });

  it("indexes every concept, guide, deploy and reference page", () => {
    const readme = docs.find((doc) => doc.topic === "README")!.content;
    for (const doc of docs) {
      if (
        /^(coming-from|concepts|guides|deploy|reference)\//.test(doc.topic) ||
        doc.topic === "getting-started"
      ) {
        expect(readme, doc.topic).toContain(`](${doc.topic}.md)`);
      }
    }
  });

  it("has only relative links that resolve", () => {
    const broken: string[] = [];
    for (const doc of docs) {
      const prose = doc.content.replace(/^```[\s\S]*?^```/gm, "");
      for (const [, target] of prose.matchAll(/\]\(([^)\s]+)\)/g)) {
        if (/^https?:/.test(target!)) continue;
        const file = target!.split("#")[0]!;
        if (!existsSync(join(DOCS_DIR, dirname(doc.topic), file))) {
          broken.push(`${doc.topic}: ${target}`);
        }
      }
    }
    expect(broken).toEqual([]);
  });

  it("has an error page for every registry code, up to date", () => {
    const errorsDir = join(DOCS_DIR, "errors");
    const existing = new Map(
      readdirSync(errorsDir).map((name) => [
        `errors/${name}`,
        readFileSync(join(errorsDir, name), "utf8"),
      ]),
    );
    const registry = readFileSync(join(repo, REGISTRY_PATH), "utf8");
    const { files, orphans } = generateErrorDocs(registry, existing);
    expect(orphans).toEqual([]);
    for (const [path, content] of files) {
      expect(
        existing.get(path),
        `${path} is stale: run packages/lumiose/scripts/gen-error-docs.ts`,
      ).toBe(content);
    }
    for (const entry of parseRegistry(registry)) {
      expect(existing.get(`errors/${entry.id}.md`), entry.id).not.toContain("Not documented yet.");
    }
  });

  it("has current llms.txt and llms-full.txt", () => {
    for (const [path, content] of generateLlms(docs, pkg.version)) {
      expect(
        readFileSync(join(DOCS_DIR, path), "utf8"),
        `docs/${path} is stale: run packages/lumiose/scripts/gen-llms.ts`,
      ).toBe(content);
    }
  });
});
