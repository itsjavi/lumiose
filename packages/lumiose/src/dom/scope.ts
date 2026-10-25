// The tokens of a `$$scope` string (class passthrough, spec §4.6.2), as the compiler writes them:
// `data-<namespace>-<hash>` attribute names and, with the class strategy (decision-85),
// `.<namespace>-<hash>` classes. Any other token can only come from an object spread into a
// component's props; the client and the server skip it alike, instead of the client throwing
// where the server leaves it out (TASK-590).

const SCOPE_ATTRIBUTE = /^data-[a-z][a-z0-9-]*$/;
const SCOPE_CLASS = /^\.[a-z][a-z0-9-]*$/;

/** A `$$scope` token that is an attribute name (`data-lum-<hash>`). */
export function isScopeAttribute(token: string): boolean {
  return SCOPE_ATTRIBUTE.test(token);
}

/** A `$$scope` token that is a class, written with its dot (`.lum-<hash>`). */
export function isScopeClass(token: string): boolean {
  return SCOPE_CLASS.test(token);
}
