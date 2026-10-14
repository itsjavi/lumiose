# AWS Lambda

> Run the server build on AWS Lambda behind a Function URL or API Gateway, through a small adapter from Lambda events to its fetch handler.

Not tested on AWS yet: see the [verification table](README.md#verification). There is no
`@lumiose/adapter-lambda`; this page shows the handler to write.

The Lambda runs `dist/server/entry.js`'s `fetch`, which serves the static files of `dist/client`
when the deployment package includes them, then the app, with `lumiose({ headers })`. A CDN in
front serves them better: put `dist/client` on S3 behind CloudFront
([Static hosts](static.md#s3-and-cloudfront)), with a behavior that sends the other paths to the
function.

```ts
// lambda.ts: deploy it with dist/ and the production node_modules (Node.js 24 runtime)
import app from "./dist/server/entry.js";

interface FunctionUrlEvent {
  rawPath: string;
  rawQueryString: string;
  headers: Record<string, string>;
  cookies?: string[];
  body?: string;
  isBase64Encoded: boolean;
  requestContext: { http: { method: string; sourceIp: string } };
}

export async function handler(event: FunctionUrlEvent) {
  const { method, sourceIp } = event.requestContext.http;
  const headers = new Headers(event.headers);
  if (event.cookies?.length) headers.set("cookie", event.cookies.join("; "));
  const url = `https://${event.headers.host}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;
  const body =
    event.body === undefined || method === "GET" || method === "HEAD"
      ? undefined
      : Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
  const response = await app.fetch(new Request(url, { method, headers, body }), {
    clientAddress: sourceIp,
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  return {
    statusCode: response.status,
    headers: Object.fromEntries([...response.headers].filter(([name]) => name !== "set-cookie")),
    cookies: response.headers.getSetCookie(),
    body: bytes.toString("base64"),
    isBase64Encoded: true,
  };
}
```

This buffers each response: pages arrive whole, after their `<Suspense>` content resolves. Lambda's
response streaming (`awslambda.streamifyResponse`, Function URLs only) can send the stream
instead. `ctx.platform.waitUntil` falls back to letting the promise run, which Lambda may freeze
once the response is returned: await such work in the handler instead.
