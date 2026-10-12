// The checks every deploy target runs against the sample (LOCAL ONLY: the e2e:* scripts run them
// in each platform's emulator; CI never does). Each check is an HTTP request and what the answer
// must hold; `expect` says what a target is known to differ in.

export interface Expectations {
  /** `ctx.platform.clientAddress` is set. */
  clientAddress: boolean;
  /** The `GREETING` variable reaches `ctx.platform.env` or `ctx.env`. */
  greeting?: string;
  /** Content-hashed assets get `immutable` caching. */
  immutableAssets: boolean;
  /** A `waitUntil()` promise finishes after the response, in the same instance. */
  waitUntil: boolean;
}

export interface Result {
  name: string;
  ok: boolean;
  detail: string;
}

export async function runChecks(base: string, expect: Expectations): Promise<Result[]> {
  const origin = new URL(base).origin;
  const url = (path: string) => new URL(path, base).href;
  const results: Result[] = [];
  const check = async (name: string, run: () => Promise<string>) => {
    try {
      results.push({ name, ok: true, detail: await run() });
    } catch (error) {
      results.push({ name, ok: false, detail: (error as Error).message });
    }
  };
  const assert = (condition: unknown, message: string): void => {
    if (!condition) throw new Error(message);
  };

  let home = "";
  await check("prerendered page (static file)", async () => {
    const res = await fetch(url("/"));
    home = await res.text();
    assert(res.status === 200, `status ${res.status}`);
    assert(home.includes("Prerendered home"), "no heading");
    assert(home.includes('http-equiv="Content-Security-Policy"'), "no CSP hash policy <meta>");
    assert(res.headers.get("x-deploy-check") === "1", "no lumiose({ headers }) header");
    assert(res.headers.get("x-content-type-options") === "nosniff", "no default nosniff header");
    return `200, ${res.headers.get("content-type")}, lumiose({ headers }) and defaults`;
  });

  await check("public file", async () => {
    const res = await fetch(url("/robots.txt"));
    const text = await res.text();
    assert(res.status === 200 && text.startsWith("User-agent"), `status ${res.status}`);
    return "200";
  });

  await check("content-hashed asset", async () => {
    const src = /<script type="module"[^>]* src="([^"]+)"/.exec(home)?.[1];
    assert(src !== undefined, "no island loader script in the home page");
    const res = await fetch(url(src!));
    await res.arrayBuffer();
    assert(res.status === 200, `status ${res.status}`);
    assert(/javascript/.test(res.headers.get("content-type") ?? ""), "not JavaScript");
    const cache = res.headers.get("cache-control") ?? "";
    if (expect.immutableAssets) assert(cache.includes("immutable"), `cache-control: ${cache}`);
    return `200, cache-control: ${cache || "(none)"}`;
  });

  await check("server page, streamed (Suspense), CSP nonce", async () => {
    const started = performance.now();
    // Uncompressed: a gzip stream without flushes would hold the shell back in the client.
    const res = await fetch(url("/live?q=42"), { headers: { "accept-encoding": "identity" } });
    assert(res.status === 200, `status ${res.status}`);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let html = "";
    let firstChunk: number | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      firstChunk ??= performance.now() - started;
      html += decoder.decode(value, { stream: true });
    }
    const total = performance.now() - started;
    assert(html.includes("Live 42"), "no heading with the query");
    assert(html.includes("streamed after the shell"), "no streamed content");
    assert(html.includes("<template"), "no streamed swap (rendered resolved?)");
    const csp = res.headers.get("content-security-policy") ?? "";
    assert(csp.includes("'nonce-"), `no nonce policy: ${csp}`);
    assert(res.headers.get("x-deploy-check") === "1", "no lumiose({ headers }) header");
    const streamed = firstChunk !== undefined && total - firstChunk > 250;
    return `first bytes after ${Math.round(firstChunk ?? 0)} ms, done after ${Math.round(total)} ms (${streamed ? "streamed" : "buffered by the emulator"})`;
  });

  await check("endpoint GET: ctx.platform and env", async () => {
    const res = await fetch(url("/api/echo"));
    const data = (await res.json()) as {
      clientAddress: string | null;
      greeting: string | null;
      waitUntil: string;
      url: string;
      yaml: string;
    };
    assert(res.status === 200, `status ${res.status}`);
    assert(data.waitUntil === "function", "no waitUntil");
    if (expect.clientAddress) assert(data.clientAddress !== null, "no clientAddress");
    if (expect.greeting !== undefined) {
      assert(data.greeting === expect.greeting, `greeting ${JSON.stringify(data.greeting)}`);
    }
    assert(data.url.startsWith(origin), `ctx.url ${data.url} is not on ${origin}`);
    assert(data.yaml === "ok: true", "the npm package (yaml) did not run");
    return `clientAddress ${JSON.stringify(data.clientAddress)}, greeting ${JSON.stringify(data.greeting)}, ctx.url ${data.url}`;
  });

  await check("endpoint POST with a body", async () => {
    const res = await fetch(url("/api/echo"), { method: "POST", body: "ping" });
    const text = await res.text();
    assert(res.status === 200 && text === "posted ping", `${res.status} ${text}`);
    return "200";
  });

  await check("form action on a prerendered page", async () => {
    const res = await fetch(url("/form"), {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", origin },
      body: "name=Ada",
      redirect: "manual",
    });
    const html = await res.text();
    assert(res.status === 200, `status ${res.status}`);
    assert(html.includes("hello Ada"), "no action data in the page");
    return "200, action data rendered";
  });

  await check("cross-site form post refused", async () => {
    const res = await fetch(url("/form"), {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        origin: "https://evil.example",
      },
      body: "name=Eve",
      redirect: "manual",
    });
    await res.text();
    assert(res.status === 403, `status ${res.status}`);
    return "403";
  });

  await check("unknown URL: the not-found page", async () => {
    const res = await fetch(url("/missing/page"));
    const html = await res.text();
    assert(res.status === 404, `status ${res.status}`);
    assert(html.includes("Nothing at this address (404)"), "not the app's not-found page");
    return "404, not-found.stsx";
  });

  await check("waitUntil()", async () => {
    const id = Math.random().toString(36).slice(2);
    await (await fetch(url(`/api/later?id=${id}`))).text();
    await new Promise((resolve) => setTimeout(resolve, 600));
    const { done } = (await (await fetch(url(`/api/later?id=${id}&check`))).json()) as {
      done: boolean;
    };
    if (expect.waitUntil) assert(done, "the promise did not finish in the same instance");
    return done ? "finished after the response" : "not observed (another instance)";
  });

  return results;
}

/** Prints the results; resolves to whether every check passed. */
export function report(target: string, results: readonly Result[]): boolean {
  console.log(`\n${target}:`);
  for (const result of results) {
    console.log(`  ${result.ok ? "✓" : "✗"} ${result.name}: ${result.detail}`);
  }
  const failed = results.filter((result) => !result.ok).length;
  console.log(failed === 0 ? `  all ${results.length} checks passed` : `  ${failed} failed`);
  return failed === 0;
}
