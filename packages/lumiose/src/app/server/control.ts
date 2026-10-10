// Control-flow helpers (spec §8 Context): `redirect()`, `notFound()` and `error()` throw, and the
// request handler turns them into responses or error pages. Isomorphic: no Node APIs, so the
// browser entry can export them for the SPA router later.

/** Thrown by `redirect()`. */
export class Redirect {
  readonly location: string;
  /** Explicit status, or `undefined` to let the handler pick 302 (GET/HEAD) or 303 (other methods). */
  readonly status: RedirectStatus | undefined;

  constructor(location: string, status?: RedirectStatus) {
    this.location = location;
    this.status = status;
  }
}

/** Thrown by `error()` and `notFound()`; rendered by the nearest `_error` (or `_404` for 404s). */
export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export type RedirectStatus = 301 | 302 | 303 | 307 | 308;

const REDIRECT_STATUSES: readonly number[] = [301, 302, 303, 307, 308];

const STATUS_TEXT: Readonly<Record<number, string>> = {
  400: "Bad Request",
  401: "Unauthorized",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  409: "Conflict",
  410: "Gone",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  501: "Not Implemented",
  502: "Bad Gateway",
  503: "Service Unavailable",
};

/**
 * Stops rendering and redirects. Without a status, GET and HEAD requests get 302 and other
 * methods (form posts, fetch mutations) get 303 so the browser follows up with a GET.
 */
export function redirect(location: string | URL, status?: RedirectStatus): never {
  if (status !== undefined && !REDIRECT_STATUSES.includes(status)) {
    throw new RangeError(`redirect(): status must be 301, 302, 303, 307 or 308, got ${status}.`);
  }
  const target = String(location);
  // Only paths and http(s) URLs: a `javascript:` or `data:` Location from user input (`?next=`)
  // would run script in browsers that follow it (TASK-165). Control characters are stripped the
  // way URL parsers do before the scheme is read.
  // oxlint-disable-next-line no-control-regex -- stripping control characters is the point
  const scheme = /^([a-z][a-z\d+.-]*):/i.exec(target.replace(/[\u0000-\u0020]/g, ""))?.[1];
  if (scheme !== undefined && !/^https?$/i.test(scheme)) {
    throw new TypeError(`redirect(): only paths and http(s) URLs are allowed, got "${scheme}:".`);
  }
  throw new Redirect(target, status);
}

/** Stops rendering and renders the nearest `_404` page with status 404. */
export function notFound(message = "Not Found"): never {
  throw new HttpError(404, message);
}

/** Stops rendering and renders the nearest `_error` page (`_404` for 404) with this status. */
export function error(status: number, message: string = statusText(status)): never {
  if (!(Number.isInteger(status) && status >= 400 && status <= 599)) {
    throw new RangeError(`error(): status must be between 400 and 599, got ${status}.`);
  }
  throw new HttpError(status, message);
}

export function isRedirect(value: unknown): value is Redirect {
  return value instanceof Redirect;
}

export function isHttpError(value: unknown): value is HttpError {
  return value instanceof HttpError;
}

export function statusText(status: number): string {
  return STATUS_TEXT[status] ?? (status >= 500 ? "Server Error" : "Error");
}
