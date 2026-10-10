// Origin check against cross-site request forgery (decision-18: on by default). Follows the
// approach of Go's `http.CrossOriginProtection`: trust `Sec-Fetch-Site` when the browser sends
// it, else compare the `Origin` host with the request host. Requests without either header do
// not come from a browser that could be tricked into sending them, so they pass.

export interface CsrfOptions {
  /** Full origins (`https://app.example.com`) whose cross-site form posts are accepted. */
  allowedOrigins?: readonly string[];
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
// Content types a cross-site page can post without a CORS preflight.
const FORM_TYPES = new Set([
  "application/x-www-form-urlencoded",
  "multipart/form-data",
  "text/plain",
]);

/**
 * Whether the origin check applies: unsafe methods to pages (form actions), and to endpoints
 * when the body is one a cross-site `<form>` or no-preflight `fetch()` could send. Other content
 * types need a CORS preflight, which endpoints opt into themselves.
 */
export function needsOriginCheck(request: Request, isPage: boolean): boolean {
  if (SAFE_METHODS.has(request.method)) return false;
  if (isPage) return true;
  const type = request.headers.get("content-type")?.split(";")[0]!.trim().toLowerCase() ?? "";
  return type === "" || FORM_TYPES.has(type);
}

/** Whether the request comes from the same origin, a non-browser client or an allowed origin. */
export function isSameOriginRequest(
  request: Request,
  url: URL,
  allowedOrigins: ReadonlySet<string>,
): boolean {
  const origin = request.headers.get("origin");
  if (origin !== null && allowedOrigins.has(origin)) return true;
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin" || site === "none";
  if (origin === null) return true;
  try {
    // Hosts only: behind a TLS-terminating proxy the request URL may say http:.
    return new URL(origin).host === url.host;
  } catch {
    // `Origin: null` (sandboxed frames, file: pages) or a malformed value.
    return false;
  }
}
